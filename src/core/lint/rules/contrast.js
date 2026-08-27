/**
 * Contrast, in both light and forced-dark rendering.
 *
 * The dark-mode half is the one people get wrong. Outlook.com, Gmail on Android
 * and Apple Mail will *invert your colours for you* when the OS is in dark mode.
 * A design that only declares a text colour and leaves the background white
 * becomes dark-grey-on-dark. Declaring both is what makes the inversion safe.
 *
 * @module mailkiln/core/lint/rules/contrast
 */

import { eachBlock, effectiveBackground } from '../walk.js'
import { contrastRatio, isNearBlack, isNearWhite, parseColor } from '../color.js'

/** WCAG AA for body text. */
const MIN_RATIO = 4.5

/** WCAG AA for large text (18pt+/24px+, or 14pt+/19px+ bold). */
const MIN_RATIO_LARGE = 3

/** @type {import('../../types.js').LintRule} */
export const contrastRule = {
  id: 'contrast',
  level: 'warn',
  title: 'Text contrast',
  docs: 'WCAG AA: 4.5:1 for body text, 3:1 for large text.',
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    const settings = ctx.doc.settings ?? {}

    for (const { block } of eachBlock(ctx.doc)) {
      if (block.type !== 'text' && block.type !== 'heading' && block.type !== 'button') continue

      const isButton = block.type === 'button'
      const foreground = block.props?.color || (isButton ? '#ffffff' : settings.textColor)
      const background = isButton
        ? block.props?.buttonColor
        : effectiveBackground(ctx.doc, block.id)
      if (!foreground || !background) continue

      const size = Number(block.props?.fontSize) || (block.type === 'heading' ? 26 : 16)
      const bold = String(block.props?.fontWeight ?? '') === 'bold'
      const minimum = size >= 24 || (size >= 19 && bold) ? MIN_RATIO_LARGE : MIN_RATIO

      const ratio = contrastRatio(String(foreground), String(background))
      if (ratio !== null && ratio < minimum) {
        issues.push({
          id: 'contrast',
          level: ratio < minimum - 1.5 ? 'error' : 'warn',
          // Two decimals, not one: rounding 4.49 to "4.5" against a 4.5 minimum
          // makes a correct warning read like a bug.
          message: `${foreground} on ${background} is ${ratio.toFixed(2)}:1 — below the ${minimum}:1 minimum.`,
          hint: 'Darken the text or lighten the background.',
          nodeId: block.id,
          data: { ratio, minimum, foreground, background },
        })
      }

      // Links are copy too, and they are now coloured by their own field rather
      // than by the block's — checking only `color` would have quietly stopped
      // examining half the words in a footer.
      if (isButton || !/<a[\s>]/i.test(String(block.props?.text ?? ''))) continue
      const linkColor = block.props?.linkColor || settings.linkColor
      if (!linkColor) continue
      const linkRatio = contrastRatio(String(linkColor), String(background))
      if (linkRatio === null || linkRatio >= minimum) continue
      issues.push({
        id: 'contrast',
        level: linkRatio < minimum - 1.5 ? 'error' : 'warn',
        message: `Link colour ${linkColor} on ${background} is ${linkRatio.toFixed(2)}:1 — below the ${minimum}:1 minimum.`,
        hint: 'Set a brighter link colour on this block, or change the document link colour.',
        nodeId: block.id,
        data: { ratio: linkRatio, minimum, foreground: linkColor, background },
      })
    }

    return issues
  },
}

/** @type {import('../../types.js').LintRule} */
export const darkModeRule = {
  id: 'dark-mode',
  level: 'warn',
  title: 'Dark mode safety',
  docs: 'Several clients invert colours automatically in dark mode.',
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    const settings = ctx.doc.settings ?? {}

    for (const { block } of eachBlock(ctx.doc)) {
      if (block.type !== 'text' && block.type !== 'heading') continue
      const color = String(block.props?.color ?? '')
      if (!color) continue

      // Near-white text only works because of a background this block declares.
      // If it doesn't declare one, a dark-mode client that inverts the background
      // to dark leaves white-on-white or near-black-on-black.
      if (isNearWhite(color) && !block.props?.backgroundColor) {
        const inherited = effectiveBackground(ctx.doc, block.id)
        if (isNearWhite(inherited)) {
          issues.push({
            id: 'dark-mode',
            level: 'error',
            message: 'Near-white text sits on a near-white background.',
            hint: 'Set an explicit background on the block, its column or its section.',
            nodeId: block.id,
          })
        }
      }

      if (isNearBlack(color) && parseColor(color)) {
        const background = effectiveBackground(ctx.doc, block.id)
        if (isNearWhite(background) && !hasExplicitBackground(ctx.doc, block.id)) {
          issues.push({
            id: 'dark-mode',
            level: 'info',
            message: 'Near-black text relies on an undeclared white background.',
            hint: 'Clients that force dark mode may invert the background but keep this colour. Declare the background explicitly.',
            nodeId: block.id,
          })
        }
      }
    }

    if (settings.darkModeAware === false) {
      issues.push({
        id: 'dark-mode',
        level: 'info',
        message: 'Dark mode support is switched off for this template.',
        hint: 'Without the color-scheme meta tags, clients are free to invert your palette however they like.',
      })
    }

    return issues
  },
}

/**
 * @param {import('../../types.js').EmailDocument} doc
 * @param {string} blockId
 * @returns {boolean} true when some ancestor declares a background colour
 */
function hasExplicitBackground(doc, blockId) {
  for (const section of doc.sections ?? []) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const block of column.blocks ?? []) {
          if (block.id !== blockId) continue
          return !!(
            block.props?.backgroundColor ||
            column.props?.backgroundColor ||
            row.props?.backgroundColor ||
            section.props?.backgroundColor
          )
        }
      }
    }
  }
  return false
}
