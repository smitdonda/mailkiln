/**
 * `importFromHtml()` — the entry point for pillar 2.
 *
 * Returns a *report*, not just a document. Telling the user "9 of 11 blocks are
 * fully editable, 2 were kept as raw HTML" is the honest version of an import
 * feature; silently dropping the 2 is how other tools produce a template that
 * looks right until you scroll.
 *
 * @module mailforge/core/import/fromHtml
 */

import { DEFAULT_SETTINGS, createBlock, createColumn, createDocument, createRow, createSection, spacing } from '../schema.js'
import { normalize } from '../document.js'
import { collapsedText, getParser, parseStyleAttribute } from './parseAdapter.js'
import {
  createParseContext,
  findSectionTables,
  isHidden,
  sectionFromTable,
  walkContainer,
} from './infer.js'

/** @typedef {import('../types.js').ImportReport} ImportReport */
/** @typedef {import('../types.js').ImportOptions} ImportOptions */
/** @typedef {import('../types.js').ImportWarning} ImportWarning */
/** @typedef {import('../types.js').Section} Section */

/**
 * Import an existing HTML email into an editable document.
 *
 * @param {string} html
 * @param {ImportOptions & { varSyntaxes?: string[] }} [options]
 * @returns {ImportReport}
 */
export function importFromHtml(html, options = {}) {
  if (typeof html !== 'string' || html.trim() === '') {
    throw new Error('mailforge: importFromHtml(html) needs a non-empty HTML string.')
  }

  const parse = getParser(options)
  const dom = parse(html)
  const body = dom.body ?? dom.documentElement
  if (!body) throw new Error('mailforge: parsed document has no body.')

  /** @type {ImportWarning[]} */
  const warnings = []
  /** @type {string[]} */
  const detectedVars = []
  /** @type {string[]} */
  const unrecognized = []

  const ctx = createParseContext(dom, { foundVars: detectedVars, varSyntaxes: options.varSyntaxes })
  const settings = { ...DEFAULT_SETTINGS, ...inferSettings(dom, body), ...options.settings }

  /** @type {Section[]} */
  let sections = []
  for (const table of findSectionTables(body)) {
    const section = sectionFromTableSafe(table, ctx, unrecognized)
    if (section) sections.push(section)
  }

  if (!sections.length) {
    // Div-based email (or one wrapper we failed to recognise): walk the body
    // directly rather than giving up.
    /** @type {import('../types.js').Row[]} */
    const rows = []
    walkContainer(body, rows, ctx, unrecognized)
    if (rows.length) {
      sections = [createSection({ rows, props: { padding: spacing(0) } })]
      warnings.push({
        code: 'no-layout-tables',
        message:
          'No layout tables found — content was imported as a single column. Check the result before sending.',
      })
    }
  }

  if (!sections.length) {
    // Absolute last resort. Content is preserved verbatim; editability is not.
    const fallback = createBlock('html', {
      html: ctx.detectVars(body.innerHTML ?? ''),
      imported: true,
      padding: spacing(0),
    })
    unrecognized.push(fallback.id)
    sections = [
      createSection({
        rows: [createRow({ children: [createColumn({ width: 100, blocks: [fallback] })] })],
      }),
    ]
    warnings.push({
      code: 'unstructured',
      message:
        'The structure could not be inferred, so the whole body was kept as one raw HTML block. Nothing was lost, but nothing is visually editable either.',
    })
  }

  collectWarnings(dom, body, warnings)

  const document = normalize(createDocument({ settings, sections }))

  let blockCount = 0
  for (const section of document.sections) {
    for (const row of section.rows) {
      for (const column of row.columns) blockCount += column.blocks.length
    }
  }
  const recognized = blockCount - unrecognized.length

  return {
    document,
    confidence: blockCount === 0 ? 0 : Math.max(0, Math.min(1, recognized / blockCount)),
    blockCount,
    recognized,
    unrecognized,
    warnings,
    detectedVars,
  }
}

/**
 * One bad section must not take down the whole import: on a throw we keep that
 * table's markup as a raw block and carry on. This is the lossless guarantee
 * holding even when our own inference has a bug.
 *
 * @param {Element} table
 * @param {import('../types.js').ParseContext} ctx
 * @param {string[]} unrecognized
 * @returns {Section | null}
 */
function sectionFromTableSafe(table, ctx, unrecognized) {
  try {
    return sectionFromTable(table, ctx, unrecognized)
  } catch {
    const fallback = createBlock('html', {
      html: ctx.detectVars(table.outerHTML ?? ''),
      imported: true,
      padding: spacing(0),
    })
    unrecognized.push(fallback.id)
    return createSection({
      rows: [createRow({ children: [createColumn({ width: 100, blocks: [fallback] })] })],
    })
  }
}

