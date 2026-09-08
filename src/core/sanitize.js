/**
 * Make block markup safe to put into the editor's own DOM.
 *
 * `props.text` on a text or heading block is inline HTML by design, and the
 * canvas writes the rendered block straight into `innerHTML` so that
 * contentEditable has something real to edit. That is a script-execution
 * surface: `innerHTML` never runs a `<script>` element, but it very much
 * attaches `onerror`, `onclick` and `onload` handlers, and those run in the
 * host application's origin. The markup does not have to be typed by the person
 * looking at it — the HTML importer keeps whatever a third-party email brought
 * with it, and a saved document is plain JSON that can come from anywhere.
 *
 * This is deliberately not `normalizeRichText`. That one needs a DOM, rewrites
 * the markup down to an email-safe subset, and is the right tool on the way
 * *out* of a contentEditable element. This one is a narrow, DOM-free pass whose
 * only job is to remove the parts that execute — cheap enough to run on every
 * block on every render, and usable in Node where the importer lives.
 *
 * It never drops text. An element that has to go loses its tag, not its
 * contents, which is the same promise the importer and the rich-text
 * normalizer make.
 *
 * @module mailkiln/core/sanitize
 */

/**
 * Elements whose *contents* are code rather than copy, so unwrapping them would
 * paste the script body into the document as visible text.
 */
const CODE_ELEMENTS = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi

/** The same elements left unclosed — a truncated paste, or a deliberate one. */
const CODE_OPENERS = /<\/?(script|style)\b[^>]*>/gi

/** Elements that load or embed something. No email client renders any of them. */
const EMBEDS = /<\/?(iframe|frame|frameset|object|embed|applet|base|meta|link|form)\b[^>]*>/gi

/** One tag, with its attributes — quoted values may contain `>`. */
const TAG = /<([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^"'>])*?)(\/?)>/g

/** `onclick=…`, in any of the three ways HTML lets you write an attribute. */
const EVENT_ATTR = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi

/** Attributes whose value is a URL the browser may navigate to or fetch. */
const URL_ATTR =
  /(\s(?:href|src|srcdoc|xlink:href|action|formaction|background|poster|data|codebase)\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi

/**
 * A URL that runs code instead of fetching something.
 *
 * Leading control characters and HTML entities are stripped first: browsers
 * ignore both, so `java&#09;script:` and `&#106;avascript:` navigate exactly
 * like the plain spelling.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isExecutableUrl(value) {
  const flat = value
    .replace(/&#x?[0-9a-f]+;?/gi, (entity) => {
      const hex = /^&#x/i.test(entity)
      const digits = entity.replace(/[^0-9a-f]/gi, '')
      const code = parseInt(digits, hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCharCode(code) : ''
    })
    // Everything at or below a space goes. A browser ignores leading control
    // characters, so `java<TAB>script:` navigates like the plain spelling —
    // written as a filter rather than a character class, because a regex with
    // control characters in it is itself easy to get wrong and hard to read.
    .split('')
    .filter((character) => character.charCodeAt(0) > 32)
    .join('')
    .toLowerCase()
  return /^(javascript|vbscript|livescript|mocha):/.test(flat) || /^data:text\/html/.test(flat)
}

/**
 * Strip the executable parts of a fragment of block markup.
 *
 * Everything else is left exactly as it was — this is not a whitelist, and it
 * is not a substitute for one on any path that leaves the editor. It is what
 * makes untrusted markup safe to hand to `innerHTML`.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripUnsafeHtml(html) {
  if (typeof html !== 'string' || !html) return typeof html === 'string' ? html : ''
  if (!html.includes('<')) return html

  return html
    .replace(CODE_ELEMENTS, '')
    .replace(CODE_OPENERS, '')
    .replace(EMBEDS, '')
    .replace(TAG, (match, name, attrs, close) => {
      const cleaned = String(attrs)
        .replace(EVENT_ATTR, '')
        .replace(URL_ATTR, (attr, prefix, double, single, bare) => {
          const value = double ?? single ?? bare ?? ''
          if (!isExecutableUrl(value)) return attr
          // Emptied rather than removed: an `<img>` with no `src` at all draws
          // as broken alt text in some clients, and the author still needs to
          // see that the attribute is there to be fixed.
          return `${prefix}""`
        })
      return `<${name}${cleaned}${close}>`
    })
}
