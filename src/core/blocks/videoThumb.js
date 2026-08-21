/**
 * Video thumbnail block.
 *
 * There is no embedded video in email — every client strips `<video>` and most
 * strip `<iframe>`. The working pattern is a still image that links out, which is
 * what this emits. The play badge is a real overlay in clients that support
 * background images, with a linked caption underneath as the fallback everyone
 * sees, including Outlook.
 *
 * @module mailkiln/core/blocks/videoThumb
 */

import { defineBlock } from '../registry.js'
import { spacing } from '../schema.js'
import { attrs, escapeAttr, mergeStyles, styleAttr } from '../render/inline.js'
import { el, varsToAttr, varsToChildren } from '../render/jsxNode.js'
import {
  ALIGN_FIELD,
  HIDE_ON_MOBILE_FIELD,
  PADDING_FIELD,
  commonProps,
  widthValue,
} from './shared.js'

export const videoThumbBlock = defineBlock({
  type: 'videoThumb',
  label: 'Video',
  group: 'Content',
  icon: 'video',
  importPriority: 88,
  defaultProps: commonProps({
    thumbnailUrl: '',
    videoUrl: '',
    alt: 'Watch the video',
    caption: '▶ Watch the video',
    width: '100%',
    borderRadius: 6,
    captionColor: '',
    align: /** @type {any} */ ('center'),
    padding: spacing(12, 24),
  }),
  schema: [
    { key: 'thumbnailUrl', type: 'image', label: 'Thumbnail' },
    { key: 'videoUrl', type: 'url', label: 'Video URL', vars: true },
    { key: 'alt', type: 'text', label: 'Alt text' },
    { key: 'caption', type: 'text', label: 'Caption', help: 'Leave empty to show the thumbnail only.' },
    { key: 'captionColor', type: 'color', label: 'Caption colour', group: 'Type' },
    { key: 'width', type: 'text', label: 'Width', placeholder: '100% or 480' },
    { key: 'borderRadius', type: 'number', label: 'Corner radius', min: 0, max: 40, group: 'Layout' },
    ALIGN_FIELD,
    PADDING_FIELD,
    HIDE_ON_MOBILE_FIELD,
  ],
  render: {
    html(p, ctx) {
      const w = widthValue(p.width, 600)
      const href = escapeAttr(ctx.resolve(p.videoUrl ?? ''))
      const thumb = p.thumbnailUrl
        ? `<img${attrs({
            src: ctx.resolve(p.thumbnailUrl),
            alt: ctx.resolve(p.alt ?? ''),
            width: w.attr,
          })}${styleAttr({
            display: 'block',
            width: w.css,
            maxWidth: '100%',
            height: 'auto',
            border: 0,
            borderRadius: p.borderRadius || '',
          })} />`
        : `<div${styleAttr({ padding: 32, backgroundColor: '#111827', color: '#f9fafb', fontSize: 13, textAlign: 'center' })}>No thumbnail selected</div>`
      const caption = p.caption
        ? `<div${styleAttr({
            paddingTop: 8,
            fontFamily: ctx.settings.fontFamily,
            fontSize: 14,
            textAlign: p.align,
          })}><a href="${href}" target="_blank"${styleAttr({ color: p.captionColor || ctx.settings.linkColor, textDecoration: 'none' })}>${ctx.resolve(p.caption)}</a></div>`
        : ''
      return `<div${styleAttr({ textAlign: p.align })}><a href="${href}" target="_blank"${styleAttr({ textDecoration: 'none' })}>${thumb}</a>${caption}</div>`
    },
    jsx(p, ctx) {
      const w = widthValue(p.width, 600)
      const children = [
        el('Link', { href: varsToAttr(p.videoUrl ?? '') }, [
          el('Img', {
            src: varsToAttr(p.thumbnailUrl ?? ''),
            alt: varsToAttr(p.alt ?? ''),
            width: w.attr ? Number(w.attr) : undefined,
            style: mergeStyles({
              display: 'block',
              width: w.css,
              maxWidth: '100%',
              height: 'auto',
              border: 0,
              borderRadius: p.borderRadius || '',
            }),
          }),
        ]),
      ]
      if (p.caption) {
        children.push(
          el('Text', { style: { paddingTop: 8, fontSize: 14, textAlign: p.align, margin: 0 } }, [
            el(
              'Link',
              {
                href: varsToAttr(p.videoUrl ?? ''),
                style: { color: p.captionColor || ctx.settings.linkColor },
              },
              varsToChildren(p.caption),
            ),
          ]),
        )
      }
      return el('Section', { style: { textAlign: p.align } }, children)
    },
    mjml(p, ctx) {
      const w = widthValue(p.width, 600)
      const image = `<mj-image src="${escapeAttr(ctx.resolve(p.thumbnailUrl ?? ''))}" href="${escapeAttr(ctx.resolve(p.videoUrl ?? ''))}" alt="${escapeAttr(ctx.resolve(p.alt ?? ''))}"${w.isPercent ? '' : ` width="${w.css}"`} padding="0"${p.borderRadius ? ` border-radius="${p.borderRadius}px"` : ''} align="${escapeAttr(p.align || 'center')}" />`
      if (!p.caption) return image
      return `${image}<mj-text align="${escapeAttr(p.align || 'center')}" padding="8px 0 0" font-size="14px"><a href="${escapeAttr(ctx.resolve(p.videoUrl ?? ''))}" style="color:${escapeAttr(p.captionColor || ctx.settings.linkColor)};text-decoration:none">${ctx.resolve(p.caption)}</a></mj-text>`
    },
    text(p, ctx) {
      const url = ctx.resolve(p.videoUrl ?? '')
      const label = ctx.resolve(p.caption || p.alt || 'Watch the video')
      return url ? `${label}: ${url}` : label
    },
  },
  lint(p) {
    /** @type {import('../types.js').LintIssue[]} */
    const issues = []
    if (!p.videoUrl) {
      issues.push({
        id: 'video-href',
        level: 'error',
        message: 'Video block has no video URL.',
        hint: 'The thumbnail is the only clickable part — without a URL it does nothing.',
      })
    }
    if (/<video|<iframe/i.test(String(p.caption ?? ''))) {
      issues.push({
        id: 'video-embed',
        level: 'error',
        message: 'Embedded players are stripped by email clients.',
        hint: 'Link to the video instead — that is what this block does.',
      })
    }
    return issues
  },
  parse(element, ctx) {
    const anchor = element.tagName === 'A' ? element : element.querySelector?.('a')
    const img = anchor?.querySelector?.('img')
    if (!anchor || !img) return null
    // Same rule as the button: claim only when the linked thumbnail is all there
    // is, so surrounding copy is never swallowed.
    if (anchor !== element && ctx.text(element) !== ctx.text(anchor)) return null
    const href = anchor.getAttribute?.('href') ?? ''
    if (!/youtube\.com|youtu\.be|vimeo\.com|wistia|loom\.com/i.test(href)) return null
    const style = ctx.style(img)
    return {
      ...commonProps(),
      thumbnailUrl: img.getAttribute?.('src') ?? '',
      videoUrl: href,
      alt: img.getAttribute?.('alt') ?? 'Watch the video',
      caption: '',
      width: img.getAttribute?.('width') || String(style.width ?? '') || '100%',
      borderRadius: parseInt(String(style.borderRadius ?? ''), 10) || 0,
      align: /** @type {any} */ ('center'),
      padding: spacing(0),
    }
  },
})
