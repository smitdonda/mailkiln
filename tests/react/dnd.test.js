/**
 * The parts of the editor that are pure functions.
 *
 * Drop resolution, palette policy and the layout presets are all decided
 * without a DOM on purpose — asserting drop behaviour through synthetic pointer
 * events is the kind of test that passes while the feature is broken.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { ROW_PRESETS, matchPreset } from '../../src/react/rowPresets.js'
import { activeCenterY, isNoopDrop, resolveDropTarget } from '../../src/react/dnd/resolveDrop.js'
import { applyTools, countBlocks, exhaustedTools } from '../../src/react/tools.js'
import { builtinBlocks, createBlock, resetIds } from '../../src/core/index.js'
import { docOf } from '../support/kit.js'

afterEach(() => resetIds())

describe('resolveDropTarget()', () => {
  it('appends when the drag is over a column rather than a block', () => {
    expect(
      resolveDropTarget({
        overData: { kind: 'column', columnId: 'col_1' },
        blockCountInOverColumn: 3,
      }),
    ).toEqual({ columnId: 'col_1', index: 3 })
  })

  it('treats an unknown block count as an empty column', () => {
    expect(resolveDropTarget({ overData: { kind: 'column', columnId: 'col_1' } })).toEqual({
      columnId: 'col_1',
      index: 0,
    })
  })

  it('inserts before or after a block, decided by which half the centre is in', () => {
    const overData = /** @type {const} */ ({ kind: 'block', columnId: 'col_1', index: 2 })
    const overRect = { top: 100, height: 40 }

    expect(resolveDropTarget({ overData, overRect, activeCenterY: 110 })).toEqual({
      columnId: 'col_1',
      index: 2,
    })
    expect(resolveDropTarget({ overData, overRect, activeCenterY: 130 })).toEqual({
      columnId: 'col_1',
      index: 3,
    })
  })

  it('falls back to the block’s own index when there is no geometry', () => {
    // This is the keyboard sensor's path: it has no pointer and no rect.
    expect(resolveDropTarget({ overData: { kind: 'block', columnId: 'col_1', index: 2 } })).toEqual(
      { columnId: 'col_1', index: 2 },
    )
  })

  it('is null for anything it cannot address', () => {
    expect(resolveDropTarget({ overData: null })).toBeNull()
    expect(resolveDropTarget({ overData: { kind: 'column' } })).toBeNull()
    expect(resolveDropTarget({ overData: { kind: 'block', columnId: 'col_1' } })).toBeNull()
    expect(resolveDropTarget({ overData: { kind: 'palette', blockType: 'text' } })).toBeNull()
  })
})

describe('isNoopDrop()', () => {
  it('spots a drag that would put a block back where it already is', () => {
    const active = /** @type {const} */ ({ kind: 'block', columnId: 'col_1', index: 2 })
    expect(isNoopDrop(active, { columnId: 'col_1', index: 2 })).toBe(true)
    expect(isNoopDrop(active, { columnId: 'col_1', index: 3 })).toBe(true)
    expect(isNoopDrop(active, { columnId: 'col_1', index: 1 })).toBe(false)
    expect(isNoopDrop(active, { columnId: 'col_2', index: 2 })).toBe(false)
  })

  it('never calls a palette drop a no-op — it always adds something', () => {
    expect(
      isNoopDrop({ kind: 'palette', blockType: 'text' }, { columnId: 'col_1', index: 0 }),
    ).toBe(false)
  })
})

describe('activeCenterY()', () => {
  it('prefers where the item is now, and falls back to where it started', () => {
    expect(
      activeCenterY({ translated: { top: 100, height: 40 }, initial: { top: 0, height: 40 } }),
    ).toBe(120)
    expect(activeCenterY({ translated: null, initial: { top: 0, height: 40 } })).toBe(20)
    expect(activeCenterY(null)).toBeUndefined()
    expect(activeCenterY({})).toBeUndefined()
  })
})

describe('applyTools()', () => {
  it('is the identity when no config is given', () => {
    expect(applyTools(builtinBlocks)).toBe(builtinBlocks)
  })

  it('removes a disabled tool from the palette', () => {
    const types = applyTools(builtinBlocks, { image: { enabled: false } }).map((d) => d.type)
    expect(types).not.toContain('image')
    expect(types).toContain('text')
  })

  it('sorts positioned tools ahead of the unpositioned ones, in position order', () => {
    const types = applyTools(builtinBlocks, {
      button: { position: 1 },
      divider: { position: 0 },
    }).map((d) => d.type)
    expect(types.slice(0, 2)).toEqual(['divider', 'button'])
    // Everything else keeps the order the palette declared.
    expect(types.slice(2, 4)).toEqual(['text', 'heading'])
  })

  it('leaves ties in their declared order', () => {
    const types = applyTools(builtinBlocks, { divider: { position: 0 }, spacer: { position: 0 } })
    expect(types.slice(0, 2).map((d) => d.type)).toEqual(['divider', 'spacer'])
  })
})

describe('usage limits', () => {
  it('counts the blocks of a type already in the document', () => {
    const doc = docOf([createBlock('button'), createBlock('text'), createBlock('button')])
    expect(countBlocks(doc, 'button')).toBe(2)
    expect(countBlocks(doc, 'image')).toBe(0)
    expect(countBlocks(/** @type {any} */ (null), 'text')).toBe(0)
  })

  it('reports the tools that have hit their limit', () => {
    const doc = docOf([createBlock('button')])
    expect(exhaustedTools(doc, { button: { usageLimit: 1 } }).has('button')).toBe(true)
    expect(exhaustedTools(doc, { button: { usageLimit: 2 } }).has('button')).toBe(false)
    expect(exhaustedTools(doc, { button: {} }).size).toBe(0)
    expect(exhaustedTools(doc).size).toBe(0)
  })

  it('treats a limit of zero as "never offer this"', () => {
    expect(exhaustedTools(docOf(), { image: { usageLimit: 0 } }).has('image')).toBe(true)
  })
})

describe('row presets', () => {
  it('ships eight layouts, each summing to 100', () => {
    expect(ROW_PRESETS).toHaveLength(8)
    for (const preset of ROW_PRESETS) {
      expect(preset.widths.reduce((a, b) => a + b, 0)).toBe(100)
    }
  })

  it('matches a row back to the preset it came from, allowing for rounding', () => {
    expect(matchPreset([50, 50])).toBe('2')
    expect(matchPreset([34, 33, 33])).toBe('3')
    expect(matchPreset([33, 34, 33])).toBe('3')
    expect(matchPreset([67, 33])).toBe('2-1')
  })

  it('is null for a layout nobody offers', () => {
    expect(matchPreset([90, 10])).toBeNull()
    expect(matchPreset([])).toBeNull()
  })
})
