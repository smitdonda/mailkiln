/**
 * The nine built-in blocks.
 *
 * Importing this module registers them, and `builtinBlocks` *uses* every import
 * — which is deliberate. A bare side-effect-only import would be a legal
 * tree-shaking target for Rollup, and the blocks would vanish from the published
 * bundle. Referencing them keeps that impossible.
 *
 * @module mailkiln/core/blocks
 */

import { textBlock } from './text.js'
import { headingBlock } from './heading.js'
import { imageBlock } from './image.js'
import { buttonBlock } from './button.js'
import { dividerBlock } from './divider.js'
import { spacerBlock } from './spacer.js'
import { socialBlock } from './social.js'
import { htmlBlock } from './html.js'
import { videoThumbBlock } from './videoThumb.js'

export {
  textBlock,
  headingBlock,
  imageBlock,
  buttonBlock,
  dividerBlock,
  spacerBlock,
  socialBlock,
  htmlBlock,
  videoThumbBlock,
}

/**
 * Palette order.
 *
 * @type {import('../types.js').BlockDef[]}
 */
export const builtinBlocks = [
  textBlock,
  headingBlock,
  imageBlock,
  buttonBlock,
  dividerBlock,
  spacerBlock,
  socialBlock,
  videoThumbBlock,
  htmlBlock,
]

export { PADDING_FIELD, ALIGN_FIELD, BACKGROUND_FIELD, FONT_FIELD, FONT_OPTIONS, WEIGHT_OPTIONS, commonProps, mjCommonAttrs, stripTags, widthValue } from './shared.js'
