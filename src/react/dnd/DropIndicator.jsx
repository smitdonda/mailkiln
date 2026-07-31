/**
 * The line showing where a dropped block will land.
 *
 * Rendered from drag state rather than by inserting a placeholder into the
 * document, so hovering never touches the document and a drag produces exactly
 * one undo entry.
 *
 * @module mailforge/react/dnd/DropIndicator
 */

import { useDragState } from './DndRoot.jsx'

/**
 * @param {object} props
 * @param {string} props.columnId
 * @param {number} props.index Position this indicator represents.
 * @returns {import('react').ReactElement | null}
 */
export function DropIndicator({ columnId, index }) {
  const { active, target } = useDragState()
  if (!active || !target) return null
  if (target.columnId !== columnId || target.index !== index) return null
  return <div className="mf-drop-indicator" aria-hidden="true" />
}
