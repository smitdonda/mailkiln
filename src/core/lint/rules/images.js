/**
 * Image rules: alt text, explicit width, and formats email clients don't decode.
 *
 * Outlook (and Gmail with images off) shows alt text where the image would be, so
 * alt text is not an accessibility nicety here — it is the copy a large share of
 * your recipients read first.
 *
 * @module mailkiln/core/lint/rules/images
 */

import { eachBlock } from '../walk.js'

/** Formats with no support in Outlook desktop, and what to use instead. */
const RISKY_FORMATS = [
  { ext: 'webp', clients: 'Outlook desktop and older Apple Mail', use: 'PNG or JPEG' },
  { ext: 'avif', clients: 'almost every email client', use: 'PNG or JPEG' },
  { ext: 'svg', clients: 'most email clients (and it is stripped by Gmail)', use: 'PNG' },
]

/** @type {import('../../types.js').LintRule} */
export const imageAltRule = {
  id: 'image-alt',
  level: 'warn',
  title: 'Images need alt text',
  docs: 'Blocked images are the default in several clients.',
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    for (const { block } of eachBlock(ctx.doc)) {
      const src = block.props?.src ?? block.props?.thumbnailUrl
      if (!src) continue
      const alt = String(block.props?.alt ?? '').trim()
      if (!alt) {
        issues.push({
          id: 'image-alt',
          level: 'warn',
          message: 'Image has no alt text.',
          hint: 'Write what the image says, not what it is — this is the copy shown when images are blocked.',
          nodeId: block.id,
        })
      }
    }
    return issues
  },
}

/** @type {import('../../types.js').LintRule} */
export const imageWidthRule = {
  id: 'image-width',
  level: 'info',
  title: 'Images need an explicit width',
  docs: 'Outlook cannot compute a percentage width against a table cell.',
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    for (const { block } of eachBlock(ctx.doc)) {
      if (block.type !== 'image' && block.type !== 'videoThumb') continue
      const src = block.props?.src ?? block.props?.thumbnailUrl
      if (!src) continue
      const width = String(block.props?.width ?? '').trim()
      if (!width || width.endsWith('%')) {
        issues.push({
          id: 'image-width',
          level: 'info',
          message: `Image width is "${width || 'unset'}" — Outlook will use the file's natural size.`,
          hint: 'Set a px width (e.g. 552 for a 600px template with 24px padding) so Outlook cannot render it oversized.',
          nodeId: block.id,
        })
      }
    }
    return issues
  },
}

/** @type {import('../../types.js').LintRule} */
export const imageFormatRule = {
  id: 'image-format',
  level: 'warn',
  title: 'Unsupported image formats',
  docs: 'WebP, AVIF and SVG are not universally decoded.',
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    for (const { block } of eachBlock(ctx.doc)) {
      for (const url of collectUrls(block.props)) {
        const ext = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase()
        const risky = RISKY_FORMATS.find((f) => f.ext === ext)
        if (!risky) continue
        issues.push({
          id: 'image-format',
          level: 'warn',
          message: `.${risky.ext} images are not supported by ${risky.clients}.`,
          hint: `Serve ${risky.use} instead — email has no <picture> fallback worth relying on.`,
          nodeId: block.id,
          data: { url },
        })
      }
    }
    return issues
  },
}

/**
 * @param {Record<string, any>} props
 * @returns {string[]}
 */
function collectUrls(props) {
  /** @type {string[]} */
  const out = []
  /** @param {any} value */
  const scan = (value) => {
    if (typeof value === 'string') {
      if (/^(https?:)?\/\/|^\/|^data:image/.test(value)) out.push(value)
      const inHtml = value.match(/src=["']([^"']+)["']/gi)
      if (inHtml) {
        for (const m of inHtml) out.push(m.replace(/^src=["']|["']$/gi, ''))
      }
    } else if (Array.isArray(value)) {
      value.forEach(scan)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(scan)
    }
  }
  scan(props ?? {})
  return out
}
