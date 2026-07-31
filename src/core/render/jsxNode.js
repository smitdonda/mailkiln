/**
 * The tiny JSX AST that blocks build, plus the merge-var → JSX conversions.
 *
 * Blocks return nodes rather than strings so the emitter owns indentation and
 * prop order. That is what makes the exported code byte-stable, which is what
 * makes it diffable in the consumer's git history — a real requirement of
 * "eject to code you own", not a nicety.
 *
 * @module mailforge/core/render/jsxNode
 */

import { VAR_PATTERN } from '../vars.js'

/** @typedef {import('../types.js').JsxElement} JsxElement */
/** @typedef {import('../types.js').JsxRaw} JsxRaw */
/** @typedef {import('../types.js').JsxNode} JsxNode */

/**
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {JsxNode | JsxNode[]} [children]
 * @returns {JsxElement}
 */
export function el(tag, props = {}, children = []) {
  const list = Array.isArray(children) ? children : [children]
  const kept = list.filter((c) => c !== null && c !== undefined && c !== '')
  return { tag, props, children: kept, selfClose: kept.length === 0 }
}

/**
 * Mark a string as a raw expression to emit verbatim (`{user.name}`, a template
 * literal, an object literal…).
 *
 * @param {string} code
 * @returns {JsxRaw}
 */
export function raw(code) {
  return { __raw: code }
}

/**
 * @param {any} node
 * @returns {node is JsxRaw}
 */
export function isRaw(node) {
  return !!node && typeof node === 'object' && typeof node.__raw === 'string'
}

/**
 * @param {any} node
 * @returns {node is JsxElement}
 */
export function isElement(node) {
  return !!node && typeof node === 'object' && typeof node.tag === 'string'
}

/**
 * Wrap a node in a conditional: `{user.isPro && (…)}`.
 *
 * This is the payoff of ejecting to code rather than to HTML. Unlayer has to bake
 * its customer's ESP template syntax into the output; we emit an expression the
 * consumer's own bundler type-checks.
 *
 * @param {string} expression
 * @param {JsxNode} child
 * @returns {import('../types.js').JsxGuard}
 */
export function guard(expression, child) {
  return { __guard: expression, child }
}

/**
 * @param {any} node
 * @returns {node is import('../types.js').JsxGuard}
 */
export function isGuard(node) {
  return !!node && typeof node === 'object' && typeof node.__guard === 'string'
}

/**
 * Wrap a node in a map: `{order.items.map((item, itemIndex) => (…))}`.
 *
 * @param {string} expression The array to iterate.
 * @param {string} params The arrow's parameter list, e.g. `item, itemIndex`.
 * @param {JsxNode} child
 * @returns {import('../types.js').JsxLoop}
 */
export function loop(expression, params, child) {
  return { __loop: expression, params, child }
}

/**
 * @param {any} node
 * @returns {node is import('../types.js').JsxLoop}
 */
export function isLoop(node) {
  return !!node && typeof node === 'object' && typeof node.__loop === 'string'
}

/** Characters that cannot appear literally in JSX text. */
const JSX_TEXT_UNSAFE = /[{}<>]/

/**
 * @param {string} segment
 * @returns {JsxNode}
 */
function literal(segment) {
  if (/^\s+$/.test(segment)) return raw(`{${JSON.stringify(segment)}}`)
  return JSX_TEXT_UNSAFE.test(segment) ? raw(`{${JSON.stringify(segment)}}`) : segment
}

/**
 * Turn `"Hi {{user.name}}"` into JSX children: `Hi ` + `{user.name}`.
 *
 * This is the heart of pillar 4 in the export: a merge tag becomes a real prop
 * reference, so the ejected component is typed and refactorable rather than a
 * string with placeholders in it.
 *
 * @param {string} text
 * @returns {JsxNode[]}
 */
export function varsToChildren(text) {
  const src = typeof text === 'string' ? text : ''
  if (!src) return []
  /** @type {JsxNode[]} */
  const out = []
  let last = 0
  for (const match of src.matchAll(VAR_PATTERN)) {
    const at = /** @type {number} */ (match.index)
    if (at > last) out.push(literal(src.slice(last, at)))
    out.push(raw(`{${match[1]}}`))
    last = at + match[0].length
  }
  if (last < src.length) out.push(literal(src.slice(last)))
  return out
}

/**
 * Turn text into a JS string expression, using a template literal when merge
 * vars are present. Used for `dangerouslySetInnerHTML` and attribute values.
 *
 * @param {string} text
 * @returns {JsxRaw}
 */
export function varsToTemplate(text) {
  const src = typeof text === 'string' ? text : ''
  if (!src.includes('{{')) return raw(JSON.stringify(src))
  const escaped = src
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(VAR_PATTERN, (_whole, path) => `\${${path}}`)
  return raw(`\`${escaped}\``)
}

/**
 * Attribute value that may contain merge vars: `href="{{link}}"` becomes
 * `href={link}` or `href={`…${link}…`}`.
 *
 * @param {string} text
 * @returns {string | JsxRaw}
 */
export function varsToAttr(text) {
  const src = typeof text === 'string' ? text : ''
  if (!src.includes('{{')) return src
  const only = src.match(new RegExp(`^\\s*${VAR_PATTERN.source}\\s*$`))
  if (only) return raw(`{${only[1]}}`)
  const tpl = varsToTemplate(src)
  return raw(`{${tpl.__raw}}`)
}

/**
 * True when a string carries markup we cannot safely emit as JSX children
 * (a stray `<br>`, an unclosed tag). Those go through
 * `dangerouslySetInnerHTML` so the exported file always compiles.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function needsInnerHtml(text) {
  return typeof text === 'string' && /<[a-z!/]/i.test(text)
}
