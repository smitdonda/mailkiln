import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  patchTag,
  redo,
  reset,
  undo,
} from '../src/core/index.js'

/**
 * @param {string} label
 * @returns {any}
 */
const doc = (label) => ({ version: 1, settings: {}, sections: [], label })

/**
 * The fake documents above carry a `label` marker so the assertions read
 * clearly. It is not part of EmailDocument, hence the cast.
 *
 * @param {any} value
 * @returns {string}
 */
const labelOf = (value) => value.label

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    const history = createHistory(doc('a'))
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
  })

  it('commits, undoes and redoes', () => {
    let history = createHistory(doc('a'))
    history = commit(history, doc('b'), { now: 0 })
    expect(labelOf(history.present)).toBe('b')
    expect(canUndo(history)).toBe(true)

    history = undo(history)
    expect(labelOf(history.present)).toBe('a')
    expect(canRedo(history)).toBe(true)

    history = redo(history)
    expect(labelOf(history.present)).toBe('b')
    expect(canRedo(history)).toBe(false)
  })

  it('ignores a commit of the identical document', () => {
    const first = doc('a')
    const history = createHistory(first)
    expect(commit(history, first)).toBe(history)
  })

  it('drops the redo stack once you commit after undoing', () => {
    let history = createHistory(doc('a'))
    history = commit(history, doc('b'), { now: 0 })
    history = undo(history)
    history = commit(history, doc('c'), { now: 1000 })
    expect(canRedo(history)).toBe(false)
    expect(labelOf(history.present)).toBe('c')
  })

  it('coalesces same-tag commits inside the window into one undo step', () => {
    // The behaviour under test: typing a word must undo as a word, not as
    // eight keystrokes.
    let history = createHistory(doc(''))
    const tag = patchTag('blk_1', 'text')
    history = commit(history, doc('h'), { tag, now: 0 })
    history = commit(history, doc('he'), { tag, now: 100 })
    history = commit(history, doc('hel'), { tag, now: 200 })
    history = commit(history, doc('hell'), { tag, now: 300 })
    history = commit(history, doc('hello'), { tag, now: 400 })

    expect(history.past).toHaveLength(1)
    expect(labelOf(history.present)).toBe('hello')
    expect(labelOf(undo(history).present)).toBe('')
  })

  it('starts a new step once the window lapses', () => {
    let history = createHistory(doc(''))
    const tag = patchTag('blk_1', 'text')
    history = commit(history, doc('a'), { tag, now: 0 })
    history = commit(history, doc('ab'), { tag, now: 5000 })
    expect(history.past).toHaveLength(2)
  })

  it('does not coalesce across different fields', () => {
    let history = createHistory(doc(''))
    history = commit(history, doc('a'), { tag: patchTag('blk_1', 'text'), now: 0 })
    history = commit(history, doc('b'), { tag: patchTag('blk_1', 'color'), now: 10 })
    history = commit(history, doc('c'), { tag: patchTag('blk_2', 'text'), now: 20 })
    expect(history.past).toHaveLength(3)
  })

  it('never coalesces untagged commits — a drop is always its own step', () => {
    let history = createHistory(doc(''))
    history = commit(history, doc('a'), { now: 0 })
    history = commit(history, doc('b'), { now: 1 })
    expect(history.past).toHaveLength(2)
  })

  it('does not merge the next edit into the step it just undid', () => {
    let history = createHistory(doc(''))
    const tag = patchTag('blk_1', 'text')
    history = commit(history, doc('a'), { tag, now: 0 })
    history = undo(history)
    history = commit(history, doc('b'), { tag, now: 10 })
    expect(history.past).toHaveLength(1)
    expect(labelOf(undo(history).present)).toBe('')
  })

  it('caps the stack at the limit, dropping the oldest entries', () => {
    let history = createHistory(doc('0'), { limit: 5 })
    for (let i = 1; i <= 20; i += 1) {
      history = commit(history, doc(String(i)), { now: i * 1000 })
    }
    expect(history.past).toHaveLength(5)
    expect(labelOf(history.past[0])).toBe('15')
  })

  it('reset clears both stacks for an externally-supplied document', () => {
    let history = createHistory(doc('a'))
    history = commit(history, doc('b'), { now: 0 })
    history = reset(history, doc('external'))
    expect(labelOf(history.present)).toBe('external')
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
  })

  it('undo and redo at the ends are no-ops', () => {
    const history = createHistory(doc('a'))
    expect(undo(history)).toBe(history)
    expect(redo(history)).toBe(history)
  })
})