/**
 * Pull document-level settings out of the source: subject, preheader, page
 * background, content width and font stack.
 *
 * @param {Document} dom
 * @param {Element} body
 * @returns {Partial<import('../types.js').DocumentSettings>}
 */
export function inferSettings(dom, body) {
  /** @type {Partial<import('../types.js').DocumentSettings>} */
  const settings = {}

  const title = dom.querySelector?.('title')
  if (title) {
    const text = collapsedText(title)
    if (text) settings.subject = text
  }

  const bodyStyle = parseStyleAttribute(body)
  const bg = String(bodyStyle.backgroundColor || body.getAttribute?.('bgcolor') || '')
  if (bg) settings.backgroundColor = bg
  if (bodyStyle.fontFamily) settings.fontFamily = String(bodyStyle.fontFamily)
  if (bodyStyle.color) settings.textColor = String(bodyStyle.color)

  const lang = dom.documentElement?.getAttribute?.('lang')
  if (lang) settings.language = lang

  // Preheader: the first hidden element carrying text.
  for (const candidate of Array.from(body.querySelectorAll?.('div, span, p') ?? []).slice(0, 40)) {
    if (!isHidden(candidate)) continue
    // Strip the zero-width padding characters preheaders are padded with.
    const text = collapsedText(candidate)
      // Alternation rather than a character class: U+034F is a combining mark,
      // and inside a class it trips `no-misleading-character-class`.
      .replace(/(?:[\u200b\u200c\u2060]|\u034f|\s)+/g, ' ')
      .trim()
    if (text) {
      settings.preheader = text
      break
    }
  }

  const width = inferWidth(body)
  if (width) settings.width = width

  return settings
}

/**
 * The content width, taken from the first plausible fixed-width table.
 *
 * @param {Element} body
 * @returns {number | null}
 */
function inferWidth(body) {
  for (const table of Array.from(body.querySelectorAll?.('table') ?? []).slice(0, 40)) {
    const style = parseStyleAttribute(table)
    const candidates = [
      String(style.maxWidth ?? ''),
      String(style.width ?? ''),
      table.getAttribute?.('width') ?? '',
    ]
    for (const candidate of candidates) {
      const value = parseInt(String(candidate), 10)
      if (Number.isFinite(value) && value >= 320 && value <= 900) return value
    }
  }
  return null
}

/**
 * Report what we knowingly did not carry over. Every one of these is a thing the
 * user would otherwise discover by sending a broken email.
 *
 * @param {Document} dom
 * @param {Element} body
 * @param {ImportWarning[]} warnings
 * @returns {void}
 */
function collectWarnings(dom, body, warnings) {
  const styleTags = Array.from(dom.querySelectorAll?.('style') ?? [])
  const css = styleTags.map((s) => s.textContent ?? '').join('\n')
  if (css.trim()) {
    const hasMedia = /@media/i.test(css)
    warnings.push({
      code: 'style-block-dropped',
      message: hasMedia
        ? 'The source <style> block (including its media queries) was not imported. mailforge regenerates responsive CSS on export.'
        : 'The source <style> block was not imported — mailforge writes styles inline instead.',
    })
  }

  const relativeImages = Array.from(body.querySelectorAll?.('img') ?? []).filter((img) => {
    const src = img.getAttribute?.('src') ?? ''
    return src && !/^(https?:|data:|cid:|\{\{)/i.test(src)
  })
  if (relativeImages.length) {
    warnings.push({
      code: 'relative-image-src',
      message: `${relativeImages.length} image${relativeImages.length === 1 ? '' : 's'} use a relative src. Email clients cannot resolve those — switch them to absolute URLs.`,
    })
  }

  const hidden = Array.from(body.querySelectorAll?.('*') ?? []).filter(
    (el) => isHidden(el) && collapsedText(el) !== '',
  )
  if (hidden.length > 1) {
    warnings.push({
      code: 'hidden-content',
      message: `${hidden.length} hidden elements were skipped (the first is used as the preheader).`,
    })
  }

  if (/<!--\[if/i.test(dom.documentElement?.innerHTML ?? '')) {
    warnings.push({
      code: 'mso-conditionals-dropped',
      message:
        'Outlook conditional comments were dropped. mailforge emits its own on export, so the result should still render in Outlook — verify before sending.',
    })
  }

  if (!Array.from(body.querySelectorAll?.('a') ?? []).some((a) => /unsubscribe/i.test(a.textContent ?? ''))) {
    warnings.push({
      code: 'no-unsubscribe',
      message: 'No unsubscribe link was found in the source.',
    })
  }
}
