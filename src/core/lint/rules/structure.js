/**
 * Structural rules — the things that are wrong with the document itself rather
 * than with a client's rendering of it.
 *
 * @module mailkiln/core/lint/rules/structure
 */

import { eachBlock } from '../walk.js'

/** Beyond this, mobile stacking produces unreadably narrow columns. */
const MAX_COLUMNS = 4

/** @type {import('../../types.js').LintRule} */
export const structureRule = {
  id: 'structure',
  level: 'warn',
  title: 'Layout structure',
  docs: 'Empty containers, over-split rows, oversized templates.',
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    const settings = ctx.doc.settings ?? {}

    if (Number(settings.width) > 640) {
      issues.push({
        id: 'structure',
        level: 'warn',
        message: `Content width is ${settings.width}px.`,
        hint: 'Outlook’s reading pane and most mobile clients are comfortable up to ~600px. Wider templates get horizontally scrolled or shrunk.',
      })
    }

    for (const section of ctx.doc.sections ?? []) {
      for (const row of section.rows ?? []) {
        const columns = row.columns ?? []
        if (columns.length > MAX_COLUMNS) {
          issues.push({
            id: 'structure',
            level: 'warn',
            message: `A row has ${columns.length} columns.`,
            hint: `More than ${MAX_COLUMNS} columns leaves each one too narrow to read once stacked on mobile.`,
            nodeId: row.id,
          })
        }
        const empty = columns.filter((c) => (c.blocks ?? []).length === 0)
        if (empty.length && empty.length === columns.length) {
          issues.push({
            id: 'structure',
            level: 'info',
            message: 'A row has no content in any column.',
            hint: 'It renders as blank vertical space. Delete it or add a spacer block, which says what you mean.',
            nodeId: row.id,
          })
        }
        if (row.props?.stackOnMobile === false && columns.length > 2) {
          issues.push({
            id: 'structure',
            level: 'warn',
            message: `A ${columns.length}-column row is set not to stack on mobile.`,
            hint: 'On a 320px screen each column gets ~100px. Turn stacking back on unless these are icons.',
            nodeId: row.id,
          })
        }
      }
    }

    if (!settings.subject) {
      issues.push({
        id: 'structure',
        level: 'info',
        message: 'No subject line set.',
        hint: 'mailkiln uses it for the <title>, the export filename and the component name.',
      })
    }

    const blocks = eachBlock(ctx.doc)
    if (blocks.length === 0) {
      issues.push({
        id: 'structure',
        level: 'info',
        message: 'The template is empty.',
        hint: 'Drag a block from the palette to get started.',
      })
    }

    return issues
  },
}

/** @type {import('../../types.js').LintRule} */
export const linkRule = {
  id: 'links',
  level: 'warn',
  title: 'Link hygiene',
  docs: 'Relative and bare-anchor links do not work in an inbox.',
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    for (const { block } of eachBlock(ctx.doc)) {
      for (const { key, url } of collectLinks(block.props)) {
        if (!url || url.startsWith('{{')) continue
        if (/^(https?:|mailto:|tel:|sms:|#)/i.test(url)) {
          if (url === '#') {
            issues.push({
              id: 'links',
              level: 'error',
              message: `${block.type} "${key}" links to "#".`,
              hint: 'A placeholder link that shipped is a dead click.',
              nodeId: block.id,
            })
          }
          continue
        }
        issues.push({
          id: 'links',
          level: 'error',
          message: `${block.type} "${key}" is a relative URL ("${url}").`,
          hint: 'An email client has no page to resolve it against. Use an absolute https:// URL.',
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
 * @returns {Array<{ key: string, url: string }>}
 */
function collectLinks(props) {
  /** @type {Array<{ key: string, url: string }>} */
  const out = []
  /**
   * @param {any} value
   * @param {string} key
   */
  const scan = (value, key) => {
    if (typeof value === 'string') {
      if (/^(href|url|videoUrl|link)$/i.test(key)) out.push({ key, url: value })
    } else if (Array.isArray(value)) {
      value.forEach((item) => scan(item, key))
    } else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) scan(child, childKey)
    }
  }
  for (const [key, value] of Object.entries(props ?? {})) scan(value, key)
  return out
}
