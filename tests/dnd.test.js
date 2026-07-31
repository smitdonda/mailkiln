import { describe, expect, it } from 'vitest'
import { activeCenterY, isNoopDrop, resolveDropTarget } from '../src/react/dnd/resolveDrop.js'

/**
 * @param {number} top
 * @param {number} height
 * @returns {{ top: number, height: number }}
 */
const rect = (top, height) => ({ top, height })

describe('resolveDropTarget', () => {
  it('returns null with nothing under the pointer', () => {
    expect(resolveDropTarget({ overData: null })).toBeNull()
    expect(resolveDropTarget({ overData: undefined })).toBeNull()
  })

  it('appends when dropping on a column', () => {
    expect(
      resolveDropTarget({
        overData: { kind: 'column', columnId: 'col_1' },
        blockCountInOverColumn: 3,
      }),
    ).toEqual({ columnId: 'col_1', index: 3 })
  })

  it('appends at 0 for an empty column', () => {
    expect(
      resolveDropTarget({
        overData: { kind: 'column', columnId: 'col_1' },
        blockCountInOverColumn: 0,
      }),
    ).toEqual({ columnId: 'col_1', index: 0 })
  })

  it('inserts before a block when the dragged centre is in its top half', () => {
    expect(
      resolveDropTarget({
        overData: { kind: 'block', columnId: 'col_1', index: 2 },
        overRect: rect(100, 50),
        activeCenterY: 110,
      }),
    ).toEqual({ columnId: 'col_1', index: 2 })
  })

  it('inserts after a block when the dragged centre is in its bottom half', () => {
    expect(
      resolveDropTarget({
        overData: { kind: 'block', columnId: 'col_1', index: 2 },
        overRect: rect(100, 50),
        activeCenterY: 140,
      }),
    ).toEqual({ columnId: 'col_1', index: 3 })
  })

  it('inserts before when there is no rect — the keyboard sensor has no pointer', () => {
    expect(
      resolveDropTarget({ overData: { kind: 'block', columnId: 'col_1', index: 2 } }),
    ).toEqual({ columnId: 'col_1', index: 2 })
  })

  it('ignores droppable data it does not understand', () => {
    expect(resolveDropTarget({ overData: { kind: 'palette', blockType: 'text' } })).toBeNull()
    expect(resolveDropTarget({ overData: { kind: 'block', columnId: 'c' } })).toBeNull()
  })
})

describe('isNoopDrop', () => {
  it('is true when a block lands where it already is', () => {
    const active = /** @type {any} */ ({ kind: 'block', blockId: 'b', columnId: 'col_1', index: 2 })
    // Both index 2 (before itself) and index 3 (after itself) mean "no change".
    expect(isNoopDrop(active, { columnId: 'col_1', index: 2 })).toBe(true)
    expect(isNoopDrop(active, { columnId: 'col_1', index: 3 })).toBe(true)
  })

  it('is false for a real move', () => {
    const active = /** @type {any} */ ({ kind: 'block', blockId: 'b', columnId: 'col_1', index: 2 })
    expect(isNoopDrop(active, { columnId: 'col_1', index: 0 })).toBe(false)
    expect(isNoopDrop(active, { columnId: 'col_2', index: 2 })).toBe(false)
  })

  it('is never true for a palette drag — that always inserts', () => {
    expect(isNoopDrop(/** @type {any} */ ({ kind: 'palette', blockType: 'text' }), { columnId: 'c', index: 0 })).toBe(false)
  })
})

describe('activeCenterY', () => {
  it('prefers the translated rect, which is where the item currently is', () => {
    expect(activeCenterY({ translated: rect(200, 40), initial: rect(0, 40) })).toBe(220)
  })

  it('falls back to the initial rect before the first keyboard move', () => {
    expect(activeCenterY({ translated: null, initial: rect(0, 40) })).toBe(20)
  })

  it('returns undefined when there is no rect at all', () => {
    expect(activeCenterY(null)).toBeUndefined()
    expect(activeCenterY({})).toBeUndefined()
  })
})
