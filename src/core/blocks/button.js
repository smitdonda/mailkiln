/**
 * Button block.
 *
 * The padding lives on the `<td>`, not on the `<a>`: Outlook ignores padding on
 * inline elements, so a padded anchor collapses to a text link there. Putting it
 * on the cell (plus `mso-padding-alt`) is the shape that survives everywhere,
 * and it is why this can't just be a styled link.
 *
 * @module mailkiln/core/blocks/button
 */

import { defineBlock } from '../registry.js'
import { spacing } from '../schema.js'
import {
  escapeAttr,
  mergeStyles,
  mso,
  notMso,
  styleAttr,
  tableOpen,
  TABLE_CLOSE,
} from '../render/inline.js'
import { el, varsToAttr, varsToChildren } from '../render/jsxNode.js'
import {
  ALIGN_FIELD,
  FONT_FIELD,
  HIDE_ON_MOBILE_FIELD,
  MOBILE_FONT_SIZE_FIELD,
  PADDING_FIELD,
  WEIGHT_OPTIONS,
  commonProps,
  mjCommonAttrs,
  stripTags,
} from './shared.js'

/**
 * The Outlook-only VML twin of a rounded button, or '' when one is not needed.
 *
 * The width is estimated from the label because VML has no shrink-to-fit: 0.62em
 * per character is the ratio that keeps Helvetica and Arial labels from
 * clipping, and the cell is centred so a slightly generous box still looks
 * right.
 *
 * @param {Record<string, any>} p
 * @param {import('../types.js').RenderContext} ctx
 * @param {string} href Already escaped.
 * @param {string} label
 * @returns {string}
 */
function roundrect(p, ctx, href, label) {
  const radius = Number(p.borderRadius) || 0
  if (!radius || p.fullWidth) return ''
  const fontSize = Number(p.fontSize) || 16
  const paddingX = Number(p.paddingX ?? 28)
  const paddingY = Number(p.paddingY ?? 14)
  const plain = stripTags(label)
  const height = Math.round(fontSize * 1.15 + paddingY * 2)
  const width = Math.round(plain.length * fontSize * 0.62 + paddingX * 2)
  const arcsize = Math.min(50, Math.round((radius / Math.max(height, 1)) * 100))
  const center = styleAttr({
    color: p.color,
    fontFamily: p.fontFamily || ctx.settings.fontFamily,
    fontSize,
    fontWeight: p.fontWeight,
    letterSpacing: p.letterSpacing,
  })
  return mso(
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:${height}px;v-text-anchor:middle;width:${width}px;" arcsize="${arcsize}%" stroke="f" fillcolor="${escapeAttr(p.buttonColor)}"><w:anchorlock/><center${center}>${plain}</center></v:roundrect>`,
  )
}

