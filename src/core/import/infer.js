/**
 * PILLAR 2 — infer a block tree from arbitrary email HTML.
 *
 * Built as a scored inference pass, not a parser, because there is no grammar to
 * parse: every ESP nests tables differently and none of them tell you what a
 * given `<td>` *means*. So we recognise shapes, and the guarantee we make is
 * narrow and absolute:
 *
 *   **Import may degrade in editability. It must never lose content.**
 *
 * Anything we cannot classify becomes a raw `html` block holding its original
 * markup. That is why this can be trusted to migrate a real template, and it is
 * the thing no other builder on npm even attempts.
 *
 * @module mailkiln/core/import/infer
 */

import { parsableBlocks } from '../registry.js'
import { createBlock, createColumn, createRow, createSection, evenWidths, spacing } from '../schema.js'
import { hasBlockLevelChildren } from '../blocks/shared.js'
import { foreignVarsToMailkiln } from '../vars.js'
import { collapsedText, parseStyleAttribute } from './parseAdapter.js'

/** @typedef {import('../types.js').Block} Block */
/** @typedef {import('../types.js').Row} Row */
/** @typedef {import('../types.js').Section} Section */
/** @typedef {import('../types.js').ParseContext} ParseContext */

/** Tags that never carry visible content and are skipped outright. */
const IGNORED_TAGS = new Set(['STYLE', 'SCRIPT', 'META', 'LINK', 'TITLE', 'HEAD', 'XML', 'O:P'])

/**
 * Build the context handed to every block's `parse` hook.
 *
 * @param {Document} document
 * @param {object} [options]
 * @param {string[]} [options.varSyntaxes]
 * @param {string[]} [options.foundVars] Mutable sink for detected merge paths.
 * @returns {ParseContext}
 */
export function createParseContext(document, options = {}) {
  const sink = options.foundVars ?? []
  return {
    document,
    style: (element) => parseStyleAttribute(element),
    text: (element) => collapsedText(element),
    detectVars: (html) => {
      const { text, found } = foreignVarsToMailkiln(html ?? '', { only: options.varSyntaxes })
      for (const path of found) if (!sink.includes(path)) sink.push(path)
      return text
    },
  }
}

/**
 * @param {Element | null | undefined} element
 * @returns {boolean}
 */
export function isHidden(element) {
  if (!element) return true
  const style = parseStyleAttribute(element)
  const display = String(style.display ?? '')
  if (display.replace(/\s/g, '') === 'none') return true
  const maxHeight = String(style.maxHeight ?? '')
  return /^0(px)?$/.test(maxHeight) && String(style.overflow ?? '') === 'hidden'
}

/**
 * A cell that is visible without containing anything: a coloured 1px rule, a
 * fixed-height spacer, a bordered cell. These carry no text and no image, so a
 * naive emptiness check drops them — and dividers and spacers silently
 * disappearing from an imported template is exactly the kind of content loss
 * this importer promises never to do.
 *
 * @param {Element} element
 * @returns {boolean}
 */
function isVisualCell(element) {
  const tag = element.tagName
  if (tag !== 'TD' && tag !== 'TH' && tag !== 'TABLE' && tag !== 'DIV') return false
  const style = parseStyleAttribute(element)
  if (style.backgroundColor || element.getAttribute?.('bgcolor')) return true
  if (style.borderTop || style.borderBottom || style.border) return true
  const height = parseInt(String(style.height ?? element.getAttribute?.('height') ?? ''), 10)
  return Number.isFinite(height) && height >= 1
}

/**
 * Does this element contribute anything a reader would see — directly or through
 * a descendant?
 *
 * @param {Element | null | undefined} element
 * @returns {boolean}
 */
export function hasContent(element) {
  if (!element) return false
  if (IGNORED_TAGS.has(element.tagName)) return false
  if (isHidden(element)) return false
  if (element.tagName === 'IMG' || element.tagName === 'HR') return true
  if (collapsedText(element) !== '') return true
  if (isVisualCell(element)) return true
  // One pass over the subtree rather than recursing per child.
  for (const inner of Array.from(element.querySelectorAll?.('img, hr, td, th, table, div') ?? [])) {
    if (inner.tagName === 'IMG' || inner.tagName === 'HR') return true
    if (isVisualCell(inner)) return true
  }
  return false
}

