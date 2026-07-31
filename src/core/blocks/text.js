/**
 * Text block. Inline HTML (`<b>`, `<i>`, `<a>`, `<br>`, `<span>`) is allowed in
 * `props.text` — the canvas edits it in place and the exported JSX falls back to
 * `dangerouslySetInnerHTML` when markup is present, so the output always
 * compiles no matter what the author typed.
 *
 * @module mailforge/core/blocks/text
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
  WEIGHT_OPTIONS,
  commonProps,
  editableAttr,
  hasBlockLevelChildren,
  mjCommonAttrs,
  stripTags,
} from './shared.js'

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
    fontSize: p.fontSize,
    fontWeight: p.fontWeight === 'normal' ? '' : p.fontWeight,
    lineHeight: p.lineHeight,
    letterSpacing: p.letterSpacing,
    color: p.color || ctx.settings.textColor,
    textAlign: p.align,
    // Outlook ignores `line-height` on block elements without this.
    msoLineHeightRule: 'exactly',
  })
}

export const textBlock = defineBlock({
  type: 'text',
  label: 'Text',
  group: 'Content',
  icon: 'text',
  importPriority: 10,
  inlineEdit: 'text',
  defaultProps: commonProps({
    text: 'Write something worth reading.',
    fontSize: 16,
    lineHeight: 1.6,
    fontWeight: 'normal',
    letterSpacing: '',
    color: '',
    fontFamily: '',
    mobileFontSize: '',
  }),
  schema: [
    {
      key: 'text',
      type: 'richtext',
      label: 'Text',
      vars: true,
      help: 'Inline HTML is allowed. Type {{ for merge variables.',
    },
    { key: 'fontSize', type: 'number', label: 'Size', min: 8, max: 72, group: 'Type' },
    { key: 'lineHeight', type: 'number', label: 'Line height', min: 1, max: 3, step: 0.1, group: 'Type' },
    { key: 'fontWeight', type: 'select', label: 'Weight', options: WEIGHT_OPTIONS, group: 'Type' },
    FONT_FIELD,
    { key: 'color', type: 'color', label: 'Colour', group: 'Type' },
    {
      key: 'letterSpacing',
      type: 'text',
      label: 'Letter spacing',
      placeholder: '0.02em',
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
      return `<div${editableAttr(ctx, 'text')}${styleAttr(typography(p, ctx))}>${ctx.resolve(p.text ?? '')}</div>`
    },
    jsx(p, ctx) {
      const style = typography(p, ctx)
      if (needsInnerHtml(p.text)) {
        return el('Text', {
          style,
          dangerouslySetInnerHTML: raw(`{{ __html: ${varsToTemplate(p.text).__raw} }}`),
        })
      }
      return el('Text', { style }, varsToChildren(p.text ?? ''))
    },
    mjml(p, ctx) {
      const attrs = [
        mjCommonAttrs(p),
        p.fontSize ? ` font-size="${p.fontSize}px"` : '',
        p.lineHeight ? ` line-height="${p.lineHeight}"` : '',
        p.fontWeight && p.fontWeight !== 'normal' ? ` font-weight="${p.fontWeight}"` : '',
        p.color || ctx.settings.textColor ? ` color="${p.color || ctx.settings.textColor}"` : '',
        p.fontFamily || ctx.settings.fontFamily
          ? ` font-family="${p.fontFamily || ctx.settings.fontFamily}"`
          : '',
      ].join('')
      return `<mj-text${attrs}>${ctx.resolve(p.text ?? '')}</mj-text>`
    },
    text(p, ctx) {
      return stripTags(ctx.resolve(p.text ?? ''))
    },
  },
  parse(element, ctx) {
    const html = element.innerHTML?.trim() ?? ''
    if (!html) return null
    if (!ctx.text(element)) return null
    // Only claim *leaf* text containers. Text has the lowest import priority so
    // it acts as the catch-all, which means without this check a `<td>` wrapping
    // an `<h2>` would be claimed as a text block and the heading parser would
    // never see it. Inline markup (<b>, <a>, <br>) is fine and stays in `text`.
    if (hasBlockLevelChildren(element)) return null
    const style = ctx.style(element)
    return {
      ...commonProps(),
      text: ctx.detectVars(html),
      fontSize: parseInt(String(style.fontSize ?? ''), 10) || 16,
      lineHeight: parseFloat(String(style.lineHeight ?? '')) || 1.6,
      fontWeight: style.fontWeight === 'bold' || style.fontWeight === '700' ? 'bold' : 'normal',
      color: String(style.color ?? ''),
      fontFamily: String(style.fontFamily ?? ''),
      align: /** @type {any} */ (style.textAlign ?? 'left'),
      padding: spacing(0),
      backgroundColor: String(style.backgroundColor ?? ''),
    }
  },
})