export const buttonBlock = defineBlock({
  type: 'button',
  label: 'Button',
  group: 'Content',
  icon: 'button',
  importPriority: 85,
  defaultProps: commonProps({
    text: 'Get started',
    href: 'https://example.com',
    // `buttonColor`, not `backgroundColor`: every block's `backgroundColor` is
    // the background of its wrapper cell, which for a button would paint the
    // full content width instead of the button itself.
    // Default is indigo-600 rather than indigo-500 so white label text clears
    // WCAG AA — our own defaults should not trip our own linter.
    buttonColor: '#4f46e5',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: '',
    mobileFontSize: '',
    borderRadius: 6,
    paddingX: 28,
    paddingY: 14,
    borderColor: '',
    letterSpacing: '',
    fullWidth: false,
    align: /** @type {any} */ ('center'),
    padding: spacing(16, 24),
  }),
  schema: [
    { key: 'text', type: 'text', label: 'Label', vars: true },
    { key: 'href', type: 'url', label: 'Link', vars: true },
    { key: 'buttonColor', type: 'color', label: 'Button colour' },
    { key: 'color', type: 'color', label: 'Text colour' },
    { key: 'backgroundColor', type: 'color', label: 'Row background', group: 'Layout' },
    { key: 'borderColor', type: 'color', label: 'Border', group: 'Layout' },
    { key: 'borderRadius', type: 'number', label: 'Corner radius', min: 0, max: 40, group: 'Layout' },
    { key: 'paddingX', type: 'number', label: 'Inner padding X', min: 0, max: 80, group: 'Layout' },
    { key: 'paddingY', type: 'number', label: 'Inner padding Y', min: 0, max: 60, group: 'Layout' },
    { key: 'fullWidth', type: 'toggle', label: 'Full width', group: 'Layout' },
    { key: 'fontSize', type: 'number', label: 'Size', min: 10, max: 32, group: 'Type' },
    { key: 'fontWeight', type: 'select', label: 'Weight', options: WEIGHT_OPTIONS, group: 'Type' },
    {
      key: 'letterSpacing',
      type: 'text',
      label: 'Letter spacing',
      placeholder: '0.02em',
      vars: false,
      group: 'Type',
    },
    FONT_FIELD,
    ALIGN_FIELD,
    PADDING_FIELD,
    HIDE_ON_MOBILE_FIELD,
    MOBILE_FONT_SIZE_FIELD,
  ],
  render: {
    html(p, ctx) {
      const label = ctx.resolve(p.text ?? '')
      const cell = mergeStyles({
        borderRadius: p.borderRadius || '',
        padding: `${p.paddingY ?? 14}px ${p.paddingX ?? 28}px`,
        msoPaddingAlt: '0',
        border: p.borderColor ? `1px solid ${p.borderColor}` : '',
        textAlign: 'center',
      })
      const anchor = mergeStyles({
        display: p.fullWidth ? 'block' : 'inline-block',
        color: p.color,
        fontFamily: p.fontFamily || ctx.settings.fontFamily,
        fontSize: p.fontSize,
        fontWeight: p.fontWeight,
        letterSpacing: p.letterSpacing,
        lineHeight: 1.15,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        msoLineHeightRule: 'exactly',
      })
      const href = escapeAttr(ctx.resolve(p.href ?? '#'))
      const table = [
        tableOpen({
          width: p.fullWidth ? '100%' : undefined,
          align: p.align,
          style: { borderCollapse: 'separate' },
        }),
        '<tr>',
        `<td align="center" bgcolor="${escapeAttr(p.buttonColor)}"${styleAttr(mergeStyles({ backgroundColor: p.buttonColor }, cell))}>`,
        `<a href="${href}" target="_blank"${styleAttr(anchor)}>${label}</a>`,
        '</td>',
        '</tr>',
        TABLE_CLOSE,
      ].join('')

      // Word-engine Outlook ignores border-radius, so a pill renders there as a
      // rectangle. VML is the only shape it does round, and it needs explicit
      // pixel dimensions — hence the estimate below. Square buttons and
      // full-width ones keep the plain table: the first has nothing to round,
      // and the second has no width to give VML.
      const vml = roundrect(p, ctx, href, label)
      return vml ? `${vml}${notMso(table)}` : table
    },
    jsx(p, ctx) {
      return el(
        'Button',
        {
          href: varsToAttr(p.href ?? '#'),
          style: mergeStyles({
            backgroundColor: p.buttonColor,
            color: p.color,
            fontFamily: p.fontFamily || ctx.settings.fontFamily,
            fontSize: p.fontSize,
            fontWeight: p.fontWeight,
            letterSpacing: p.letterSpacing || '',
            borderRadius: p.borderRadius || '',
            border: p.borderColor ? `1px solid ${p.borderColor}` : '',
            padding: `${p.paddingY ?? 14}px ${p.paddingX ?? 28}px`,
            textDecoration: 'none',
            display: p.fullWidth ? 'block' : 'inline-block',
            textAlign: 'center',
          }),
        },
        varsToChildren(p.text ?? ''),
      )
    },
    mjml(p, ctx) {
      return `<mj-button${mjCommonAttrs(p)} href="${escapeAttr(ctx.resolve(p.href ?? '#'))}" background-color="${escapeAttr(p.buttonColor)}" color="${escapeAttr(p.color)}" font-size="${p.fontSize}px" font-weight="${escapeAttr(p.fontWeight)}" border-radius="${p.borderRadius ?? 0}px"${p.letterSpacing ? ` letter-spacing="${escapeAttr(p.letterSpacing)}"` : ''} inner-padding="${p.paddingY ?? 14}px ${p.paddingX ?? 28}px"${p.fullWidth ? ' width="100%"' : ''}>${ctx.resolve(p.text ?? '')}</mj-button>`
    },
    text(p, ctx) {
      const label = stripTags(ctx.resolve(p.text ?? ''))
      const href = ctx.resolve(p.href ?? '')
      return href ? `${label}: ${href}` : label
    },
  },
  lint(p) {
    /** @type {import('../types.js').LintIssue[]} */
    const issues = []
    const href = String(p.href ?? '').trim()
    if (!href || href === '#') {
      issues.push({
        id: 'button-href',
        level: 'error',
        message: 'Button has no destination.',
        hint: 'Set a full https:// URL — a bare "#" is a dead click in an inbox.',
      })
    } else if (!/^(https?:|mailto:|tel:|\{\{)/i.test(href)) {
      issues.push({
        id: 'button-href',
        level: 'warn',
        message: `Button link "${href}" is not absolute.`,
        hint: 'Relative URLs have nothing to resolve against in an email client.',
      })
    }
    return issues
  },
  parse(element, ctx) {
    const anchor = element.tagName === 'A' ? element : element.querySelector?.('a')
    if (!anchor) return null

    // The anchor has to be the *entire* visible content of what we are claiming.
    // Without this, any padded cell containing a link becomes a button — so
    // "You signed up. <a>Unsubscribe</a>." imports as a button labelled
    // "Unsubscribe" and the sentence around it is gone.
    if (anchor !== element && ctx.text(element) !== ctx.text(anchor)) return null

    const anchorStyle = ctx.style(anchor)
    const cell = anchor.closest?.('td')
    const cellStyle = cell ? ctx.style(cell) : {}
    const bg =
      anchorStyle.backgroundColor ||
      cellStyle.backgroundColor ||
      cell?.getAttribute?.('bgcolor') ||
      ''
    const padded = !!(anchorStyle.padding || cellStyle.padding || cellStyle.msoPaddingAlt)
    // A link is only a button if it looks like one: a background, or padding
    // inside its own cell. Otherwise it's body copy and belongs to the text block.
    if (!bg && !padded) return null
    const label = ctx.text(anchor)
    if (!label) return null
    return {
      ...commonProps(),
      text: ctx.detectVars(label),
      href: anchor.getAttribute?.('href') ?? '',
      buttonColor: String(bg || '#4f46e5'),
      color: String(anchorStyle.color || '#ffffff'),
      fontSize: parseInt(String(anchorStyle.fontSize ?? ''), 10) || 16,
      fontWeight: String(anchorStyle.fontWeight || 'bold'),
      borderRadius:
        parseInt(String(anchorStyle.borderRadius ?? cellStyle.borderRadius ?? ''), 10) || 0,
      paddingX: parsePaddingAxis(String(anchorStyle.padding ?? cellStyle.padding ?? ''), 'x') ?? 28,
      paddingY: parsePaddingAxis(String(anchorStyle.padding ?? cellStyle.padding ?? ''), 'y') ?? 14,
      align: /** @type {any} */ (cell?.getAttribute?.('align') || 'center'),
      padding: spacing(0),
    }
  },
})

/**
 * Pull one axis out of a CSS padding shorthand.
 *
 * @param {string} shorthand
 * @param {'x' | 'y'} axis
 * @returns {number | null}
 */
function parsePaddingAxis(shorthand, axis) {
  const parts = shorthand
    .trim()
    .split(/\s+/)
    .map((v) => parseInt(v, 10))
    .filter((n) => Number.isFinite(n))
  if (!parts.length) return null
  const [a, b = a, , d = b] = parts
  return axis === 'y' ? a : (parts.length >= 4 ? Math.max(b, d) : b)
}
