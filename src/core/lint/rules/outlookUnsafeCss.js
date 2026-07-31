/**
 * Outlook 2007–2019 (and new Outlook on Windows for many accounts) renders with
 * Word's HTML engine. It has no flexbox, no grid, no `position`, and ignores most
 * of `float`. A layout built on those does not degrade — it collapses.
 *
 * mailforge's own renderers only ever emit tables, so anything this rule finds
 * came from a raw HTML block.
 *
 * @module mailforge/core/lint/rules/outlookUnsafeCss
 */

import { eachBlock } from '../walk.js'

/** Declarations Word's engine ignores, with what happens instead. */
const UNSAFE = [
  { pattern: /display\s*:\s*flex/i, css: 'display:flex', effect: 'children stack in source order' },
  { pattern: /display\s*:\s*grid/i, css: 'display:grid', effect: 'children stack in source order' },
  { pattern: /display\s*:\s*inline-flex/i, css: 'display:inline-flex', effect: 'falls back to inline' },
  { pattern: /position\s*:\s*(absolute|fixed|sticky)/i, css: 'position', effect: 'element renders in flow' },
  { pattern: /float\s*:\s*(left|right)/i, css: 'float', effect: 'unreliable — often ignored' },
  { pattern: /(^|[^-])transform\s*:/i, css: 'transform', effect: 'ignored' },
  { pattern: /flex-direction\s*:/i, css: 'flex-direction', effect: 'ignored' },
  { pattern: /gap\s*:/i, css: 'gap', effect: 'ignored — use cell padding' },
  { pattern: /max-height\s*:/i, css: 'max-height', effect: 'ignored' },
  { pattern: /background-size\s*:/i, css: 'background-size', effect: 'ignored — needs a VML fallback' },
]

/** @type {import('../../types.js').LintRule} */
export const outlookUnsafeCssRule = {
  id: 'outlook-unsafe-css',
  level: 'warn',
  title: 'Outlook-unsafe CSS',
  docs: "Outlook on Windows uses Word's rendering engine.",
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    for (const { block } of eachBlock(ctx.doc)) {
      const source = collectCss(block.props)
      if (!source) continue
      for (const { pattern, css, effect } of UNSAFE) {
        if (!pattern.test(source)) continue
        issues.push({
          id: 'outlook-unsafe-css',
          level: 'warn',
          message: `"${css}" is ignored by Outlook on Windows — ${effect}.`,
          hint: 'Rebuild this part with nested tables and cell padding.',
          nodeId: block.id,
          data: { css },
        })
      }
    }
    return issues
  },
}

/**
 * Every string prop of a block, concatenated — a raw HTML block hides its CSS in
 * `props.html`, and a custom block could put it anywhere.
 *
 * @param {Record<string, any>} props
 * @returns {string}
 */
function collectCss(props) {
  /** @type {string[]} */
  const parts = []
  /** @param {any} value */
  const scan = (value) => {
    if (typeof value === 'string') {
      if (value.includes(':')) parts.push(value)
    } else if (Array.isArray(value)) {
      value.forEach(scan)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(scan)
    }
  }
  scan(props ?? {})
  return parts.join('\n')
}
