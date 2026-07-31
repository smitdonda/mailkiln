/**
 * Email-safe rich-text normalization.
 *
 * `contentEditable` is the only practical way to edit text in place, and it
 * produces markup no email client should ever receive: `execCommand` emits
 * `<span style="font-weight:700">`, `<font>` and `<div>` wrappers, and pasting
 * from Word or Google Docs drags in class names, `mso-` properties and whole
 * nested tables. Everything that comes back out of a contentEditable element
 * goes through here first.
 *
 * Two rules shape the implementation:
 *
 *   1. **Unwrap, never drop.** An element that is not allowed loses its tag but
 *      keeps its text. Same guarantee the HTML importer makes — editing a block
 *      must not be able to delete the author's words.
 *   2. **Map before discarding.** `<span style="font-weight:bold">` becomes
 *      `<b>`, not nothing. Formatting survives the trip even when the browser
 *      expressed it in a way email cannot use.
 *
 * Lives in core, so it is testable without a browser and reusable by the
 * importer. It borrows the importer's parser adapter rather than requiring a
 * DOM: built-in `DOMParser` in a browser, injected `linkedom` in Node.
 *
 * @module mailforge/core/richtext
 */

import { getParser, parseStyleAttribute } from './import/parseAdapter.js'
import { escapeHtml, escapeAttr } from './render/inline.js'

/**
 * Tags that survive as themselves. Everything here is inline-safe in email —
 * no block layout, no positioning, nothing Outlook renders differently.
 */
export const RICHTEXT_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'A',
  'BR',
  'UL',
  'OL',
  'LI',
  'SPAN',
])

/** Emitted without a closing tag. */
const VOID_TAGS = new Set(['BR'])

/**
 * Block-level elements: unwrapped, but they leave a line break behind so
 * paragraph structure is not silently flattened into one run-on sentence.
 */
const BREAK_AFTER = new Set([
  'DIV',
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'TR',
  'SECTION',
  'ARTICLE',
])

/** Dropped entirely — content included. Nothing here is readable copy. */
const DROP_ENTIRELY = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'NOSCRIPT'])

/**
 * CSS properties allowed to survive on `<a>` and `<span>`.
 *
 * A blanket style strip would be simpler and wrong: the starter templates and
 * the showcase both contain `<a href="…" style="color:#5c6779">`, and stripping
 * that would silently recolour every footer link the first time someone edited
 * it.
 */
const STYLE_WHITELIST = new Set(['color', 'background-color', 'text-decoration'])

