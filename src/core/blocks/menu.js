/**
 * Menu block — a row of navigation links, the thing almost every footer and
 * masthead needs and that a text block full of hand-written `<a>` tags is a poor
 * substitute for.
 *
 * Two markup paths, because Word's engine does not lay out `inline-block`: real
 * clients get anchors that wrap onto a second line when the screen is narrow,
 * Outlook gets a one-row table that never wraps. Both carry the same links, and
 * only one of them is ever visible.
 *
 * @module mailkiln/core/blocks/menu
 */

import { defineBlock } from '../registry.js'
import { spacing } from '../schema.js'
import { escapeAttr, escapeHtml, mergeStyles, mso, notMso, styleAttr } from '../render/inline.js'
import { el, varsToAttr } from '../render/jsxNode.js'
import {
  ALIGN_FIELD,
  FONT_FIELD,
  HIDE_ON_MOBILE_FIELD,
  PADDING_FIELD,
  WEIGHT_OPTIONS,
  commonProps,
  mjCommonAttrs,
} from './shared.js'

/**
 * @param {any} props
 * @returns {Array<{ label: string, url: string }>}
 */
function itemsOf(props) {
  const items = Array.isArray(props.items) ? props.items : []
  return items.filter((/** @type {any} */ item) => item && (item.label || item.url))
}

