/**
 * Spacer block. The `height` attribute is not redundant with the CSS height —
 * Outlook uses the attribute and ignores the style, so both are emitted.
 *
 * @module mailkiln/core/blocks/spacer
 */

import { defineBlock } from '../registry.js'
import { spacing } from '../schema.js'
import { attrs, escapeAttr, styleAttr, tableOpen, TABLE_CLOSE } from '../render/inline.js'
import { el, raw } from '../render/jsxNode.js'
import { BACKGROUND_FIELD, HIDE_ON_MOBILE_FIELD } from './shared.js'

export const spacerBlock = defineBlock({
  type: 'spacer',
  label: 'Spacer',
  group: 'Layout',
  icon: 'spacer',
  importPriority: 65,
  void: true,
  defaultProps: {
    height: 24,
    padding: spacing(0),
    align: /** @type {any} */ ('left'),
    backgroundColor: '',
    hideOnMobile: false,
  },
  schema: [
    { key: 'height', type: 'range', label: 'Height', min: 2, max: 160, step: 2 },
    BACKGROUND_FIELD,
    HIDE_ON_MOBILE_FIELD,
  ],
  render: {
    html(p) {
      const height = Math.max(1, Number(p.height) || 24)
      return [
        tableOpen({ width: '100%' }),
        '<tr>',
        `<td${attrs({ height: String(height) })}${styleAttr({
          height,
          lineHeight: `${height}px`,
          fontSize: '1px',
        })}>&nbsp;</td>`,
        '</tr>',
        TABLE_CLOSE,
      ].join('')
    },
    jsx(p) {
      const height = Math.max(1, Number(p.height) || 24)
      return el(
        'div',
        { style: { height, lineHeight: `${height}px`, fontSize: 0 } },
        [raw("{'\\u00a0'}")],
      )
    },
    mjml(p) {
      // Background travels as `container-background-color`, the attribute every
      // other block uses — a spacer with a colour is how you get a band of it
      // between two blocks. Written out rather than taken from mjCommonAttrs
      // because a spacer has no padding or align field to emit.
      const background = p.backgroundColor
        ? ` container-background-color="${escapeAttr(p.backgroundColor)}"`
        : ''
      return `<mj-spacer height="${Math.max(1, Number(p.height) || 24)}px"${background} />`
    },
    text() {
      return ''
    },
  },
  parse(element, ctx) {
    if (element.tagName !== 'TD') return null
    if (ctx.text(element) !== '') return null
    if (element.querySelector?.('img, a, table')) return null
    const style = ctx.style(element)
    const height = parseInt(String(style.height ?? element.getAttribute?.('height') ?? ''), 10)
    if (!Number.isFinite(height) || height <= 0) return null
    // A coloured thin cell is a divider; the divider parser has higher priority
    // and will have claimed it already.
    return { height, padding: spacing(0), align: /** @type {any} */ ('left'), backgroundColor: '' }
  },
})