/** Wrappers with no meaning of their own — we look straight through them. */
const TRANSPARENT_TAGS = new Set(['TBODY', 'THEAD', 'TFOOT'])

/**
 * Element children that carry content, with `tbody`/`thead`/`tfoot` flattened
 * away. The DOM inserts a `tbody` into every table whether the source had one or
 * not, and treating that as a content node breaks every traversal below it.
 *
 * @param {Element} element
 * @returns {Element[]}
 */
function contentChildren(element) {
  /** @type {Element[]} */
  const out = []
  for (const child of Array.from(element.children ?? [])) {
    if (TRANSPARENT_TAGS.has(child.tagName)) {
      out.push(...contentChildren(child))
    } else if (hasContent(child)) {
      out.push(child)
    }
  }
  return out
}

/**
 * @param {Element} table
 * @returns {Element[]} `tr` elements belonging to this table, not to nested ones
 */
function ownRows(table) {
  return Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table)
}

/**
 * @param {Element} tr
 * @returns {Element[]} `td`/`th` cells belonging to this row, not to nested ones
 */
function ownCells(tr) {
  return Array.from(tr.querySelectorAll('td, th')).filter((td) => td.closest('tr') === tr)
}

/**
 * True when a table is doing layout — more than one cell in a row, or a cell
 * that itself contains another table. Layout tables inside a column cannot be
 * represented in the schema, so they are preserved as raw HTML.
 *
 * @param {Element} table
 * @returns {boolean}
 */
