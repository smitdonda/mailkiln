/**
 * Social links block.
 *
 * Deliberately ships no icon images. Bundling PNGs would mean hosting them
 * somewhere, and an email that hotlinks a library's CDN breaks the day that CDN
 * moves. Provide your own `iconUrl` per link (any absolute URL) and you get
 * icons; leave it empty and you get styled text links, which render everywhere.
 * The MJML target uses `mj-social`, whose icons MJML itself supplies.
 *
 * @module mailforge/core/blocks/social
 */

import { defineBlock } from '../registry.js'
import { spacing } from '../schema.js'
import { attrs, escapeAttr, mergeStyles, styleAttr } from '../render/inline.js'
import { el, varsToAttr } from '../render/jsxNode.js'
import {
  ALIGN_FIELD,
  HIDE_ON_MOBILE_FIELD,
  PADDING_FIELD,
  commonProps,
  mjCommonAttrs,
} from './shared.js'

/** Networks MJML knows by name, so the MJML export can use its built-in icons. */
export const KNOWN_NETWORKS = [
  'facebook',
  'twitter',
  'x',
  'instagram',
  'linkedin',
  'youtube',
  'github',
  'tiktok',
  'pinterest',
  'threads',
  'web',
]

export const socialBlock = defineBlock({
  type: 'social',
  label: 'Social',
  group: 'Content',
  icon: 'social',
  importPriority: 80,
  defaultProps: commonProps({
    links: [
      { network: 'twitter', label: 'Twitter', url: 'https://twitter.com/', iconUrl: '' },
      { network: 'instagram', label: 'Instagram', url: 'https://instagram.com/', iconUrl: '' },
      { network: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/', iconUrl: '' },
    ],
    iconSize: 24,
    gap: 10,
    color: '#64748b',
    fontSize: 13,
    align: /** @type {any} */ ('center'),
    padding: spacing(12, 24),
  }),
  schema: [
    {
      key: 'links',
      type: 'list',
      label: 'Links',
      addLabel: 'Add network',
      itemDefaults: { network: 'web', label: 'Website', url: '', iconUrl: '' },
      itemSchema: [
        {
          key: 'network',
          type: 'select',
          label: 'Network',
          options: KNOWN_NETWORKS.map((n) => ({ value: n, label: n })),
        },
        { key: 'label', type: 'text', label: 'Label' },
        { key: 'url', type: 'url', label: 'URL', vars: true },
        { key: 'iconUrl', type: 'image', label: 'Icon (optional)' },
      ],
    },
    { key: 'iconSize', type: 'number', label: 'Icon size', min: 12, max: 64 },
    { key: 'gap', type: 'number', label: 'Gap', min: 0, max: 40, group: 'Layout' },
    { key: 'color', type: 'color', label: 'Text colour', group: 'Type' },
    { key: 'fontSize', type: 'number', label: 'Text size', min: 9, max: 20, group: 'Type' },
    ALIGN_FIELD,
    PADDING_FIELD,
    HIDE_ON_MOBILE_FIELD,
  ],
  render: {
    html(p, ctx) {
      const links = Array.isArray(p.links) ? p.links : []
      if (!links.length) return ''
      const half = Math.round((Number(p.gap) || 0) / 2)
      const items = links
        .filter((l) => l && (l.url || l.iconUrl))
        .map((link) => {
          const inner = link.iconUrl
            ? `<img${attrs({
                src: ctx.resolve(link.iconUrl),
                alt: link.label || link.network || '',
                width: String(p.iconSize ?? 24),
                height: String(p.iconSize ?? 24),
              })}${styleAttr({
                display: 'block',
                border: 0,
                width: Number(p.iconSize) || 24,
                height: Number(p.iconSize) || 24,
              })} />`
            : escapeAttr(link.label || link.network || 'link')
          return `<td${styleAttr({ padding: `0 ${half}px` })}><a href="${escapeAttr(ctx.resolve(link.url ?? ''))}" target="_blank"${styleAttr(
            mergeStyles({
              color: p.color,
              fontFamily: ctx.settings.fontFamily,
              fontSize: p.fontSize,
              textDecoration: link.iconUrl ? 'none' : 'underline',
              display: link.iconUrl ? 'block' : 'inline-block',
            }),
          )}>${inner}</a></td>`
        })
        .join('')
      return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="${escapeAttr(p.align || 'center')}"${styleAttr({ borderCollapse: 'collapse' })}><tr>${items}</tr></table>`
    },
    jsx(p) {
      const links = (Array.isArray(p.links) ? p.links : []).filter((l) => l && (l.url || l.iconUrl))
      const half = Math.round((Number(p.gap) || 0) / 2)
      return el(
        'Section',
        { style: { textAlign: p.align || 'center' } },
        links.map((link) =>
          el(
            'Link',
            {
              href: varsToAttr(link.url ?? ''),
              style: mergeStyles({
                display: 'inline-block',
                margin: `0 ${half}px`,
                color: p.color,
                fontSize: p.fontSize,
                textDecoration: link.iconUrl ? 'none' : 'underline',
              }),
            },
            link.iconUrl
              ? [
                  el('Img', {
                    src: varsToAttr(link.iconUrl),
                    alt: link.label || link.network || '',
                    width: Number(p.iconSize) || 24,
                    height: Number(p.iconSize) || 24,
                    style: { display: 'block', border: 0 },
                  }),
                ]
              : [link.label || link.network || 'link'],
          ),
        ),
      )
    },
    mjml(p, ctx) {
      const links = (Array.isArray(p.links) ? p.links : []).filter((l) => l && l.url)
      const elements = links
        .map((link) => {
          const name = KNOWN_NETWORKS.includes(link.network) ? link.network : 'web'
          return `<mj-social-element name="${escapeAttr(name)}" href="${escapeAttr(ctx.resolve(link.url))}"${link.iconUrl ? ` src="${escapeAttr(ctx.resolve(link.iconUrl))}"` : ''}>${escapeAttr(link.label ?? '')}</mj-social-element>`
        })
        .join('')
      return `<mj-social${mjCommonAttrs(p)} icon-size="${p.iconSize ?? 24}px" mode="horizontal" font-size="${p.fontSize ?? 13}px" color="${escapeAttr(p.color ?? '')}">${elements}</mj-social>`
    },
    text(p, ctx) {
      const links = Array.isArray(p.links) ? p.links : []
      return links
        .filter((l) => l && l.url)
        .map((l) => `${l.label || l.network}: ${ctx.resolve(l.url)}`)
        .join('\n')
    },
  },
  lint(p) {
    /** @type {import('../types.js').LintIssue[]} */
    const issues = []
    const links = Array.isArray(p.links) ? p.links : []
    for (const link of links) {
      if (link?.iconUrl && !link.label && !link.network) {
        issues.push({
          id: 'social-alt',
          level: 'warn',
          message: 'A social icon has no label to use as alt text.',
          hint: 'Set the label so blocked-image recipients still see the network name.',
        })
      }
    }
    return issues
  },
  parse(element, ctx) {
    const anchors = Array.from(element.querySelectorAll?.('a') ?? [])
    if (anchors.length < 2) return null
    // Every anchor must be an icon (an image, no text) for this to be a social
    // row rather than a paragraph that happens to contain links.
    const iconLinks = anchors.filter((a) => a.querySelector?.('img') && ctx.text(a) === '')
    if (iconLinks.length !== anchors.length) return null
    const first = iconLinks[0].querySelector('img')
    const size = parseInt(String(first?.getAttribute?.('width') ?? ''), 10) || 24
    return {
      ...commonProps(),
      links: iconLinks.map((a) => {
        const img = a.querySelector('img')
        const alt = img?.getAttribute?.('alt') ?? ''
        const guessed = KNOWN_NETWORKS.find((n) =>
          `${a.getAttribute?.('href') ?? ''} ${alt}`.toLowerCase().includes(n),
        )
        return {
          network: guessed ?? 'web',
          label: alt || guessed || 'link',
          url: a.getAttribute?.('href') ?? '',
          iconUrl: img?.getAttribute?.('src') ?? '',
        }
      }),
      iconSize: size,
      gap: 10,
      align: /** @type {any} */ (element.getAttribute?.('align') || 'center'),
      padding: spacing(0),
    }
  },
})
