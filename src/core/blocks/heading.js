/**
 * Heading block. Emits a real `<h1>`–`<h6>` so screen readers and Gmail's
 * "quoted text" collapsing both behave, with margins zeroed because email
 * clients disagree about default heading margins.
 *
 * @module mailforge/core/blocks/heading
 */

import { defineBlock } from '../registry.js'
import { spacing } from '../schema.js'
import { mergeStyles, styleAttr } from '../render/inline.js'
import { el, needsInnerHtml, raw, varsToChildren, varsToTemplate } from '../render/jsxNode.js'
import {
  ALIGN_FIELD,
  BACKGROUND_FIELD,
  FONT_FIELD,
  HIDE_ON_MOBILE_FIELD,
  MOBILE_FONT_SIZE_FIELD,
  PADDING_FIELD,
  commonProps,
  editableAttr,
  mjCommonAttrs,
  stripTags,
} from './shared.js'

/** Default size per level, so switching level looks right without extra edits. */
const LEVEL_SIZE = { 1: 32, 2: 26, 3: 22, 4: 18, 5: 16, 6: 14 }

/**
 * @param {Record<string, any>} p
 * @param {import('../types.js').RenderContext} ctx
 * @returns {import('../types.js').StyleObject}
 */
function typography(p, ctx) {
  return mergeStyles({
    margin: 0,
    padding: 0,
    fontFamily: p.fontFamily || ctx.settings.fontFamily,
    fontSize: p.fontSize || LEVEL_SIZE[/** @type {1} */ (p.level)] || 26,
    fontWeight: p.fontWeight || 'bold',
    lineHeight: p.lineHeight || 1.3,
    letterSpacing: p.letterSpacing,
    color: p.color || ctx.settings.textColor,
    textAlign: p.align,
    msoLineHeightRule: 'exactly',
  })
}

export const headingBlock = defineBlock({
  type: 'heading',
  label: 'Heading',
  group: 'Content',
  icon: 'heading',
  importPriority: 60,
  inlineEdit: 'text',
  defaultProps: commonProps({
    text: 'A headline that earns the open',
    level: 2,
    fontSize: 26,
    lineHeight: 1.3,
    fontWeight: 'bold',
    letterSpacing: '',
    color: '',
    fontFamily: '',
    mobileFontSize: '',
    padding: spacing(12, 24, 4),
  }),
  schema: [
    { key: 'text', type: 'richtext', label: 'Heading', vars: true },
    {
      key: 'level',
      type: 'select',
      label: 'Level',
      options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `H${n}` })),
    },
    { key: 'fontSize', type: 'number', label: 'Size', min: 10, max: 72, group: 'Type' },
    { key: 'lineHeight', type: 'number', label: 'Line height', min: 1, max: 2, step: 0.1, group: 'Type' },
    FONT_FIELD,
    { key: 'color', type: 'color', label: 'Colour', group: 'Type' },
    {
      key: 'letterSpacing',
      type: 'text',
      label: 'Letter spacing',
      placeholder: '-0.02em',
      vars: false,
      group: 'Type',
    },
    ALIGN_FIELD,
    PADDING_FIELD,
    BACKGROUND_FIELD,
    HIDE_ON_MOBILE_FIELD,
    MOBILE_FONT_SIZE_FIELD,
  ],
  render: {
    html(p, ctx) {
      const tag = `h${clampLevel(p.level)}`
      return `<${tag}${editableAttr(ctx, 'text')}${styleAttr(typography(p, ctx))}>${ctx.resolve(p.text ?? '')}</${tag}>`
    },
    jsx(p, ctx) {
      const props = { as: `h${clampLevel(p.level)}`, style: typography(p, ctx) }
      if (needsInnerHtml(p.text)) {
        return el('Heading', {
          ...props,
          dangerouslySetInnerHTML: raw(`{{ __html: ${varsToTemplate(p.text).__raw} }}`),
        })
      }
      return el('Heading', props, varsToChildren(p.text ?? ''))
    },
    mjml(p, ctx) {
      const style = typography(p, ctx)
      return `<mj-text${mjCommonAttrs(p)} font-size="${style.fontSize}px" font-weight="${style.fontWeight}" line-height="${style.lineHeight}" color="${style.color}"><h${clampLevel(p.level)} style="margin:0;font-size:inherit;font-weight:inherit;line-height:inherit;color:inherit">${ctx.resolve(p.text ?? '')}</h${clampLevel(p.level)}></mj-text>`
    },
    text(p, ctx) {
      const value = stripTags(ctx.resolve(p.text ?? ''))
      return value ? `${value}\n${'='.repeat(Math.min(value.length, 60))}` : ''
    },
  },
  parse(element, ctx) {
    const match = /^h([1-6])$/i.exec(element.tagName ?? '')
    if (!match) return null
    const style = ctx.style(element)
    const level = Number(match[1])
    return {
      ...commonProps(),
      text: ctx.detectVars(element.innerHTML ?? ''),
      level,
      fontSize: parseInt(String(style.fontSize ?? ''), 10) || LEVEL_SIZE[/** @type {1} */ (level)],
      lineHeight: parseFloat(String(style.lineHeight ?? '')) || 1.3,
      fontWeight: String(style.fontWeight || 'bold'),
      color: String(style.color ?? ''),
      fontFamily: String(style.fontFamily ?? ''),
      align: /** @type {any} */ (style.textAlign ?? 'left'),
      padding: spacing(0),
    }
  },
})

/**
 * @param {any} level
 * @returns {number}
 */
function clampLevel(level) {
  const n = Number(level)
  return Number.isFinite(n) ? Math.min(6, Math.max(1, Math.round(n))) : 2
}
