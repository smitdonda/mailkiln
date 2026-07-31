/**
 * Raw HTML block.
 *
 * This block is load-bearing for pillar 2: anything the importer cannot confidently
 * recognise is preserved here verbatim. Import may degrade in *editability*, never
 * in *content* — that guarantee is what makes migrating off another builder safe,
 * and it lives in these ~60 lines.
 *
 * @module mailforge/core/blocks/html
 */

import { defineBlock } from '../registry.js'
import { spacing } from '../schema.js'
import { el, raw, varsToTemplate } from '../render/jsxNode.js'
import { HIDE_ON_MOBILE_FIELD, stripTags } from './shared.js'

export const htmlBlock = defineBlock({
  type: 'html',
  label: 'HTML',
  group: 'Advanced',
  icon: 'code',
  defaultProps: {
    html: '<p style="margin:0">Paste any HTML here.</p>',
    padding: spacing(0),
    align: /** @type {any} */ ('left'),
    backgroundColor: '',
    hideOnMobile: false,
    /** Set by the importer when this block holds markup it could not classify. */
    imported: false,
  },
  schema: [
    {
      key: 'html',
      type: 'textarea',
      label: 'HTML',
      vars: true,
      help: 'Emitted verbatim. Use table markup — email clients are not browsers.',
    },
    HIDE_ON_MOBILE_FIELD,
  ],
  render: {
    html(p, ctx) {
      return ctx.resolve(p.html ?? '')
    },
    jsx(p) {
      return el('div', {
        dangerouslySetInnerHTML: raw(`{{ __html: ${varsToTemplate(p.html ?? '').__raw} }}`),
      })
    },
    mjml(p, ctx) {
      return `<mj-raw>${ctx.resolve(p.html ?? '')}</mj-raw>`
    },
    text(p, ctx) {
      return stripTags(ctx.resolve(p.html ?? ''))
    },
  },
  lint(p) {
    /** @type {import('../types.js').LintIssue[]} */
    const issues = []
    const html = String(p.html ?? '')
    if (/<script|onclick=|onerror=|javascript:/i.test(html)) {
      issues.push({
        id: 'html-script',
        level: 'error',
        message: 'Raw HTML contains script or an inline event handler.',
        hint: 'Every email client strips these, and their presence alone raises spam scores.',
      })
    }
    if (/<(div|span|p)[^>]*style="[^"]*(display\s*:\s*flex|display\s*:\s*grid)/i.test(html)) {
      issues.push({
        id: 'html-modern-css',
        level: 'warn',
        message: 'Raw HTML uses flex/grid layout.',
        hint: 'Outlook (Word engine) ignores both — use nested tables inside a raw block.',
      })
    }
    if (p.imported) {
      issues.push({
        id: 'html-imported',
        level: 'info',
        message: 'This block was kept as raw HTML during import.',
        hint: 'Its content is intact but not visually editable. Replace it with native blocks when convenient.',
      })
    }
    return issues
  },
})
