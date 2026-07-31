/**
 * Where a drag would land, as a pure function.
 *
 * Kept free of dnd-kit and the DOM so it can be unit-tested with plain objects —
 * the alternative is asserting drop behaviour through synthetic pointer events in
 * jsdom, which is exactly the kind of test that passes while the feature is
 * broken.
 *
 * @module mailforge/react/dnd/resolveDrop
 */

/**
 * @typedef {object} DropTarget
 * @property {string} columnId
 * @property {number} index
 */

/**
 * @typedef {object} DragData
 * @property {'palette' | 'block' | 'column'} kind Two drag sources ('palette',
 *   'block') and one droppable kind ('column'), distinguished by this field —
 *   which is how one DndContext serves both.
 * @property {string} [blockType] Palette drags.
 * @property {string} [blockId] Canvas drags.
 * @property {string} [columnId]
 * @property {number} [index]
 */

/**
 * @param {object} args
 * @param {DragData | null | undefined} args.overData Droppable data of what we're over.
 * @param {number} [args.activeCenterY] Centre of the dragged item, viewport px.
 * @param {{ top: number, height: number } | null} [args.overRect] Rect of what we're over.
 * @param {number} [args.blockCountInOverColumn] Used when dropping onto a column.
 * @returns {DropTarget | null}
 */
export function resolveDropTarget({ overData, activeCenterY, overRect, blockCountInOverColumn }) {
  if (!overData) return null

  // Over a column (its empty area, or its tail zone): append.
  if (overData.kind === 'column' && overData.columnId) {
    return { columnId: overData.columnId, index: blockCountInOverColumn ?? 0 }
  }

  // Over a block: insert before or after it, decided by which half of the block
  // the dragged item's centre is in. Using the centre rather than the pointer is
  // what makes the keyboard sensor work — it has no pointer.
  if (overData.kind === 'block' && overData.columnId && typeof overData.index === 'number') {
    let index = overData.index
    if (overRect && typeof activeCenterY === 'number') {
      const middle = overRect.top + overRect.height / 2
      if (activeCenterY > middle) index += 1
    }
    return { columnId: overData.columnId, index }
  }

  return null
}

/**
 * Is this drop a no-op? Worth knowing before committing, so a drag that changes
 * nothing doesn't add an undo entry.
 *
 * @param {DragData} activeData
 * @param {DropTarget} target
 * @returns {boolean}
 */
export function isNoopDrop(activeData, target) {
  if (activeData.kind !== 'block') return false
  if (activeData.columnId !== target.columnId) return false
  if (typeof activeData.index !== 'number') return false
  return target.index === activeData.index || target.index === activeData.index + 1
}

/**
 * The centre Y of a dragged item, from dnd-kit's rects. `translated` is where the
 * item currently is on screen; `initial` is the fallback for the keyboard sensor
 * before the first move.
 *
 * @param {{ translated?: { top: number, height: number } | null, initial?: { top: number, height: number } | null } | null | undefined} activeRect
 * @returns {number | undefined}
 */
export function activeCenterY(activeRect) {
  const rect = activeRect?.translated ?? activeRect?.initial
  if (!rect) return undefined
  return rect.top + rect.height / 2
}