function isLayoutTable(table) {
  for (const tr of ownRows(table)) {
    const cells = ownCells(tr).filter(hasContent)
    if (cells.length > 1) return true
    if (cells.some((td) => td.querySelector('table'))) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// blocks
// ---------------------------------------------------------------------------

/**
 * Try every registered `parse` hook, highest priority first.
 *
 * Custom blocks join import here for free — that is the whole reason `parse` is
 * part of the public `defineBlock` API.
 *
 * @param {Element} element
 * @param {ParseContext} ctx
 * @returns {Block | null}
 */
export function matchBlock(element, ctx) {
  for (const def of parsableBlocks()) {
    let props = null
    try {
      props = def.parse?.(element, ctx) ?? null
    } catch {
      // A third-party parser throwing must not abort the import.
      props = null
    }
    if (props) return createBlock(def.type, props)
  }
  return null
}

/**
 * The lossless fallback. Every unrecognised element ends up here.
 *
 * @param {Element} element
 * @param {ParseContext} ctx
 * @returns {Block}
 */
export function rawBlock(element, ctx) {
  return createBlock('html', {
    html: ctx.detectVars(element.outerHTML ?? ''),
    imported: true,
    padding: spacing(0),
  })
}

/**
 * Does this element hold at most one unit of content?
 *
 * This gate is what stops a parser claiming a container that holds *more* than
 * the thing it matched. `button.parse` looks for an `<a>` with a background
 * anywhere inside the element it is given — so without this check, a three-row
 * content table whose last row happens to hold a button gets claimed as one
 * button block, and the heading and paragraph above it silently disappear.
 *
 * @param {Element} element
 * @returns {boolean}
 */
export function isSingleUnit(element) {
  if (element.tagName === 'TABLE') {
    const rows = ownRows(element).filter(hasContent)
    if (rows.length > 1) return false
    if (rows.length === 0) return true
    return ownCells(rows[0]).filter(hasContent).length <= 1
  }
  return contentChildren(element).length <= 1
}

/**
 * @param {Element} element
 * @returns {boolean} true when some descendant table is doing layout
 */
function containsLayoutTable(element) {
  for (const table of Array.from(element.querySelectorAll?.('table') ?? [])) {
    if (isLayoutTable(table)) return true
  }
  return false
}

/**
 * Claim an element as exactly one block: a parser match if we have one, the
 * lossless raw fallback otherwise.
 *
 * @param {Element} element
 * @param {ParseContext} ctx
 * @param {string[]} unrecognized
 * @returns {Block}
 */
function claim(element, ctx, unrecognized) {
  const block = matchBlock(element, ctx)
  if (block) return block
  const fallback = rawBlock(element, ctx)
  unrecognized.push(fallback.id)
  return fallback
}

/**
 * Blocks inside a table that is not doing layout — a wrapper around one block,
 * which is how every generator (including ours) emits buttons, spacers and
 * dividers.
 *
 * Going through the table's own cells matters: the divider and spacer signatures
 * live on the `<td>` (a 1px cell with a background, a cell with a fixed height),
 * so those parsers never fire if we only ever hand them the table.
 *
 * @param {Element} table
 * @param {ParseContext} ctx
 * @param {string[]} unrecognized
 * @returns {Block[]}
 */
export function blocksFromSimpleTable(table, ctx, unrecognized) {
  if (isSingleUnit(table)) {
    const whole = matchBlock(table, ctx)
    if (whole) return [whole]
  }
  /** @type {Block[]} */
  const out = []
  for (const tr of ownRows(table)) {
    for (const td of ownCells(tr).filter(hasContent)) {
      if (isSingleUnit(td)) {
        const block = matchBlock(td, ctx)
        if (block) {
          out.push(block)
          continue
        }
      }
      out.push(...parseBlocks(td, ctx, unrecognized))
    }
  }
  return out
}

/**
 * Parse the contents of a column-ish container into blocks.
 *
 * @param {Element} container
 * @param {ParseContext} ctx
 * @param {string[]} unrecognized Ids of blocks kept as raw HTML.
 * @returns {Block[]}
 */
export function parseBlocks(container, ctx, unrecognized) {
  /** @type {Block[]} */
  const blocks = []

  // A leaf container — text plus inline markup — is one block, claimed whole.
  // Iterating its children instead would import `Thanks <b>#8842</b> is paid` as
  // a text block containing only "#8842", losing the words around it.
  if (!hasBlockLevelChildren(container)) {
    if (hasContent(container)) blocks.push(claim(container, ctx, unrecognized))
    return blocks
  }

  for (const child of contentChildren(container)) {
    if (child.tagName === 'TABLE') {
      // A nested layout table has no representation inside a column, so keep it
      // whole rather than flattening it and scrambling the design.
      if (isLayoutTable(child)) {
        blocks.push(claim(child, ctx, unrecognized))
      } else {
        blocks.push(...blocksFromSimpleTable(child, ctx, unrecognized))
      }
      continue
    }

    if (isSingleUnit(child)) {
      const block = matchBlock(child, ctx)
      if (block) {
        blocks.push(block)
        continue
      }
    }

    if (hasBlockLevelChildren(child)) {
      const nested = parseBlocks(child, ctx, unrecognized)
      if (nested.length) {
        blocks.push(...nested)
        continue
      }
    }

    blocks.push(claim(child, ctx, unrecognized))
  }

  return blocks
}

// ---------------------------------------------------------------------------
// rows and sections
// ---------------------------------------------------------------------------

/**
 * @param {Element[]} cells
 * @param {ParseContext} ctx
 * @param {string[]} unrecognized
 * @returns {Row}
 */
function rowFromCells(cells, ctx, unrecognized) {
  const declared = cells.map((td) => percentWidth(td))
  const total = declared.reduce((sum, w) => (sum ?? 0) + (w ?? 0), 0) ?? 0
  const widths =
    declared.every((w) => w !== null) && Math.abs(total - 100) <= 6
      ? /** @type {number[]} */ (declared)
      : evenWidths(cells.length)

  const columns = cells.map((td, i) => {
    const style = ctx.style(td)
    return createColumn({
      width: widths[i],
      blocks: parseBlocks(td, ctx, unrecognized),
      props: {
        padding: spacing(0),
        verticalAlign: /** @type {any} */ (
          td.getAttribute?.('valign') || style.verticalAlign || 'top'
        ),
        backgroundColor: String(style.backgroundColor || td.getAttribute?.('bgcolor') || ''),
      },
    })
  })

  return createRow({ children: columns })
}

/**
 * A cell's width as a percentage of its row, when it declares one.
 *
 * @param {Element} td
 * @returns {number | null}
 */
function percentWidth(td) {
  const candidates = [td.getAttribute?.('width'), String(parseStyleAttribute(td).width ?? '')]
  for (const candidate of candidates) {
    if (!candidate) continue
    const match = /^(\d+(?:\.\d+)?)%$/.exec(candidate.trim())
    if (match) return Math.round(Number(match[1]))
  }
  return null
}

/**
 * Walk a table, appending rows. Single-cell rows are transparent wrappers and we
 * descend through them; multi-cell rows become real columns.
 *
 * @param {Element} table
 * @param {Row[]} out
 * @param {ParseContext} ctx
 * @param {string[]} unrecognized
 * @returns {void}
 */
export function walkTable(table, out, ctx, unrecognized) {
  for (const tr of ownRows(table)) {
    const cells = ownCells(tr).filter(hasContent)
    if (cells.length === 0) continue
    if (cells.length > 1) {
      out.push(rowFromCells(cells, ctx, unrecognized))
      continue
    }
    walkContainer(cells[0], out, ctx, unrecognized)
  }
}

/**
 * Walk a container, grouping consecutive leaf children into single-column rows
 * and recursing into nested tables.
 *
 * @param {Element} container
 * @param {Row[]} out
 * @param {ParseContext} ctx
 * @param {string[]} unrecognized
 * @returns {void}
 */
export function walkContainer(container, out, ctx, unrecognized) {
  /** @type {Block[]} */
  let pending = []

  const flush = () => {
    if (!pending.length) return
    out.push(createRow({ children: [createColumn({ width: 100, blocks: pending })] }))
    pending = []
  }

  if (!hasBlockLevelChildren(container)) {
    if (hasContent(container)) pending.push(claim(container, ctx, unrecognized))
    flush()
    return
  }

  for (const child of contentChildren(container)) {
    if (child.tagName === 'TABLE') {
      if (isLayoutTable(child)) {
        flush()
        walkTable(child, out, ctx, unrecognized)
        continue
      }
      pending.push(...blocksFromSimpleTable(child, ctx, unrecognized))
      continue
    }

    // A wrapper div holding a layout table (every div-based builder does this)
    // contributes rows, not blocks.
    if (containsLayoutTable(child)) {
      flush()
      walkContainer(child, out, ctx, unrecognized)
      continue
    }

    if (isSingleUnit(child)) {
      const block = matchBlock(child, ctx)
      if (block) {
        pending.push(block)
        continue
      }
    }

    if (hasBlockLevelChildren(child)) {
      const nested = parseBlocks(child, ctx, unrecognized)
      if (nested.length) {
        pending.push(...nested)
        continue
      }
    }

    pending.push(claim(child, ctx, unrecognized))
  }

  flush()
}

/**
 * Peel off full-width wrapper tables until we reach the level where the real
 * sections live. Almost every email is wrapped in one or two of these.
 *
 * @param {Element} root
 * @returns {Element[]} the tables that should become sections
 */
export function findSectionTables(root) {
  let current = root
  for (let depth = 0; depth < 8; depth += 1) {
    const tables = contentChildren(current).filter((c) => c.tagName === 'TABLE')
    const others = contentChildren(current).filter((c) => c.tagName !== 'TABLE')

    if (tables.length === 0) return []
    if (tables.length > 1 || others.length > 0) return tables

    const table = tables[0]
    const rows = ownRows(table)
    if (rows.length !== 1) return [table]
    const cells = ownCells(rows[0]).filter(hasContent)
    if (cells.length !== 1) return [table]
    const inner = contentChildren(cells[0])
    // Descend only while the wrapper's single cell just holds more tables.
    if (!inner.length || !inner.every((c) => c.tagName === 'TABLE')) return [table]
    current = cells[0]
  }
  return contentChildren(current).filter((c) => c.tagName === 'TABLE')
}

/**
 * @param {Element} table
 * @param {ParseContext} ctx
 * @param {string[]} unrecognized
 * @returns {Section | null}
 */
export function sectionFromTable(table, ctx, unrecognized) {
  /** @type {Row[]} */
  const rows = []
  walkTable(table, rows, ctx, unrecognized)
  if (!rows.length) return null
  const style = ctx.style(table)
  return createSection({
    rows,
    props: {
      padding: spacing(0),
      backgroundColor: String(style.backgroundColor || table.getAttribute?.('bgcolor') || ''),
      backgroundImage: extractUrl(String(style.backgroundImage ?? '')),
    },
  })
}

/**
 * @param {string} value
 * @returns {string}
 */
function extractUrl(value) {
  const match = /url\((['"]?)(.*?)\1\)/.exec(value)
  return match ? match[2] : ''
}
