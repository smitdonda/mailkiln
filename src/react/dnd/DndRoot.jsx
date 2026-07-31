/**
 * One `DndContext` for the whole editor.
 *
 * The three decisions that make nested drop targets behave:
 *
 *   1. **`pointerWithin` first, `closestCenter` as fallback.** Plain
 *      `closestCenter` picks the wrong container when droppables are nested and
 *      differ in height — you get a drop into the section instead of the column
 *      under your cursor. `pointerWithin` is exact when there is a pointer;
 *      `closestCenter` is what the keyboard sensor needs, since it has none.
 *   2. **`MeasuringStrategy.Always`.** Inserting the drop indicator reflows the
 *      canvas mid-drag, so cached droppable rects go stale and the indicator
 *      starts lying about where the block will land.
 *   3. **`onDragOver` never mutates the document.** It only moves the indicator.
 *      Committing on every hover would make one drag produce a dozen undo
 *      entries and re-render the canvas continuously. `onDragEnd` commits once.
 *
 * @module mailforge/react/dnd/DndRoot
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { findNode, getBlockDef } from '../../core/index.js'
import { useI18n } from '../i18n/index.jsx'
import { useMailForgeContext } from '../context.jsx'
import { DragOverlayPreview } from './DragOverlayPreview.jsx'
import { activeCenterY, isNoopDrop, resolveDropTarget } from './resolveDrop.js'

/**
 * @typedef {object} DragState
 * @property {import('./resolveDrop.js').DragData | null} active
 * @property {import('./resolveDrop.js').DropTarget | null} target
 */

const DragContext = createContext(/** @type {DragState} */ ({ active: null, target: null }))

/**
 * @returns {DragState}
 */
export function useDragState() {
  return useContext(DragContext)
}

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
export function DndRoot({ children }) {
  const { store } = useMailForgeContext()
  const t = useI18n()
  const [active, setActive] = useState(/** @type {any} */ (null))
  const [target, setTarget] = useState(/** @type {any} */ (null))

  const sensors = useSensors(
    // distance: 4 — without an activation constraint, a click to select a block
    // registers as a drag and selection becomes impossible.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const collisionDetection = useCallback(/** @param {any} args */ (args) => {
    const withinPointer = pointerWithin(args)
    if (withinPointer.length > 0) return withinPointer
    return closestCenter(args)
  }, [])

  /**
   * @param {any} event
   * @returns {import('./resolveDrop.js').DropTarget | null}
   */
  const computeTarget = useCallback(
    /** @param {any} event */
    (event) => {
      const overData = event.over?.data?.current
      if (!overData) return null
      // Both droppable kinds carry the column id, so one lookup covers both.
      const column = findNode(store.doc, overData.columnId)
      const blockCount = column?.kind === 'column' ? (column.node.blocks?.length ?? 0) : 0
      return resolveDropTarget({
        overData,
        activeCenterY: activeCenterY(event.active?.rect?.current),
        overRect: event.over?.rect ?? null,
        blockCountInOverColumn: blockCount,
      })
    },
    [store.doc],
  )

  const handleDragStart = useCallback(/** @param {any} event */ (event) => {
    setActive(event.active?.data?.current ?? null)
  }, [])

  const handleDragOver = useCallback(
    /** @param {any} event */
    (event) => {
      setTarget(computeTarget(event))
    },
    [computeTarget],
  )

  const handleDragEnd = useCallback(
    /** @param {any} event */
    (event) => {
      const activeData = event.active?.data?.current
      const dropTarget = computeTarget(event) ?? target
      setActive(null)
      setTarget(null)
      if (!activeData || !dropTarget) return

      if (activeData.kind === 'palette' && activeData.blockType) {
        store.insertBlock(dropTarget.columnId, {
          index: dropTarget.index,
          type: activeData.blockType,
        })
        return
      }
      if (activeData.kind === 'block' && activeData.blockId) {
        if (isNoopDrop(activeData, dropTarget)) return
        store.moveBlock({
          blockId: activeData.blockId,
          toColumnId: dropTarget.columnId,
          toIndex: dropTarget.index,
        })
      }
    },
    [computeTarget, store, target],
  )

  const handleDragCancel = useCallback(() => {
    setActive(null)
    setTarget(null)
  }, [])

  const dragState = useMemo(() => ({ active, target }), [active, target])

  const accessibility = useMemo(
    () => ({
      screenReaderInstructions: { draggable: t('dnd.instructions') },
      announcements: {
        /** @param {any} event */
        onDragStart: ({ active: item }) => t('dnd.picked', { name: labelFor(item, store.doc, t) }),
        /** @param {any} event */
        onDragOver: ({ active: item, over }) =>
          over ? t('dnd.over', { name: labelFor(item, store.doc, t), index: indexOf(over) }) : '',
        /** @param {any} event */
        onDragEnd: ({ active: item, over }) =>
          over
            ? t('dnd.dropped', { name: labelFor(item, store.doc, t), index: indexOf(over) })
            : t('dnd.cancelled', { name: labelFor(item, store.doc, t) }),
        /** @param {any} event */
        onDragCancel: ({ active: item }) =>
          t('dnd.cancelled', { name: labelFor(item, store.doc, t) }),
      },
    }),
    [store.doc, t],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={accessibility}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DragContext.Provider value={dragState}>
        {children}
        {/* A light ghost, not the real block: rendering the block itself here
            doubles every render during a drag. */}
        <DragOverlay dropAnimation={null}>
          {active ? <DragOverlayPreview data={active} /> : null}
        </DragOverlay>
      </DragContext.Provider>
    </DndContext>
  )
}

/**
 * @param {any} item
 * @param {import('../../core/types.js').EmailDocument} doc
 * @param {(key: string) => string} t
 * @returns {string}
 */
function labelFor(item, doc, t) {
  const data = item?.data?.current
  if (!data) return 'block'
  if (data.kind === 'palette') return data.label ?? data.blockType ?? 'block'
  const found = data.blockId ? findNode(doc, data.blockId) : null
  if (found?.kind === 'block') {
    return getBlockDef(found.node.type)?.label ?? found.node.type
  }
  return t('canvas.drag')
}

/**
 * @param {any} over
 * @returns {number}
 */
function indexOf(over) {
  const index = over?.data?.current?.index
  return typeof index === 'number' ? index + 1 : 1
}
