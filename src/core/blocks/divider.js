/**
 * Divider block. A 1px `<td>` with a background colour rather than an `<hr>`,
 * because Outlook renders `<hr>` at its own thickness and colour.
 *
 * @module mailforge/core/blocks/divider
 */

import { defineBlock } from '../registry.js'
import { spacing } from '../schema.js'
import { attrs, mergeStyles, styleAttr, tableOpen, TABLE_CLOSE } from '../render/inline.js'
import { el } from '../render/jsxNode.js'
import {
  ALIGN_FIELD,
  HIDE_ON_MOBILE_FIELD,
  PADDING_FIELD,
  commonProps,
  mjCommonAttrs,
} from './shared.js'

export const dividerBlock = defineBlock({
  type: 'divider',
  label: 'Divider',
  group: 'Layout',
  icon: 'divider',
  importPriority: 70,
  void: true,
  defaultProps: commonProps({
    color: '#e5e7eb',
    height: 1,
    style: 'solid',
    width: '100%',
    align: /** @type {any} */ ('center'),
    padding: spacing(12, 24),
  }),
  schema: [
    { key: 'color', type: 'color', label: 'Colour' },
    { key: 'height', type: 'number', label: 'Thickness', min: 1, max: 12 },
    {
      key: 'style',
      type: 'select',
      label: 'Style',
      options: [
        { value: 'solid', label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
        { value: 'dotted', label: 'Dotted' },
      ],
    },
    { key: 'width', type: 'text', label: 'Width', placeholder: '100% or 240' },
    ALIGN_FIELD,
    PADDING_FIELD,
    HIDE_ON_MOBILE_FIELD,
  ],
  render: {
    html(p) {
      const height = Math.max(1, Number(p.height) || 1)
      const solid = (p.style ?? 'solid') === 'solid'
      const cellStyle = solid
        ? mergeStyles({
            height,
            lineHeight: `${height}px`,
            fontSize: '1px',
            backgroundColor: p.color,
          })
        : mergeStyles({
            borderTop: `${height}px ${p.style} ${p.color}`,
            lineHeight: '1px',
            fontSize: '1px',
          })
      return [
        tableOpen({ width: p.width || '100%', align: p.align, style: { maxWidth: '100%' } }),
        '<tr>',
        `<td${attrs({ height: solid ? String(height) : undefined })}${styleAttr(cellStyle)}>&nbsp;</td>`,
        '</tr>',
        TABLE_CLOSE,
      ].join('')
    },
    jsx(p) {
      const height = Math.max(1, Number(p.height) || 1)
      return el('Hr', {
        style: mergeStyles({
          width: p.width || '100%',
          border: 'none',
          borderTop: `${height}px ${p.style ?? 'solid'} ${p.color}`,
          margin: 0,
        }),
      })
    },
    mjml(p) {
      return `<mj-divider${mjCommonAttrs(p, { align: false })} border-width="${Math.max(1, Number(p.height) || 1)}px" border-style="${p.style ?? 'solid'}" border-color="${p.color}"${p.width && p.width !== '100%' ? ` width="${p.width}"` : ''} />`
    },
    text() {
      return '—'.repeat(24)
    },
  },
  parse(element, ctx) {
    if (element.tagName === 'HR') {
      const style = ctx.style(element)
      return {
        ...commonProps(),
        color: String(style.borderTopColor || style.backgroundColor || '#e5e7eb'),
        height: parseInt(String(style.borderTopWidth ?? ''), 10) || 1,
        style: String(style.borderTopStyle || 'solid'),
        width: String(style.width || '100%'),
        align: /** @type {any} */ ('center'),
        padding: spacing(0),
      }
    }
    if (element.tagName !== 'TD') return null
    if (ctx.text(element) !== '') return null
    const style = ctx.style(element)
    const borderTop = String(style.borderTop ?? style.borderTopWidth ?? '')
    const height = parseInt(String(style.height ?? element.getAttribute?.('height') ?? ''), 10)
    const bg = String(style.backgroundColor || element.getAttribute?.('bgcolor') || '')
    if (borderTop) {
      const [width, lineStyle, color] = borderTop.split(/\s+/)
      return {
        ...commonProps(),
        color: color || String(style.borderTopColor || '#e5e7eb'),
        height: parseInt(width, 10) || 1,
        style: lineStyle || 'solid',
        width: '100%',
        align: /** @type {any} */ ('center'),
        padding: spacing(0),
      }
    }
    // A 1–4px coloured empty cell is a rule, not a spacer.
    if (bg && Number.isFinite(height) && height > 0 && height <= 4) {
      return {
        ...commonProps(),
        color: bg,
        height,
        style: 'solid',
        width: '100%',
        align: /** @type {any} */ ('center'),
        padding: spacing(0),
      }
    }
    return null
  },
})