export const menuBlock = defineBlock({
  type: 'menu',
  label: 'Menu',
  group: 'Content',
  icon: 'menu',
  // Above social (icon links) and below button (a single styled anchor): a menu
  // is what is left when several *text* links sit in one container.
  importPriority: 84,
  defaultProps: commonProps({
    items: [
      { label: 'Shop', url: 'https://example.com/shop' },
      { label: 'About', url: 'https://example.com/about' },
      { label: 'Contact', url: 'https://example.com/contact' },
    ],
    layout: /** @type {any} */ ('horizontal'),
    separator: '|',
    separatorColor: '#9ca3af',
    color: '#2563eb',
    fontSize: 14,
    fontWeight: /** @type {any} */ ('normal'),
    fontFamily: '',
    letterSpacing: '',
    underline: false,
    gap: 10,
    align: /** @type {any} */ ('center'),
    padding: spacing(12, 24),
  }),
  schema: [
    {
      key: 'items',
      type: 'list',
      label: 'Menu items',
      addLabel: 'Add item',
      itemDefaults: { label: 'Link', url: '' },
      itemSchema: [
        { key: 'label', type: 'text', label: 'Label', vars: true },
        { key: 'url', type: 'url', label: 'URL', vars: true },
      ],
    },
    {
      key: 'layout',
      type: 'select',
      label: 'Layout',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
      ],
    },
    {
      key: 'separator',
      type: 'text',
      label: 'Separator',
      vars: false,
      when: (values) => values.layout !== 'vertical',
      help: 'Drawn between items. Leave empty for none.',
    },
    {
      key: 'separatorColor',
      type: 'color',
      label: 'Separator colour',
      when: (values) => values.layout !== 'vertical' && !!values.separator,
    },
    { key: 'gap', type: 'number', label: 'Gap', min: 0, max: 40, group: 'Layout' },
    ALIGN_FIELD,
    PADDING_FIELD,
    { key: 'color', type: 'color', label: 'Link colour', group: 'Type' },
    { key: 'fontSize', type: 'number', label: 'Size', min: 9, max: 32, group: 'Type' },
    {
      key: 'fontWeight',
      type: 'select',
      label: 'Weight',
      options: WEIGHT_OPTIONS,
      group: 'Type',
    },
    FONT_FIELD,
    {
      key: 'letterSpacing',
      type: 'text',
      label: 'Letter spacing',
      placeholder: '0.02em',
      vars: false,
      group: 'Type',
    },
    { key: 'underline', type: 'toggle', label: 'Underline', group: 'Type' },
    HIDE_ON_MOBILE_FIELD,
  ],
  render: {
    html(p, ctx) {
      const items = itemsOf(p)
      if (!items.length) return ''
      const vertical = p.layout === 'vertical'
      const half = Math.round((Number(p.gap) || 0) / 2)
      const linkStyle = mergeStyles({
        display: vertical ? 'block' : 'inline-block',
        padding: vertical ? `${half}px 0` : `${half}px ${half}px`,
        color: p.color,
        fontFamily: p.fontFamily || ctx.settings.fontFamily,
        fontSize: p.fontSize,
        fontWeight: p.fontWeight === 'normal' ? '' : p.fontWeight,
        letterSpacing: p.letterSpacing,
        textDecoration: p.underline ? 'underline' : 'none',
      })

      /** @param {{ label: string, url: string }} item */
      const anchor = (item) =>
        `<a href="${escapeAttr(ctx.resolve(item.url ?? ''))}" target="_blank"${styleAttr(linkStyle)}>${escapeHtml(ctx.resolve(item.label ?? ''))}</a>`

      if (vertical) {
        return `<div${styleAttr({ textAlign: p.align })}>${items.map(anchor).join('')}</div>`
      }

      const separator = String(p.separator ?? '').trim()
      const separatorMarkup = separator
        ? `<span${styleAttr({
            display: 'inline-block',
            padding: `${half}px ${half}px`,
            color: p.separatorColor || p.color,
            fontSize: p.fontSize,
          })}>${escapeHtml(separator)}</span>`
        : ''

      // Outlook: one table row, one cell per item — it ignores inline-block and
      // would otherwise stack every link.
      const outlookCells = items
        .map(
          (item, index) =>
            `<td${styleAttr({ padding: `0 ${half}px` })}>${anchor(item)}</td>` +
            (separatorMarkup && index < items.length - 1
              ? `<td${styleAttr({ padding: `0 ${half}px` })}>${separatorMarkup}</td>`
              : ''),
        )
        .join('')

      return [
        `<div${styleAttr({ textAlign: p.align })}>`,
        mso(
          `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="${escapeAttr(p.align || 'center')}"${styleAttr({ borderCollapse: 'collapse' })}><tr>${outlookCells}</tr></table>`,
        ),
        notMso(items.map(anchor).join(separatorMarkup)),
        '</div>',
      ].join('')
    },
    jsx(p, ctx) {
      const items = itemsOf(p)
      const vertical = p.layout === 'vertical'
      const half = Math.round((Number(p.gap) || 0) / 2)
      const style = mergeStyles({
        display: vertical ? 'block' : 'inline-block',
        padding: vertical ? `${half}px 0` : `${half}px ${half}px`,
        color: p.color,
        fontFamily: p.fontFamily || ctx.settings.fontFamily,
        fontSize: p.fontSize,
        fontWeight: p.fontWeight === 'normal' ? '' : p.fontWeight,
        letterSpacing: p.letterSpacing,
        textDecoration: p.underline ? 'underline' : 'none',
      })
      const separator = vertical ? '' : String(p.separator ?? '').trim()

      /** @type {any[]} */
      const children = []
      items.forEach((item, index) => {
        children.push(
          el('Link', { href: varsToAttr(item.url ?? ''), style }, [String(item.label ?? '')]),
        )
        if (separator && index < items.length - 1) {
          children.push(
            el(
              'span',
              {
                style: mergeStyles({
                  display: 'inline-block',
                  padding: `${half}px ${half}px`,
                  color: p.separatorColor || p.color,
                  fontSize: p.fontSize,
                }),
              },
              [separator],
            ),
          )
        }
      })

      return el('Section', { style: { textAlign: p.align || 'center' } }, children)
    },
    mjml(p, ctx) {
      const items = itemsOf(p)
      // mj-navbar is the semantic match, but it only lays out horizontally and
      // it ships a hamburger nobody asked for; a vertical menu goes out as
      // mj-text carrying the same anchors the HTML target emits.
      if (p.layout === 'vertical') {
        return `<mj-text${mjCommonAttrs(p)}>${menuBlock.render.html(p, ctx)}</mj-text>`
      }
      const links = items
        .map(
          (item) =>
            `<mj-navbar-link href="${escapeAttr(ctx.resolve(item.url ?? ''))}" color="${escapeAttr(p.color ?? '')}" font-size="${p.fontSize ?? 14}px" text-decoration="${p.underline ? 'underline' : 'none'}">${escapeHtml(ctx.resolve(item.label ?? ''))}</mj-navbar-link>`,
        )
        .join('')
      return `<mj-navbar${mjCommonAttrs(p)} hamburger="none">${links}</mj-navbar>`
    },
    text(p, ctx) {
      return itemsOf(p)
        .map((item) => `${ctx.resolve(item.label ?? '')}: ${ctx.resolve(item.url ?? '')}`)
        .join('\n')
    },
  },
  lint(p) {
    /** @type {import('../types.js').LintIssue[]} */
    const issues = []
    for (const item of itemsOf(p)) {
      if (!item.url) {
        issues.push({
          id: 'menu-url',
          level: 'warn',
          message: `Menu item "${item.label || 'untitled'}" has no link.`,
          hint: 'A menu item that goes nowhere reads as a broken link to the recipient.',
        })
      }
      if (!item.label) {
        issues.push({
          id: 'menu-label',
          level: 'warn',
          message: 'A menu item has a link but no label.',
          hint: 'Give it a label — an empty anchor is invisible and unclickable.',
        })
      }
    }
    return issues
  },
  parse(element, ctx) {
    const anchors = Array.from(element.querySelectorAll?.('a') ?? [])
    if (anchors.length < 2) return null
    // Text links only. An anchor wrapping an image is a social row or a linked
    // image, and one styled anchor is a button.
    const textLinks = anchors.filter((a) => !a.querySelector?.('img') && ctx.text(a) !== '')
    if (textLinks.length !== anchors.length) return null

    // Nothing but the links and their separators may live here, or this is a
    // paragraph that happens to contain links — which is a text block.
    const own = ctx.text(element)
    const linkText = textLinks.map((a) => ctx.text(a)).join('')
    const between = own.split('').filter((char) => !/\s/.test(char)).length
    const inLinks = linkText.split('').filter((char) => !/\s/.test(char)).length
    const separators = between - inLinks
    if (separators > textLinks.length * 3) return null

    const first = ctx.style(textLinks[0])
    const separator = (own.replace(/\s+/g, ' ').match(/\s([|·•\-–—/])\s/) ?? [])[1] ?? ''

    return {
      ...commonProps(),
      items: textLinks.map((a) => ({
        label: ctx.text(a),
        url: a.getAttribute?.('href') ?? '',
      })),
      layout: /** @type {any} */ ('horizontal'),
      separator,
      separatorColor: '',
      color: String(first.color || '#2563eb'),
      fontSize: parseInt(String(first.fontSize ?? ''), 10) || 14,
      fontWeight: /** @type {any} */ (String(first.fontWeight || 'normal')),
      fontFamily: '',
      underline: String(first.textDecoration ?? '').includes('underline'),
      gap: 10,
      align: /** @type {any} */ (element.getAttribute?.('align') || 'center'),
      padding: spacing(0),
    }
  },
})
