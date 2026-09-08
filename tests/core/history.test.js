/**
 * Undo / redo.
 *
 * The clock is injected, so every coalescing assertion here is exact rather
 * than a race against a real timer.
 */

import { describe, expect, it } from 'vitest'
import {
  COALESCE_MS,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  commit,
  createHistory,
  patchTag,
  redo,
  reset,
  undo,
} from '../../src/core/index.js'

/**
 * Documents here only need to be distinguishable, not valid — history stores
 * whatever it is handed.
 *
 * @param {string} label
 * @returns {any}
 */
const state = (label) => ({ label })

describe('createHistory()', () => {
  it('starts with the present and nothing on either side', () => {
    const history = createHistory(state('a'))
    expect(history.present).toEqual(state('a'))
    expect(history.past).toEqual([])
    expect(history.future).toEqual([])
    expect(history.limit).toBe(HISTORY_LIMIT)
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
  })

  it('takes a smaller limit', () => {
    expect(createHistory(state('a'), { limit: 5 }).limit).toBe(5)
  })
})

describe('commit()', () => {
  it('pushes the old present onto the past', () => {
    const first = createHistory(state('a'))
    const second = commit(first, state('b'), { now: 0 })

    expect(second.present).toEqual(state('b'))
    expect(second.past).toEqual([state('a')])
    expect(canUndo(second)).toBe(true)
  })

  it('ignores a commit of the value already present', () => {
    const present = state('a')
    const history = createHistory(present)
    expect(commit(history, present)).toBe(history)
  })

  it('collapses same-tag commits inside the window into one undo step', () => {
    const tag = patchTag('blk_1', 'text')
    let history = createHistory(state(''))
    history = commit(history, state('H'), { tag, now: 0 })
    history = commit(history, state('He'), { tag, now: 100 })
    history = commit(history, state('Hel'), { tag, now: 200 })

    expect(history.present).toEqual(state('Hel'))
    expect(history.past).toHaveLength(1)
    expect(undo(history).present).toEqual(state(''))
  })

  it('starts a new entry once the window has passed', () => {
    const tag = patchTag('blk_1', 'text')
    let history = createHistory(state(''))
    history = commit(history, state('H'), { tag, now: 0 })
    history = commit(history, state('He'), { tag, now: COALESCE_MS + 1 })

    expect(history.past).toHaveLength(2)
  })

  it('starts a new entry when the tag changes, so jumping fields is undoable', () => {
    let history = createHistory(state(''))
    history = commit(history, state('a'), { tag: patchTag('blk_1', 'text'), now: 0 })
    history = commit(history, state('b'), { tag: patchTag('blk_1', 'href'), now: 10 })

    expect(history.past).toHaveLength(2)
  })

  it('never coalesces untagged commits, however fast they arrive', () => {
    let history = createHistory(state(''))
    history = commit(history, state('a'), { now: 0 })
    history = commit(history, state('b'), { now: 1 })

    expect(history.past).toHaveLength(2)
  })

  it('honours a custom coalesce window', () => {
    const tag = 'drag'
    let history = createHistory(state(''))
    history = commit(history, state('a'), { tag, now: 0, coalesceMs: 50 })
    history = commit(history, state('b'), { tag, now: 60, coalesceMs: 50 })

    expect(history.past).toHaveLength(2)
  })

  it('drops the oldest entries once the limit is reached', () => {
    let history = createHistory(state('0'), { limit: 3 })
    for (let i = 1; i <= 6; i += 1) history = commit(history, state(String(i)), { now: i * 1000 })

    expect(history.past).toHaveLength(3)
    expect(history.past.map((/** @type {any} */ s) => s.label)).toEqual(['3', '4', '5'])
  })

  it('clears the redo stack, including on a coalesced commit', () => {
    let history = createHistory(state('a'))
    history = commit(history, state('b'), { now: 0 })
    history = undo(history)
    expect(canRedo(history)).toBe(true)

    history = commit(history, state('c'), { tag: 'x', now: 10 })
    expect(history.future).toEqual([])
  })
})

describe('undo() / redo()', () => {
  it('walks back and forward through the stack', () => {
    let history = createHistory(state('a'))
    history = commit(history, state('b'), { now: 0 })
    history = commit(history, state('c'), { now: 1000 })

    history = undo(history)
    expect(history.present).toEqual(state('b'))
    history = undo(history)
    expect(history.present).toEqual(state('a'))
    expect(canUndo(history)).toBe(false)

    history = redo(history)
    expect(history.present).toEqual(state('b'))
    history = redo(history)
    expect(history.present).toEqual(state('c'))
    expect(canRedo(history)).toBe(false)
  })

  it('is a no-op at either end', () => {
    const history = createHistory(state('a'))
    expect(undo(history)).toBe(history)
    expect(redo(history)).toBe(history)
  })

  it('breaks coalescing, so the next edit cannot merge into the undone step', () => {
    const tag = patchTag('blk_1', 'text')
    let history = createHistory(state(''))
    history = commit(history, state('a'), { tag, now: 0 })
    history = undo(history)
    history = commit(history, state('b'), { tag, now: 10 })

    expect(history.past).toHaveLength(1)
    expect(undo(history).present).toEqual(state(''))
  })
})

describe('reset()', () => {
  it('replaces the present and forgets both stacks', () => {
    let history = createHistory(state('a'))
    history = commit(history, state('b'), { now: 0 })
    history = undo(history)

    const fresh = reset(history, state('external'))
    expect(fresh.present).toEqual(state('external'))
    expect(fresh.past).toEqual([])
    expect(fresh.future).toEqual([])
    expect(fresh.limit).toBe(history.limit)
  })
})

describe('patchTag()', () => {
  it('is unique per node and per property', () => {
    expect(patchTag('blk_1', 'text')).toBe('patch:blk_1:text')
    expect(patchTag('blk_1', 'text')).not.toBe(patchTag('blk_2', 'text'))
    expect(patchTag('blk_1', 'text')).not.toBe(patchTag('blk_1', 'href'))
  })
})
