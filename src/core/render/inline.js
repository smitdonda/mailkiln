/**
 * Style and markup serialization primitives.
 *
 * This is why mailforge has no `juice` dependency: we own the schema, so styles
 * are written inline at emit time rather than parsed back out of a stylesheet.
 * Deterministic, zero deps, and no CSS parser to be wrong about specificity.
 *
 * @module mailforge/core/render/inline
 */

/** @typedef {import('./../types.js').StyleObject} StyleObject */
/** @typedef {import('./../types.js').Spacing} Spacing */

/**
 * Properties whose numeric values must NOT get a `px` suffix. Same list React
 * uses, trimmed to what email actually supports.
 */
const UNITLESS = new Set([
  'opacity',
  'zIndex',
  'fontWeight',
  'lineHeight',
  'flex',
  'flexGrow',
  'flexShrink',
  'order',
  'zoom',
  'msoTextRaise',
])

/**
 * camelCase -> kebab-case, with the two vendor prefixes email needs.
 *
 * The `.replace(/^-/, '')` is load-bearing: without it `msoPaddingAlt` becomes
 * `mso--padding-alt`, which every client silently ignores. Outlook-only CSS that
 * quietly does nothing is the worst class of bug in this package, since the
 * output still looks correct everywhere you can easily test it.
 *
 * @param {string} prop
 * @returns {string}
 */
export function dashCase(prop) {
  const kebab = (/** @type {string} */ value) =>
    value
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
  if (prop.startsWith('mso')) return `mso-${kebab(prop.slice(3))}`
  if (prop.startsWith('Webkit')) return `-webkit-${kebab(prop.slice(6))}`
  return kebab(prop)
}

/**
 * @param {string | number | undefined | null} value
 * @returns {string}
 */
export function px(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'number') return `${value}px`
  return String(value)
}

/**
 * Serialize a style object to a declaration string.
 *
 * Key order is preserved exactly as authored — the exported code has to diff
 * cleanly in git, so "stable output" beats "sorted output".
 *
 * @param {StyleObject} style
 * @returns {string}
 */
export function styleToString(style) {
  if (!style) return ''
  const out = []
  for (const [key, raw] of Object.entries(style)) {
    if (raw == null || raw === '') continue
    const value = typeof raw === 'number' && !UNITLESS.has(key) ? `${raw}px` : String(raw)
    out.push(`${dashCase(key)}:${value}`)
  }
  return out.join(';')
}

/**
 * @param {StyleObject} style
 * @returns {string} ` style="…"`, or '' when there is nothing to emit
 */
export function styleAttr(style) {
  const css = styleToString(style)
  return css ? ` style="${escapeAttr(css)}"` : ''
}

/**
 * Merge style objects left to right, dropping empty values so a later `''` does
 * not clobber an earlier real value.
 *
 * @param {...(StyleObject | null | undefined | false)} styles
 * @returns {StyleObject}
 */
export function mergeStyles(...styles) {
  /** @type {StyleObject} */
  const out = {}
  for (const style of styles) {
    if (!style) continue
    for (const [key, value] of Object.entries(style)) {
      if (value == null || value === '') continue
      out[key] = value
    }
  }
  return out
}

/**
 * @param {Spacing | undefined | null} value
 * @returns {string} a CSS padding shorthand, or '' when all sides are zero
 */
export function spacingToCss(value) {
  if (!value) return ''
  const { top = 0, right = 0, bottom = 0, left = 0 } = value
  if (!top && !right && !bottom && !left) return ''
  return `${top}px ${right}px ${bottom}px ${left}px`
}

/**
 * @param {Spacing | undefined | null} value
 * @returns {boolean}
 */
export function hasSpacing(value) {
  return spacingToCss(value) !== ''
}

/**
 * Escape text for HTML body content.
 *
 * @param {any} text
 * @returns {string}
 */
export function escapeHtml(text) {
  if (text == null) return ''
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Escape a value for use inside a double-quoted attribute.
 *
 * @param {any} value
 * @returns {string}
 */
export function escapeAttr(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Serialize attributes. `false`/`null`/`undefined`/`''` are skipped, `true`
 * emits a bare attribute.
 *
 * @param {Record<string, any>} map
 * @returns {string} leading-space-prefixed attribute string
 */
export function attrs(map) {
  let out = ''
  for (const [key, value] of Object.entries(map ?? {})) {
    if (value == null || value === false || value === '') continue
    if (value === true) out += ` ${key}`
    else out += ` ${key}="${escapeAttr(value)}"`
  }
  return out
}

/**
 * A `role="presentation"` table with every attribute email clients need. Every
 * layout table in the output goes through here so none of them can drift.
 *
 * @param {object} [options]
 * @param {string | number} [options.width]
 * @param {string} [options.align]
 * @param {string} [options.className]
 * @param {StyleObject} [options.style]
 * @param {Record<string, any>} [options.extra]
 * @returns {string} the opening `<table …>` tag
 */
export function tableOpen({ width, align, className, style, extra } = {}) {
  return `<table${attrs({
    role: 'presentation',
    class: className,
    width,
    align,
    border: '0',
    cellpadding: '0',
    cellspacing: '0',
    ...extra,
  })}${styleAttr(mergeStyles({ borderCollapse: 'collapse' }, style))}>`
}

/** Closing tag counterpart to {@link tableOpen}, kept adjacent for symmetry. */
export const TABLE_CLOSE = '</table>'

/**
 * Wrap content in an Outlook-only conditional comment.
 *
 * @param {string} content
 * @param {string} [condition]
 * @returns {string}
 */
export function mso(content, condition = 'mso') {
  return `<!--[if ${condition}]>${content}<![endif]-->`
}

/**
 * Wrap content so that only non-Outlook clients see it.
 *
 * @param {string} content
 * @returns {string}
 */
export function notMso(content) {
  return `<!--[if !mso]><!-->${content}<!--<![endif]-->`
}

/**
 * Indent a multi-line fragment. Purely cosmetic — the HTML output is meant to
 * be readable, since "code you own" is a selling point of this package.
 *
 * @param {string} content
 * @param {number} [depth]
 * @returns {string}
 */
export function indent(content, depth = 1) {
  const pad = '  '.repeat(depth)
  return content
    .split('\n')
    .map((line) => (line.trim() === '' ? line : pad + line))
    .join('\n')
}
