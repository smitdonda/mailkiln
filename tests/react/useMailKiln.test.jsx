// @vitest-environment jsdom

/**
 * The editor's state engine.
 *
 * Every mutation is "commit a new document", which is why undo needs no special
 * cases — so these specs mostly check the seams around that: controlled mode,
 * selection that outlives its node, and the column the palette appends to.
 */

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMailKiln } from '../../src/react/useMailKiln.js'
import { createBlock, createDocument, normalize, resetIds } from '../../src/core/index.js'
import { allBlocksIn, docOf, firstColumnId, firstRowId, sampleVars } from '../support/kit.js'

afterEach(() => {
  cleanup()
  resetIds()
})

/**
 * @param {Parameters<typeof useMailKiln>[0]} [options]
 */
function editor(options = {}) {
  return renderHook((props) => useMailKiln(props), { initialProps: options })
}

describe('uncontrolled', () => {
  it('starts from an empty document when given nothing', () => {
    const { result } = editor()
    expect(result.current.doc.sections).toHaveLength(1)
    expect(result.current.canUndo).toBe(false)
  })

  it('normalizes the initial value', () => {
    const raw = /** @type {any} */ ({ sections: [] })
    const { result } = editor({ defaultValue: raw })
    expect(result.current.doc.version).toBe(1)
    expect(result.current.doc.settings.width).toBe(600)
  })

  it('commits a change and reports it upward', () => {
    const onChange = vi.fn()
    const { result } = editor({ defaultValue: docOf(), onChange })

    act(() => result.current.patchSettings({ subject: 'Hi' }))

    expect(result.current.doc.settings.subject).toBe('Hi')
    expect(result.current.canUndo).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('ignores an apply that produces nothing new', () => {
    const { result } = editor({ defaultValue: docOf() })
    act(() => result.current.apply((doc) => doc))
    expect(result.current.canUndo).toBe(false)
  })
})

describe('controlled', () => {
  it('resets history when the parent hands down a different document', () => {
    const first = normalize(docOf([createBlock('text', { text: 'one' })]))
    const second = normalize(docOf([createBlock('text', { text: 'two' })]))
    const { result, rerender } = editor({ value: first })

    act(() => result.current.patchSettings({ subject: 'local edit' }))
    expect(result.current.canUndo).toBe(true)

    rerender({ value: second })

    expect(allBlocksIn(result.current.doc)[0].props.text).toBe('two')
    expect(result.current.canUndo).toBe(false)
  })

  it('does not fight its own commit', () => {
    const value = normalize(docOf())
    const { result } = editor({ value })
    act(() => result.current.patchSettings({ subject: 'mine' }))
    expect(result.current.doc.settings.subject).toBe('mine')
  })

  it('refuses a handed-down document holding a block type nobody registered', () => {
    const good = normalize(docOf([createBlock('text')]))
    const bad = normalize(docOf([createBlock('countdown', {})]))
    const { rerender } = editor({ value: good })

    expect(() => rerender({ value: bad })).toThrow(/unregistered type "countdown"/)
  })
})

describe('undo and redo', () => {
  it('walks back and forward, telling the parent each time', () => {
    const onChange = vi.fn()
    const { result } = editor({ defaultValue: docOf(), onChange })

    act(() => result.current.patchSettings({ subject: 'a' }))
    act(() => result.current.undo())
    expect(result.current.doc.settings.subject).toBe('')
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.redo())
    expect(result.current.doc.settings.subject).toBe('a')
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('is inert at either end', () => {
    const onChange = vi.fn()
    const { result } = editor({ defaultValue: docOf(), onChange })
    act(() => result.current.undo())
    act(() => result.current.redo())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('collapses consecutive edits to one field into a single step', () => {
    const { result } = editor({ defaultValue: docOf() })
    act(() => result.current.patchSettings({ subject: 'H' }, 'subject'))
    act(() => result.current.patchSettings({ subject: 'Hi' }, 'subject'))
    act(() => result.current.patchSettings({ subject: 'Hi!' }, 'subject'))

    act(() => result.current.undo())
    expect(result.current.doc.settings.subject).toBe('')
  })
})

describe('actions', () => {
  it('selects the block it just inserted', () => {
    const { result } = editor({ defaultValue: docOf() })
    const columnId = firstColumnId(result.current.doc)

    act(() => result.current.insertBlock(columnId, { type: 'text' }))

    const [block] = allBlocksIn(result.current.doc)
    expect(block.type).toBe('text')
    expect(result.current.selectedId).toBe(block.id)
    expect(result.current.selection?.kind).toBe('block')
  })

  it('clears the selection when the selected node is removed', () => {
    const { result } = editor({ defaultValue: docOf() })
    const columnId = firstColumnId(result.current.doc)
    act(() => result.current.insertBlock(columnId, { type: 'text' }))
    const id = /** @type {string} */ (result.current.selectedId)

    act(() => result.current.remove(id))

    expect(result.current.selectedId).toBeNull()
    expect(allBlocksIn(result.current.doc)).toHaveLength(0)
  })

  it('clears a selection that disappears for any other reason', () => {
    const doc = docOf([createBlock('text')])
    const { result } = editor({ defaultValue: doc })
    const id = allBlocksIn(result.current.doc)[0].id

    act(() => result.current.select(id))
    expect(result.current.selectedId).toBe(id)

    act(() => result.current.replaceDocument(normalize(docOf())))
    expect(result.current.selectedId).toBeNull()
  })

  it('remembers the column the last selection was in', () => {
    const { result } = editor({ defaultValue: docOf() })
    const columnId = firstColumnId(result.current.doc)

    act(() => result.current.select(columnId))
    expect(result.current.focusColumnId).toBe(columnId)

    act(() => result.current.select(null))
    expect(result.current.focusColumnId).toBe(columnId)
  })

  it('duplicates, adds rows and sections, and reshapes a row', () => {
    const { result } = editor({ defaultValue: docOf([createBlock('text')]) })
    const rowId = firstRowId(result.current.doc)

    act(() => result.current.duplicate(allBlocksIn(result.current.doc)[0].id))
    expect(allBlocksIn(result.current.doc)).toHaveLength(2)

    act(() => result.current.addRow(result.current.doc.sections[0].id, 2))
    expect(result.current.doc.sections[0].rows).toHaveLength(2)

    act(() => result.current.addSection({ widths: [70, 30] }))
    expect(result.current.doc.sections).toHaveLength(2)

    act(() => result.current.setRowLayout(rowId, [25, 75]))
    expect(result.current.doc.sections[0].rows[0].columns.map((c) => c.props.width)).toEqual([
      25, 75,
    ])
  })

  it('sets a condition and a repeat through the same commit path', () => {
    const { result } = editor({ defaultValue: docOf([createBlock('text')]) })
    const blockId = allBlocksIn(result.current.doc)[0].id
    const rowId = firstRowId(result.current.doc)

    act(() => result.current.setCondition(blockId, { path: 'user.pro', op: 'truthy' }))
    act(() => result.current.setRepeat(rowId, { path: 'order.items', as: 'item' }))

    expect(allBlocksIn(result.current.doc)[0].showIf).toEqual({ path: 'user.pro', op: 'truthy' })
    expect(result.current.doc.sections[0].rows[0].repeat?.as).toBe('item')
  })

  it('moves rows and sections', () => {
    const doc = createDocument({ sections: [] })
    const { result } = editor({ defaultValue: normalize(docOf()) })

    act(() => result.current.addSection({}))
    const [first, second] = result.current.doc.sections.map((s) => s.id)

    act(() => result.current.moveSection(first, 2))
    expect(result.current.doc.sections.map((s) => s.id)).toEqual([second, first])
    expect(doc.sections).toEqual([])
  })

  it('makes an import undoable, which is what you want after a bad one', () => {
    const { result } = editor({ defaultValue: docOf([createBlock('text', { text: 'before' })]) })
    act(() => result.current.replaceDocument(normalize(docOf([createBlock('heading')]))))
    expect(allBlocksIn(result.current.doc)[0].type).toBe('heading')

    act(() => result.current.undo())
    expect(allBlocksIn(result.current.doc)[0].props.text).toBe('before')
  })
})

describe('lint', () => {
  it('re-lints on every change and exposes the result', () => {
    const { result } = editor({ defaultValue: docOf() })
    expect(result.current.lint.issues.some((i) => i.id === 'unsubscribe')).toBe(true)

    act(() => result.current.patchSettings({ preheader: 'Something to say up front' }))
    expect(result.current.lint.issues.some((i) => i.id === 'preheader')).toBe(false)
  })

  it('honours the disabled rule ids', () => {
    const { result } = editor({ defaultValue: docOf(), lintDisable: ['unsubscribe'] })
    expect(result.current.lint.issues.some((i) => i.id === 'unsubscribe')).toBe(false)
  })

  it('checks merge variables against the declared sample', () => {
    const { result } = editor({
      defaultValue: docOf([createBlock('text', { text: '{{user.nmae}}' })]),
      vars: sampleVars(),
    })
    expect(result.current.lint.issues.some((i) => i.id === 'unknown-var')).toBe(true)
    expect(result.current.vars?.has('user.name')).toBe(true)
  })
})
