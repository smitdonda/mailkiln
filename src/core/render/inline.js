/**
 * Style and markup serialization primitives.
 *
 * This is why mailkiln has no `juice` dependency: we own the schema, so styles
 * are written inline at emit time rather than parsed back out of a stylesheet.
 * Deterministic, zero deps, and no CSS parser to be wrong about specificity.
 *
 * @module mailkiln/core/render/inline
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
 * Give every `<a>` in a fragment an explicit colour.
 *
 * `settings.linkColor` used to reach nothing but the video block's caption: the
 * head stylesheet is stripped by several clients and ignored by Outlook, and an
 * anchor does not inherit the colour of the `<div>` it sits in — so a link typed
 * into a text block rendered in the client's default blue-violet no matter what
 * the template said. The colour therefore has to be inlined on the tag itself.
 *
 * An anchor that already carries its own `color` is left alone: an author who
 * coloured one link meant it.
 *
 * @param {string} html
 * @param {string | undefined | null} color
 * @returns {string}
 */
export function withLinkColor(html, color) {
  if (!color || typeof html !== 'string' || !/<a\b/i.test(html)) return String(html ?? '')
  return html.replace(/<a\b([^>]*)>/gi, (match, rawAttrs) => {
    const style = /\sstyle\s*=\s*"([^"]*)"/i.exec(rawAttrs)
    if (style && /(^|;)\s*color\s*:/i.test(style[1])) return match
    if (style) {
      const merged = `${style[1].trim().replace(/;$/, '')};color:${color}`
      return `<a${rawAttrs.replace(style[0], ` style="${escapeAttr(merged)}"`)}>`
    }
    return `<a${rawAttrs} style="color:${escapeAttr(color)}">`
  })
}

/**
 * Give every `<p>` in a fragment an explicit bottom margin.
 *
 * A `<p>` inside a text block otherwise falls back to the client's default
 * margin — 1em in most, zero in a few — so the same template has different
 * paragraph rhythm in Gmail and Outlook. There is nowhere to put a stylesheet
 * rule for it, since the block emits one `<div>` and the paragraphs are inside
 * the author's own markup.
 *
 * @param {string} html
 * @param {number | string | undefined | null} spacing Bottom margin in px.
 * @returns {string}
 */
export function withParagraphSpacing(html, spacing) {
  // Empty means "client default", and `Number('')` is 0 — which would write
  // `margin:0 0 0px` onto every paragraph of every template that never touched
  // the field.
  if (spacing === '' || spacing == null) return String(html ?? '')
  const gap = Number(spacing)
  if (!Number.isFinite(gap) || gap < 0) return String(html ?? '')
  if (typeof html !== 'string' || !/<p\b/i.test(html)) return String(html ?? '')
  const margin = `margin:0 0 ${gap}px`
  return html.replace(/<p\b([^>]*)>/gi, (match, rawAttrs) => {
    const style = /\sstyle\s*=\s*"([^"]*)"/i.exec(rawAttrs)
    if (style && /(^|;)\s*margin(-bottom)?\s*:/i.test(style[1])) return match
    if (style) {
      const merged = `${margin};${style[1].trim().replace(/^;/, '')}`
      return `<p${rawAttrs.replace(style[0], ` style="${escapeAttr(merged)}"`)}>`
    }
    return `<p${rawAttrs} style="${escapeAttr(margin)}">`
  })
}

/**
 * The four border sides of a row, column or section, as a style object.
 *
 * Rows and columns take borders per side rather than one shorthand because the
 * common use is a single edge — the hairline gutter between two cards — and a
 * shorthand cannot express that.
 *
 * @param {Record<string, any> | undefined | null} props
 * @returns {StyleObject}
 */
export function borderStyles(props) {
  return {
    borderTop: props?.borderTop || '',
    borderRight: props?.borderRight || '',
    borderBottom: props?.borderBottom || '',
    borderLeft: props?.borderLeft || '',
  }
}

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
