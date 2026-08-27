/**
 * Image block.
 *
 * `display:block` matters more than it looks: without it, clients add the
 * inline-element descender gap under the image and the classic 1–4px seam
 * appears between stacked images.
 *
 * @module mailkiln/core/blocks/image
 */

import { defineBlock } from '../registry.js'
import { spacing } from '../schema.js'
import { attrs, escapeAttr, mergeStyles, styleAttr } from '../render/inline.js'
import { el, varsToAttr } from '../render/jsxNode.js'
import {
  ALIGN_FIELD,
  BACKGROUND_FIELD,
  HIDE_ON_MOBILE_FIELD,
  PADDING_FIELD,
  commonProps,
  mjCommonAttrs,
  widthValue,
} from './shared.js'

/**
 * The pixel width Outlook should use, as a string, or '' when unset.
 *
 * @param {Record<string, any>} p
 * @returns {string}
 */
function outlookWidth(p) {
  const value = Number(p.pxWidth)
  return Number.isFinite(value) && value > 0 ? String(Math.round(value)) : ''
}

export const imageBlock = defineBlock({
  type: 'image',
  label: 'Image',
  group: 'Content',
  icon: 'image',
  importPriority: 90,
  defaultProps: commonProps({
    src: '',
    alt: '',
    width: '100%',
    pxWidth: '',
    href: '',
    borderRadius: 0,
    align: /** @type {any} */ ('center'),
    padding: spacing(12, 24),
  }),
  schema: [
    { key: 'src', type: 'image', label: 'Image' },
    { key: 'alt', type: 'text', label: 'Alt text', vars: true, help: 'Shown when images are blocked — never leave it empty.' },
    { key: 'width', type: 'text', label: 'Width', placeholder: '100% or 480', help: 'A px value renders more predictably in Outlook.' },
    // A fluid image still needs a pixel width for Outlook, which cannot compute
    // a percentage against a table cell. Two fields rather than one because the
    // reference behaviour — `width="670"` plus `width:100%` — needs both at once.
    {
      key: 'pxWidth',
      type: 'number',
      label: 'Outlook width (px)',
      min: 0,
      max: 2000,
      group: 'Layout',
      help: 'Sent as the width attribute when Width is a percentage. Use the image’s display width.',
    },
    { key: 'href', type: 'url', label: 'Link', vars: true },
    { key: 'borderRadius', type: 'number', label: 'Corner radius', min: 0, max: 80, group: 'Layout' },
    ALIGN_FIELD,
    PADDING_FIELD,
    BACKGROUND_FIELD,
    HIDE_ON_MOBILE_FIELD,
  ],
  render: {
    html(p, ctx) {
      // The placeholder is editor chrome, not content: exporting it would post a
      // dashed "No image selected" box to every recipient. Outside the canvas an
      // image with no source renders as nothing, and the linter says so.
      if (!p.src) {
        return ctx.options?.editable
          ? `<div${styleAttr({ padding: 24, border: '1px dashed #cbd5e1', color: '#64748b', fontSize: 13, textAlign: 'center' })}>No image selected</div>`
          : ''
      }
      const w = widthValue(p.width, 600)
      const style = mergeStyles({
        display: 'block',
        width: w.css,
        maxWidth: '100%',
        height: 'auto',
        border: 0,
        borderRadius: p.borderRadius || '',
        outline: 'none',
        textDecoration: 'none',
        msoLineHeightRule: 'exactly',
      })
      const img = `<img${attrs({
        src: ctx.resolve(p.src),
        alt: ctx.resolve(p.alt ?? ''),
        width: w.attr ?? outlookWidth(p),
      })}${styleAttr(style)} />`
      if (!p.href) return img
      return `<a href="${escapeAttr(ctx.resolve(p.href))}" target="_blank"${styleAttr({ textDecoration: 'none' })}>${img}</a>`
    },
    jsx(p) {
      const w = widthValue(p.width, 600)
      const img = el('Img', {
        src: varsToAttr(p.src ?? ''),
        alt: varsToAttr(p.alt ?? ''),
        width: w.attr ? Number(w.attr) : Number(outlookWidth(p)) || undefined,
        style: mergeStyles({
          display: 'block',
          width: w.css,
          maxWidth: '100%',
          height: 'auto',
          border: 0,
          borderRadius: p.borderRadius || '',
        }),
      })
      if (!p.href) return img
      return el('Link', { href: varsToAttr(p.href) }, [img])
    },
    mjml(p, ctx) {
      const w = widthValue(p.width, 600)
      return `<mj-image${mjCommonAttrs(p)}${attrs({
        src: ctx.resolve(p.src ?? ''),
        alt: ctx.resolve(p.alt ?? ''),
        href: p.href ? ctx.resolve(p.href) : '',
        width: w.isPercent ? (outlookWidth(p) ? `${outlookWidth(p)}px` : '') : w.css,
        'border-radius': p.borderRadius ? `${p.borderRadius}px` : '',
      })} />`
    },
    text(p, ctx) {
      const alt = ctx.resolve(p.alt ?? '')
      const href = p.href ? ctx.resolve(p.href) : ''
      if (!alt && !href) return ''
      return href ? `[${alt || 'image'}: ${href}]` : `[${alt}]`
    },
  },
  lint(p) {
    /** @type {import('../types.js').LintIssue[]} */
    const issues = []
    if (p.src && !p.alt) {
      issues.push({
        id: 'image-alt',
        level: 'warn',
        message: 'Image has no alt text.',
        hint: 'Roughly half of recipients see blocked images first — alt text is the only copy they get.',
      })
    }
    return issues
  },
  parse(element, ctx) {
    const img =
      element.tagName === 'IMG'
        ? element
        : ctx.text(element) === ''
          ? element.querySelector?.('img')
          : null
    if (!img) return null
    const style = ctx.style(/** @type {Element} */ (img))
    const widthAttr = img.getAttribute?.('width')
    const anchor = img.closest?.('a')
    return {
      ...commonProps(),
      src: img.getAttribute?.('src') ?? '',
      alt: ctx.detectVars(img.getAttribute?.('alt') ?? ''),
      width: widthAttr || String(style.width ?? '') || '100%',
      href: anchor?.getAttribute?.('href') ?? '',
      borderRadius: parseInt(String(style.borderRadius ?? ''), 10) || 0,
      align: /** @type {any} */ (element.getAttribute?.('align') || 'center'),
      padding: spacing(0),
    }
  },
})
