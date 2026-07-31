/**
 * Field definitions and small helpers shared by the built-in blocks.
 *
 * Nothing here is privileged — a third-party block can import the same helpers,
 * which is the point: built-ins are just the first nine consumers of the public
 * `defineBlock` API.
 *
 * @module mailforge/core/blocks/shared
 */

import { spacing } from '../schema.js'
import { escapeAttr, spacingToCss } from '../render/inline.js'

/** @typedef {import('../types.js').FieldDef} FieldDef */
/** @typedef {import('../types.js').Spacing} Spacing */

/**
 * Tags whose presence means an element is a container rather than a run of text.
 * Shared by the text block's `parse` hook and by the importer's walker, so both
 * agree on what "a leaf" is.
 */
export const BLOCK_LEVEL_TAGS =
  /^(H[1-6]|TABLE|TBODY|THEAD|TFOOT|TR|TD|TH|DIV|P|IMG|HR|UL|OL|LI|BLOCKQUOTE|CENTER|FIGURE|SECTION|ARTICLE)$/

/**
 * True when an element has element children that are block-level — i.e. it is a
 * container, not a leaf whose text we can claim wholesale.
 *
 * @param {Element | null | undefined} element
 * @returns {boolean}
 */
export function hasBlockLevelChildren(element) {
  for (const child of Array.from(element?.children ?? [])) {
    if (BLOCK_LEVEL_TAGS.test(child.tagName ?? '')) return true
  }
  return false
}

/** @type {FieldDef} */
export const PADDING_FIELD = { key: 'padding', type: 'spacing', label: 'Padding', group: 'Layout' }

/** @type {FieldDef} */
export const ALIGN_FIELD = { key: 'align', type: 'align', label: 'Align', group: 'Layout' }

/** @type {FieldDef} */
export const BACKGROUND_FIELD = {
  key: 'backgroundColor',
  type: 'color',
  label: 'Background',
  group: 'Layout',
}

/**
 * Hide this block on narrow screens.
 *
 * The renderer has always emitted a `.mf-hide-sm{display:none}` rule and nothing
 * ever set the class — a capability with no way to reach it. This is the switch.
 *
 * @type {FieldDef}
 */
export const HIDE_ON_MOBILE_FIELD = {
  key: 'hideOnMobile',
  type: 'toggle',
  label: 'Hide on mobile',
  group: 'Mobile',
}

/**
 * Font size below the mobile breakpoint. Empty means "same as desktop".
 *
 * Only blocks that render text offer it — a mobile font size on a spacer is a
 * field nobody can use.
 *
 * @type {FieldDef}
 */
export const MOBILE_FONT_SIZE_FIELD = {
  key: 'mobileFontSize',
  type: 'number',
  label: 'Mobile font size',
  min: 8,
  max: 72,
  group: 'Mobile',
  help: 'Applied below the mobile breakpoint. Leave empty to keep the desktop size.',
}

/**
 * Web-safe stacks, plus "inherit from document" as the default.
 *
 * @type {Array<{ value: string, label: string }>}
 */
export const FONT_OPTIONS = [
  { value: '', label: 'Document default' },
  { value: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", label: 'System sans' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: 'Helvetica' },
  { value: "Georgia, 'Times New Roman', serif", label: 'Georgia' },
  { value: "'Times New Roman', Times, serif", label: 'Times' },
  { value: "'Courier New', Courier, monospace", label: 'Courier' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: "Tahoma, Verdana, Segoe, sans-serif", label: 'Tahoma' },
]

/** @type {FieldDef} */
export const FONT_FIELD = {
  key: 'fontFamily',
  type: 'select',
  label: 'Font',
  options: FONT_OPTIONS,
  group: 'Type',
}

/** @type {Array<{ value: string, label: string }>} */
export const WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Regular' },
  { value: 'bold', label: 'Bold' },
  { value: '300', label: 'Light' },
  { value: '600', label: 'Semibold' },
]

/**
 * Props every block shares, so the wrapper renderer can rely on them.
 *
 * @param {Record<string, any>} [extra]
 * @returns {Record<string, any>}
 */
export function commonProps(extra = {}) {
  return {
    padding: spacing(8, 24),
    align: /** @type {import('../types.js').Align} */ ('left'),
    backgroundColor: '',
    hideOnMobile: false,
    ...extra,
  }
}

/**
 * MJML puts padding, alignment and cell background on the component itself
 * rather than on a wrapper, so blocks emit them via this helper.
 *
 * @param {Record<string, any>} props
 * @param {object} [options]
 * @param {boolean} [options.align] Include the `align` attribute.
 * @returns {string} attribute string with a leading space, or ''
 */
export function mjCommonAttrs(props, options = {}) {
  let out = ''
  const padding = spacingToCss(props.padding)
  out += padding ? ` padding="${padding}"` : ' padding="0"'
  if (options.align !== false && props.align) out += ` align="${escapeAttr(props.align)}"`
  if (props.backgroundColor) {
    out += ` container-background-color="${escapeAttr(props.backgroundColor)}"`
  }
  return out
}

/**
 * Marks the element that holds an inline-editable prop, but only when the canvas
 * asks for it — every export path leaves `ctx.options.editable` unset, so this
 * never reaches a real email.
 *
 * The editor cannot infer this element: the rendered block is a wrapper table
 * around styled markup, and reaching for "the first child" writes the table's own
 * HTML back into the prop.
 *
 * @param {import('../types.js').RenderContext} ctx
 * @param {string} propKey
 * @returns {string} an attribute string with a leading space, or ''
 */
export function editableAttr(ctx, propKey) {
  return ctx.options?.editable ? ` data-mf-edit="${propKey}"` : ''
}

/**
 * Strip tags and decode the handful of entities our own renderers emit. Used by
 * the plain-text target and by lint rules that need visible copy.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripTags(html) {
  if (typeof html !== 'string') return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&zwnj;/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Normalize a width prop that may be a number (px) or a string ('100%').
 *
 * @param {string | number | undefined} value
 * @param {number} fallback
 * @returns {{ css: string, attr: string | undefined, isPercent: boolean }}
 */
export function widthValue(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { css: `${value}px`, attr: String(value), isPercent: false }
  }
  const str = String(value ?? '').trim()
  if (str.endsWith('%')) return { css: str, attr: undefined, isPercent: true }
  if (/^\d+(\.\d+)?px$/.test(str)) {
    return { css: str, attr: String(parseInt(str, 10)), isPercent: false }
  }
  if (/^\d+$/.test(str)) return { css: `${str}px`, attr: str, isPercent: false }
  return { css: `${fallback}px`, attr: String(fallback), isPercent: false }
}
