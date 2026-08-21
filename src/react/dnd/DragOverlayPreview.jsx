/**
 * The thing that follows the cursor during a drag.
 *
 * A label chip, not the block itself: rendering the real block in the overlay
 * means every block renders twice for the whole drag, and a 600px-wide email
 * block under the cursor obscures the drop indicator you are trying to aim.
 *
 * @module mailkiln/react/dnd/DragOverlayPreview
 */

import { getBlockDef } from '../../core/index.js'
import { BLOCK_ICONS, IconDrag } from '../icons.jsx'

/**
 * @param {object} props
 * @param {import('./resolveDrop.js').DragData} props.data
 * @returns {import('react').ReactElement}
 */
export function DragOverlayPreview({ data }) {
  const type = data.kind === 'palette' ? data.blockType : undefined
  const def = type ? getBlockDef(type) : undefined
  const label = def?.label ?? (data.kind === 'palette' ? type : 'Block')
  const Icon = BLOCK_ICONS[String(def?.icon ?? '')] ?? IconDrag

  return (
    <div className="mk-drag-ghost">
      <Icon />
      <span>{label}</span>
    </div>
  )
}
