/**
 * DOM parsing adapter.
 *
 * The importer is browser-first: `DOMParser` is built in, so the common case has
 * zero dependencies. In Node there is no DOM, so the caller injects one —
 * `linkedom` is an *optional* peer dependency and the error message says exactly
 * what to do. We never import it ourselves; a headless dependency that most
 * consumers don't need has no business in the install.
 *
 * @module mailkiln/core/import/parseAdapter
 */

/**
 * @param {object} [options]
 * @param {(html: string) => Document} [options.parseHtml]
 * @returns {(html: string) => Document}
 */
export function getParser(options = {}) {
  if (typeof options.parseHtml === 'function') return options.parseHtml

  const DomParser = /** @type {any} */ (globalThis).DOMParser
  if (typeof DomParser === 'function') {
    return (html) => {
      const doc = new DomParser().parseFromString(html, 'text/html')
      if (!doc) throw new Error('mailkiln: DOMParser returned no document.')
      return doc
    }
  }

  throw new Error(
    [
      'mailkiln: no DOM parser available.',
      'In a browser this uses the built-in DOMParser. In Node, install linkedom and pass it in:',
      '',
      "  import { parseHTML } from 'linkedom'",
      "  importFromHtml(html, { parseHtml: (h) => parseHTML(h).document })",
      '',
      'linkedom is an optional peer dependency — mailkiln never imports it for you.',
    ].join('\n'),
  )
}

/**
 * Parse a `style="…"` attribute into a camelCase style object.
 *
 * We read the attribute string rather than `element.style` on purpose: DOM
 * implementations disagree about what they expose there (linkedom in particular),
 * and doing it ourselves makes the importer behave identically everywhere.
 *
 * @param {Element | null | undefined} element
 * @returns {import('../types.js').StyleObject}
 */
export function parseStyleAttribute(element) {
  /** @type {import('../types.js').StyleObject} */
  const out = {}
  const raw = element?.getAttribute?.('style')
  if (!raw) return out
  for (const declaration of raw.split(';')) {
    const at = declaration.indexOf(':')
    if (at === -1) continue
    const prop = declaration.slice(0, at).trim()
    const value = declaration.slice(at + 1).trim()
    if (!prop || !value) continue
    out[camelize(prop)] = value
  }
  return out
}

/**
 * @param {string} prop
 * @returns {string}
 */
export function camelize(prop) {
  return prop
    .replace(/^-ms-/, 'ms-')
    .replace(/^-webkit-/, 'Webkit-')
    .replace(/-([a-z])/g, (_m, c) => c.toUpperCase())
}

/**
 * Non-breaking space, written as an escape so no editor or formatter can
 * silently normalize it into a regular space and break spacer detection.
 */
const NBSP = '\u00a0'

/**
 * Collapsed visible text of an element. `&nbsp;` counts as whitespace, not
 * content — otherwise every spacer cell in the source imports as a text block.
 *
 * @param {Element | null | undefined} element
 * @returns {string}
 */
export function collapsedText(element) {
  const text = element?.textContent ?? ''
  return text.split(NBSP).join(' ').replace(/\s+/g, ' ').trim()
}
