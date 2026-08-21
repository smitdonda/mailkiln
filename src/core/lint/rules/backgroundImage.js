/**
 * Background images need a VML fallback for Outlook, and a background *colour*
 * behind them so the text stays readable when the image is blocked or fails.
 *
 * mailkiln's section renderer emits the VML itself, so the VML half of this rule
 * only fires on raw HTML blocks. The colour half applies everywhere.
 *
 * @module mailkiln/core/lint/rules/backgroundImage
 */

import { eachBlock } from '../walk.js'
import { contrastRatio } from '../color.js'

/** @type {import('../../types.js').LintRule} */
export const backgroundImageRule = {
  id: 'background-image',
  level: 'warn',
  title: 'Background images need fallbacks',
  docs: 'Outlook needs VML; blocked images need a background colour.',
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []

    for (const section of ctx.doc.sections ?? []) {
      if (!section.props?.backgroundImage) continue
      if (!section.props?.backgroundColor) {
        issues.push({
          id: 'background-image',
          level: 'warn',
          message: 'Section has a background image but no background colour.',
          hint: 'Set a colour close to the image. It is what shows when the image is blocked, still loading, or fails.',
          nodeId: section.id,
        })
      }
      const hasText = (section.rows ?? []).some((row) =>
        (row.columns ?? []).some((col) =>
          (col.blocks ?? []).some((b) => b.type === 'text' || b.type === 'heading'),
        ),
      )
      const color = section.props.backgroundColor
      if (hasText && color) {
        const textColor = ctx.doc.settings?.textColor ?? '#000000'
        const ratio = contrastRatio(textColor, color)
        if (ratio !== null && ratio < 4.5) {
          issues.push({
            id: 'background-image',
            level: 'warn',
            message: `Text over this section's fallback colour has ${ratio.toFixed(1)}:1 contrast (4.5:1 is the readable minimum).`,
            hint: 'Recipients with images off see exactly this. Darken the fallback or lighten the text.',
            nodeId: section.id,
            data: { ratio },
          })
        }
      }
    }

    for (const { block } of eachBlock(ctx.doc)) {
      if (block.type !== 'html') continue
      const html = String(block.props?.html ?? '')
      if (!/background(-image)?\s*:\s*url\(/i.test(html)) continue
      if (/v:rect|v:fill|v:image/i.test(html)) continue
      issues.push({
        id: 'background-image',
        level: 'warn',
        message: 'Raw HTML sets a background image with no VML fallback.',
        hint: 'Outlook on Windows shows nothing. Wrap it in <!--[if gte mso 9]><v:rect>…, or move it to a section background where mailkiln writes the VML for you.',
        nodeId: block.id,
      })
    }

    return issues
  },
}
