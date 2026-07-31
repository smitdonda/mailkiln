/**
 * A palette entry. Draggable onto the canvas, and — because drag-only is a dead
 * end for keyboard and touch users — also activatable with Enter/click, which
 * appends the block to the selected column.
 *
 * @module mailforge/react/dnd/PaletteDraggable
 */

import { useDraggable } from '@dnd-kit/core'
import { BLOCK_ICONS, IconCode } from '../icons.jsx'

/**
 * @param {object} props
 * @param {import('../../core/types.js').BlockDef} props.def
 * @param {() => void} props.onActivate
 * @param {boolean} [props.disabled] The tool has reached its `usageLimit`.
 * @param {string} [props.disabledReason] Tooltip explaining why. A tile that greys
 *   out with no explanation reads as a bug.
 * @returns {import('react').ReactElement}
 */
export function PaletteDraggable({ def, onActivate, disabled, disabledReason }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${def.type}`,
    data: { kind: 'palette', blockType: def.type, label: def.label },
    disabled,
  })
  const Icon = BLOCK_ICONS[String(def.icon ?? '')] ?? IconCode

  return (
    <button
      type="button"
      ref={setNodeRef}
      className="mf-tile"
      data-dragging={isDragging || undefined}
      // Not `data-block-type`: canvas blocks use that, and a shared attribute
      // makes every "find the block" selector ambiguous.
      data-palette-block={def.type}
      disabled={disabled || undefined}
      title={disabled ? disabledReason || def.label : def.label}
      onClick={onActivate}
      {...attributes}
      {...listeners}
    >
      <span className="mf-tile-icon">
        <Icon />
      </span>
      <span>{def.label}</span>
    </button>
  )
}