/** URL schemes we will keep on an anchor. Anything else loses the link. */
const SAFE_HREF = /^(https?:|mailto:|tel:|sms:|#|\/|\{\{)/i

/**
 * @param {string} value
 * @returns {boolean}
 */
function isBoldWeight(value) {
  const weight = String(value ?? '').trim().toLowerCase()
  return weight === 'bold' || weight === 'bolder' || Number(weight) >= 600
}

/**
 * Semantic tags implied by an element's inline styles.
 *
 * @param {import('./types.js').StyleObject} style
 * @returns {string[]} tag names to wrap the content in, outermost first
 */
function impliedTags(style) {
  /** @type {string[]} */
  const tags = []
  if (style.fontWeight && isBoldWeight(String(style.fontWeight))) tags.push('b')
  if (String(style.fontStyle ?? '').toLowerCase() === 'italic') tags.push('i')
  const decoration = String(style.textDecoration ?? style.textDecorationLine ?? '').toLowerCase()
  if (decoration.includes('underline')) tags.push('u')
  if (decoration.includes('line-through')) tags.push('s')
  return tags
}

/**
 * The style attribute an element keeps, reduced to the whitelist. Properties
 * that became semantic tags are removed so formatting is not applied twice.
 *
 * @param {import('./types.js').StyleObject} style
 * @returns {string}
 */
function keptStyle(style) {
  /** @type {string[]} */
  const out = []
  for (const [key, value] of Object.entries(style)) {
    const prop = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    if (!STYLE_WHITELIST.has(prop)) continue
    // `text-decoration:underline` already became a <u>; keeping it here too
    // would double up.
    if (prop === 'text-decoration') {
      const rest = String(value)
        .split(/\s+/)
        .filter((part) => part !== 'underline' && part !== 'line-through')
        .join(' ')
      if (!rest || rest === 'none') continue
      out.push(`text-decoration:${rest}`)
      continue
    }
    out.push(`${prop}:${String(value).trim()}`)
  }
  return out.join(';')
}

/**
 * @param {any} element
 * @returns {string}
 */
function anchorHref(element) {
  const href = String(element.getAttribute?.('href') ?? '').trim()
  return SAFE_HREF.test(href) ? href : ''
}

/**
 * Normalize a fragment of contentEditable or pasted HTML down to email-safe
 * inline markup.
 *
 * Idempotent: normalizing already-normalized markup returns it unchanged, which
 * matters because this runs on every commit.
 *
 * @param {string} html
 * @param {object} [options]
 * @param {(html: string) => Document} [options.parseHtml] Required outside a browser.
 * @returns {string}
 */
export function normalizeRichText(html, options = {}) {
  const source = typeof html === 'string' ? html : ''
  if (source.trim() === '') return ''
  // Nothing to parse: plain text with no markup is already normal.
  if (!source.includes('<') && !source.includes('&')) return collapse(source)

  const parse = getParser(options)
  // The full `<html><body>` wrapper is not decoration: linkedom silently
  // mangles a bare fragment (it drops all but the last node), and this is the
  // one form both it and `DOMParser` agree on. A pasted document that already
  // has its own <html>/<body> nests harmlessly — both are unwrapped below.
  const doc = parse(`<html><body>${source}</body></html>`)
  const root = doc.body ?? doc.documentElement
  if (!root) return collapse(escapeHtml(source))

  return collapse(serializeChildren(root))
}

/**
 * @param {any} parent
 * @returns {string}
 */
function serializeChildren(parent) {
  let out = ''
  for (const node of Array.from(parent.childNodes ?? [])) {
    out += serializeNode(node)
  }
  return out
}

/**
 * @param {any} node
 * @returns {string}
 */
function serializeNode(node) {
  // Text
  if (node.nodeType === 3) return escapeHtml(node.nodeValue ?? '')
  // Anything that is not an element (comments, CDATA) contributes nothing.
  if (node.nodeType !== 1) return ''

  const tag = String(node.tagName ?? '').toUpperCase()
  if (DROP_ENTIRELY.has(tag)) return ''

  if (tag === 'BR') return '<br />'

  const style = parseStyleAttribute(node)
  const inner = serializeChildren(node)

  if (tag === 'A') {
    const href = anchorHref(node)
    // An unsafe or missing href loses the anchor but keeps the words.
    if (!href) return wrap(inner, impliedTags(style), keptStyle(style))
    const css = keptStyle(style)
    const attrs =
      ` href="${escapeAttr(href)}" target="_blank" rel="noopener"` +
      (css ? ` style="${escapeAttr(css)}"` : '')
    return inner || href ? `<a${attrs}>${inner}</a>` : ''
  }

  if (RICHTEXT_TAGS.has(tag) && tag !== 'SPAN') {
    if (!inner && !VOID_TAGS.has(tag)) return ''
    return `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`
  }

  // SPAN, FONT and every unknown element: keep whatever formatting their styles
  // implied, then unwrap.
  const implied = impliedTags(style)
  const css = tag === 'SPAN' ? keptStyle(style) : ''
  const wrapped = wrap(inner, implied, css)

  return BREAK_AFTER.has(tag) && wrapped.trim() !== '' ? `${wrapped}<br />` : wrapped
}

/**
 * @param {string} inner
 * @param {string[]} tags
 * @param {string} css
 * @returns {string}
 */
function wrap(inner, tags, css) {
  if (!inner) return ''
  let out = inner
  if (css) out = `<span style="${escapeAttr(css)}">${out}</span>`
  for (const tag of [...tags].reverse()) out = `<${tag}>${out}</${tag}>`
  return out
}

/**
 * Tidy the serialized result: no leading/trailing breaks, no runs of three or
 * more, no empty formatting tags left behind by an unwrap.
 *
 * @param {string} html
 * @returns {string}
 */
function collapse(html) {
  let out = html

  // Repeat: removing one empty tag can expose another (`<b><i></i></b>`).
  for (let pass = 0; pass < 4; pass += 1) {
    const before = out
    out = out.replace(/<(b|i|u|s|span|a)\b[^>]*>\s*<\/\1>/g, '')
    if (out === before) break
  }

  return (
    out
      // Source indentation is not content. U+00A0 is deliberately excluded
      // from this class (`s` would have matched it) — contentEditable writes a
      // non-breaking space whenever you type two in a row, and collapsing those
      // would eat spacing the author asked for.
      .replace(/[ \t\r\n\f]+/g, ' ')
      .replace(/ ?<br \/> ?/g, '<br />')
      .replace(/(?:<br \/>){3,}/g, '<br /><br />')
      .replace(/^(?:[ \t\r\n\f]|<br \/>)+/, '')
      .replace(/(?:[ \t\r\n\f]|<br \/>)+$/, '')
  )
}

/**
 * Turn a clipboard payload into markup safe to insert. Prefers the HTML
 * flavour, falls back to escaped plain text with newlines preserved.
 *
 * @param {object} payload
 * @param {string} [payload.html]
 * @param {string} [payload.text]
 * @param {object} [options]
 * @param {(html: string) => Document} [options.parseHtml]
 * @returns {string}
 */
export function normalizePastedHtml({ html, text } = {}, options = {}) {
  if (html && html.trim()) return normalizeRichText(html, options)
  if (!text) return ''
  return collapse(escapeHtml(text).replace(/\r?\n/g, '<br />'))
}
