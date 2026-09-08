/**
 * Pure document operations.
 *
 * Two properties matter as much as the results themselves and are asserted
 * throughout: every op returns a *new* document without touching the branches it
 * did not change, and an op that changes nothing returns the document it was
 * given (which is what stops a React effect looping).
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  createBlock,
  createColumn,
  createDocument,
  createRow,
  createSection,
  duplicateNode,
  findNode,
  insertBlock,
  insertRow,
  insertSection,
  listBlocks,
  listColumns,
  moveBlock,
  moveRow,
  moveSection,
  nodeKind,
  normalize,
  patchProps,
  patchSettings,
  removeBlock,
  removeNode,
  resetIds,
  setColumnWidths,
  setCondition,
  setRepeat,
  setRowColumns,
  setRowLayout,
  settleDrafts,
  spacing,
  updateBlocks,
} from '../../src/core/index.js'
import { allBlocksIn, at, docOf, docOfColumns, firstColumnId, firstRowId } from '../support/kit.js'

afterEach(() => resetIds())

/**
 * A document with two sections, the first holding two blocks in one column and
 * the second a two-column row. Enough shape for every traversal below.
 *
 * @returns {import('../../src/core/types.js').EmailDocument}
 */
function twoSectionDoc() {
  return createDocument({
    sections: [
      createSection({
        rows: [
          createRow({
            children: [
              createColumn({
                width: 100,
                blocks: [createBlock('heading', { text: 'One' }), createBlock('text')],
              }),
            ],
          }),
        ],
      }),
      createSection({
        rows: [
          createRow({
            children: [
              createColumn({ width: 50, blocks: [createBlock('image')] }),
              createColumn({ width: 50 }),
            ],
          }),
        ],
      }),
    ],
  })
}

describe('findNode()', () => {
  it('resolves each kind with its parent, index and ancestor path', () => {
    const doc = twoSectionDoc()
    const section = doc.sections[1]
    const row = section.rows[0]
    const column = row.columns[1]
    const target = doc.sections[0].rows[0].columns[0].blocks[1]

    expect(at(doc, section.id)).toMatchObject({ kind: 'section', index: 1, parent: doc })
    expect(at(doc, row.id)).toMatchObject({ kind: 'row', index: 0, parent: section })
    expect(at(doc, column.id)).toMatchObject({ kind: 'column', index: 1, parent: row })

    const found = at(doc, target.id)
    expect(found.kind).toBe('block')
    expect(found.index).toBe(1)
    expect(found.path).toEqual([
      doc.sections[0].id,
      doc.sections[0].rows[0].id,
      doc.sections[0].rows[0].columns[0].id,
      target.id,
    ])
  })

  it('returns null for an unknown id, and for no id at all', () => {
    const doc = twoSectionDoc()
    expect(findNode(doc, 'nope')).toBeNull()
    expect(findNode(doc, '')).toBeNull()
    expect(nodeKind(doc, 'nope')).toBeNull()
    expect(nodeKind(doc, doc.sections[0].id)).toBe('section')
  })
})

describe('listBlocks() / listColumns()', () => {
  it('walks in document order across sections', () => {
    const doc = twoSectionDoc()
    expect(listBlocks(doc).map((b) => b.type)).toEqual(['heading', 'text', 'image'])
    expect(listColumns(doc)).toHaveLength(3)
  })
})

describe('insertBlock()', () => {
  it('appends by default and builds the block from the registry', () => {
    const doc = docOf()
    const next = insertBlock(doc, { columnId: firstColumnId(doc), type: 'button' })
    const [added] = allBlocksIn(next)
    expect(added.type).toBe('button')
    expect(added.props.text).toBe('Get started')
  })

  it('honours an index, and clamps one past the end', () => {
    const doc = docOf([createBlock('text', { text: 'a' }), createBlock('text', { text: 'b' })])
    const columnId = firstColumnId(doc)

    const front = insertBlock(doc, { columnId, index: 0, type: 'divider' })
    expect(allBlocksIn(front).map((b) => b.type)).toEqual(['divider', 'text', 'text'])

    const back = insertBlock(doc, { columnId, index: 99, type: 'divider' })
    expect(allBlocksIn(back).map((b) => b.type)).toEqual(['text', 'text', 'divider'])
  })

  it('takes a ready-made block, which is how a palette preset drops', () => {
    const doc = docOf()
    const ready = createBlock('spacer', { height: 40 })
    const next = insertBlock(doc, { columnId: firstColumnId(doc), block: ready })
    expect(allBlocksIn(next)[0]).toBe(ready)
  })

  it('refuses a target that is not a column', () => {
    const doc = docOf()
    expect(insertBlock(doc, { columnId: firstRowId(doc), type: 'text' })).toBe(doc)
    expect(insertBlock(doc, { columnId: 'ghost', type: 'text' })).toBe(doc)
  })

  it('leaves untouched sections referentially identical', () => {
    const doc = twoSectionDoc()
    const next = insertBlock(doc, {
      columnId: doc.sections[0].rows[0].columns[0].id,
      type: 'text',
    })
    expect(next).not.toBe(doc)
    expect(next.sections[1]).toBe(doc.sections[1])
  })
})

describe('moveBlock()', () => {
  it('accounts for the removal when moving down inside one column', () => {
    const doc = docOf(['a', 'b', 'c'].map((text) => createBlock('text', { text })))
    const columnId = firstColumnId(doc)
    const [first] = allBlocksIn(doc)

    const moved = moveBlock(doc, { blockId: first.id, toColumnId: columnId, toIndex: 2 })
    expect(allBlocksIn(moved).map((b) => b.props.text)).toEqual(['b', 'a', 'c'])
  })

  it('moves up without the adjustment', () => {
    const doc = docOf(['a', 'b', 'c'].map((text) => createBlock('text', { text })))
    const columnId = firstColumnId(doc)
    const last = allBlocksIn(doc)[2]

    const moved = moveBlock(doc, { blockId: last.id, toColumnId: columnId, toIndex: 0 })
    expect(allBlocksIn(moved).map((b) => b.props.text)).toEqual(['c', 'a', 'b'])
  })

  it('is a no-op when the block would land where it already is', () => {
    const doc = docOf(['a', 'b'].map((text) => createBlock('text', { text })))
    const columnId = firstColumnId(doc)
    const [first] = allBlocksIn(doc)
    expect(moveBlock(doc, { blockId: first.id, toColumnId: columnId, toIndex: 0 })).toBe(doc)
    expect(moveBlock(doc, { blockId: first.id, toColumnId: columnId, toIndex: 1 })).toBe(doc)
  })

  it('carries a block across columns and across sections', () => {
    const doc = twoSectionDoc()
    const block = doc.sections[0].rows[0].columns[0].blocks[0]
    const target = doc.sections[1].rows[0].columns[1]

    const moved = moveBlock(doc, { blockId: block.id, toColumnId: target.id, toIndex: 0 })

    expect(moved.sections[0].rows[0].columns[0].blocks.map((b) => b.type)).toEqual(['text'])
    expect(moved.sections[1].rows[0].columns[1].blocks[0].id).toBe(block.id)
  })

  it('refuses an unknown block or a target that is not a column', () => {
    const doc = twoSectionDoc()
    const block = doc.sections[0].rows[0].columns[0].blocks[0]
    expect(moveBlock(doc, { blockId: 'ghost', toColumnId: firstColumnId(doc) })).toBe(doc)
    expect(moveBlock(doc, { blockId: block.id, toColumnId: doc.sections[0].id })).toBe(doc)
  })
})

describe('removeBlock() / removeNode()', () => {
  it('removes a block and nothing else', () => {
    const doc = docOf([createBlock('text'), createBlock('divider')])
    const [first] = allBlocksIn(doc)
    expect(allBlocksIn(removeBlock(doc, first.id)).map((b) => b.type)).toEqual(['divider'])
    expect(removeBlock(doc, 'ghost')).toBe(doc)
  })

  it('removes a column and rebalances the survivors', () => {
    const doc = docOfColumns([[], [], []])
    const row = doc.sections[0].rows[0]
    const next = removeNode(doc, row.columns[2].id)
    expect(next.sections[0].rows[0].columns.map((c) => c.props.width)).toEqual([50, 50])
  })

  it('takes the row with it when the last column goes, and the section with the last row', () => {
    const doc = docOf([createBlock('text')])
    const columnId = firstColumnId(doc)
    // One column, one row, one section: the whole branch should disappear.
    expect(removeNode(doc, columnId).sections).toHaveLength(0)
  })

  it('keeps the section when it still has another row', () => {
    const doc = createDocument({
      sections: [createSection({ rows: [createRow(), createRow()] })],
    })
    const next = removeNode(doc, doc.sections[0].rows[0].id)
    expect(next.sections).toHaveLength(1)
    expect(next.sections[0].rows).toHaveLength(1)
  })

  it('removes a section outright', () => {
    const doc = twoSectionDoc()
    expect(removeNode(doc, doc.sections[0].id).sections).toHaveLength(1)
    expect(removeNode(doc, 'ghost')).toBe(doc)
  })
})

describe('duplicateNode()', () => {
  it('puts the copy directly after the original with fresh ids', () => {
    const doc = docOf([createBlock('text', { text: 'first' }), createBlock('divider')])
    const [original] = allBlocksIn(doc)
    const next = duplicateNode(doc, original.id)

    const blocks = allBlocksIn(next)
    expect(blocks.map((b) => b.type)).toEqual(['text', 'text', 'divider'])
    expect(blocks[1].id).not.toBe(blocks[0].id)
    expect(blocks[1].props.text).toBe('first')
  })

  it('rebalances a row after duplicating one of its columns', () => {
    const doc = docOfColumns([[createBlock('text')], []])
    const row = doc.sections[0].rows[0]
    const next = duplicateNode(doc, row.columns[0].id)
    expect(next.sections[0].rows[0].columns.map((c) => c.props.width)).toEqual([34, 33, 33])
  })

  it('duplicates rows and sections in place', () => {
    const doc = twoSectionDoc()
    expect(duplicateNode(doc, doc.sections[0].id).sections).toHaveLength(3)
    expect(duplicateNode(doc, doc.sections[0].rows[0].id).sections[0].rows).toHaveLength(2)
    expect(duplicateNode(doc, 'ghost')).toBe(doc)
  })
})

describe('patchProps()', () => {
  it('merges shallow keys and dotted paths alike', () => {
    const doc = docOf([createBlock('text')])
    const [block] = allBlocksIn(doc)
    const next = patchProps(doc, block.id, { fontSize: 20, 'padding.top': 40 })
    const patched = allBlocksIn(next)[0]

    expect(patched.props.fontSize).toBe(20)
    expect(patched.props.padding.top).toBe(40)
    // The other sides of the shorthand survive.
    expect(patched.props.padding.right).toBe(block.props.padding.right)
  })

  it('returns the same document when the patch changes nothing', () => {
    const doc = docOf([createBlock('text', { fontSize: 16 })])
    const [block] = allBlocksIn(doc)
    expect(patchProps(doc, block.id, { fontSize: 16 })).toBe(doc)
    expect(patchProps(doc, block.id, {})).toBe(doc)
    expect(patchProps(doc, 'ghost', { fontSize: 1 })).toBe(doc)
  })

  it('works on structural nodes too', () => {
    const doc = docOf()
    const rowId = firstRowId(doc)
    const next = patchProps(doc, rowId, { gap: 16, backgroundColor: '#eee' })
    expect(next.sections[0].rows[0].props.gap).toBe(16)
    expect(next.sections[0].rows[0].props.backgroundColor).toBe('#eee')
  })
})

describe('patchSettings()', () => {
  it('patches settings and short-circuits a no-op', () => {
    const doc = createDocument()
    const next = patchSettings(doc, { subject: 'Ship it' })
    expect(next.settings.subject).toBe('Ship it')
    expect(next.sections).toBe(doc.sections)
    expect(patchSettings(next, { subject: 'Ship it' })).toBe(next)
  })
})

describe('setCondition() / setRepeat()', () => {
  it('stores an incomplete condition so the Inspector can hold a draft', () => {
    const doc = docOf([createBlock('text')])
    const [block] = allBlocksIn(doc)
    const next = setCondition(doc, block.id, /** @type {any} */ ({ path: '', op: 'truthy' }))
    expect(allBlocksIn(next)[0].showIf).toEqual({ path: '', op: 'truthy' })
  })

  it('coerces the compared value once, at the write', () => {
    const doc = docOf([createBlock('text')])
    const [block] = allBlocksIn(doc)
    const next = setCondition(
      doc,
      block.id,
      /** @type {any} */ ({ path: 'order.total', op: 'gt', value: '100' }),
    )
    expect(allBlocksIn(next)[0].showIf).toEqual({ path: 'order.total', op: 'gt', value: 100 })
  })

  it('clears with null and no-ops when there was nothing to clear', () => {
    const doc = docOf([createBlock('text')])
    const [block] = allBlocksIn(doc)
    const withCondition = setCondition(doc, block.id, { path: 'user.pro', op: 'truthy' })
    expect(
      setCondition(withCondition, block.id, null).sections[0].rows[0].columns[0].blocks[0],
    ).not.toHaveProperty('showIf')
    expect(setCondition(doc, block.id, null)).toBe(doc)
    expect(setCondition(withCondition, block.id, { path: 'user.pro', op: 'truthy' })).toBe(
      withCondition,
    )
  })

  it('puts a repeat on a row and refuses every other kind', () => {
    const doc = docOf([createBlock('text')])
    const rowId = firstRowId(doc)
    const [block] = allBlocksIn(doc)

    const next = setRepeat(doc, rowId, { path: 'order.items', as: 'item' })
    expect(next.sections[0].rows[0].repeat).toEqual({
      path: 'order.items',
      as: 'item',
      previewCount: 3,
    })

    expect(setRepeat(doc, block.id, { path: 'order.items', as: 'item' })).toBe(doc)
    expect(setRepeat(next, rowId, null).sections[0].rows[0]).not.toHaveProperty('repeat')
  })
})

describe('structure ops', () => {
  it('inserts a section at an index, with the column layout it was asked for', () => {
    const doc = createDocument()
    const next = insertSection(doc, { index: 0, widths: [70, 30] })
    expect(next.sections).toHaveLength(2)
    expect(next.sections[0].rows[0].columns.map((c) => c.props.width)).toEqual([70, 30])
  })

  it('inserts a row into a named section only', () => {
    const doc = twoSectionDoc()
    const next = insertRow(doc, { sectionId: doc.sections[1].id, columns: 3 })
    expect(next.sections[1].rows).toHaveLength(2)
    expect(next.sections[1].rows[1].columns).toHaveLength(3)
    expect(insertRow(doc, { sectionId: 'ghost' })).toBe(doc)
  })

  it('moves a section, interpreting the index in the list without it', () => {
    const doc = createDocument({
      sections: [createSection(), createSection(), createSection()],
    })
    const first = doc.sections[0].id
    const moved = moveSection(doc, first, 3)
    expect(moved.sections[2].id).toBe(first)
    expect(moveSection(doc, first, 0)).toBe(doc)
    expect(moveSection(doc, 'ghost', 1)).toBe(doc)
  })

  it('moves a row within its section and into another one', () => {
    const doc = twoSectionDoc()
    const rowId = doc.sections[0].rows[0].id

    const across = moveRow(doc, { rowId, toSectionId: doc.sections[1].id, toIndex: 0 })
    expect(across.sections[0].rows).toHaveLength(0)
    expect(across.sections[1].rows[0].id).toBe(rowId)
    // The emptied section is left for normalize to prune, in one step.
    expect(normalize(across).sections).toHaveLength(1)

    expect(moveRow(doc, { rowId: 'ghost', toIndex: 0 })).toBe(doc)
  })
})

describe('setRowColumns()', () => {
  it('grows a row with fresh, evenly sized columns', () => {
    const doc = docOf()
    const next = setRowColumns(doc, firstRowId(doc), 3)
    expect(next.sections[0].rows[0].columns.map((c) => c.props.width)).toEqual([34, 33, 33])
  })

  it('never deletes content: dropped columns hand their blocks to the last survivor', () => {
    const doc = docOfColumns([
      [createBlock('text', { text: 'keep' })],
      [createBlock('text', { text: 'orphan-a' })],
      [createBlock('text', { text: 'orphan-b' })],
    ])
    const next = setRowColumns(doc, firstRowId(doc), 1)
    const columns = next.sections[0].rows[0].columns
    expect(columns).toHaveLength(1)
    expect(columns[0].blocks.map((b) => b.props.text)).toEqual(['keep', 'orphan-a', 'orphan-b'])
  })

  it('clamps to between one and six and no-ops on the current count', () => {
    const doc = docOf()
    const rowId = firstRowId(doc)
    expect(setRowColumns(doc, rowId, 0).sections[0].rows[0].columns).toHaveLength(1)
    expect(setRowColumns(doc, rowId, 12).sections[0].rows[0].columns).toHaveLength(6)
    expect(setRowColumns(doc, rowId, 1)).toBe(doc)
  })
})

describe('setColumnWidths() / setRowLayout()', () => {
  it('writes the widths it is given, and skips positions it has none for', () => {
    const doc = docOfColumns([[], []])
    const next = setColumnWidths(doc, firstRowId(doc), [70])
    expect(next.sections[0].rows[0].columns.map((c) => c.props.width)).toEqual([70, 50])
  })

  it('applies a whole layout — count and widths — as one operation', () => {
    const doc = docOf([createBlock('text')])
    const next = setRowLayout(doc, firstRowId(doc), [25, 75])
    const columns = next.sections[0].rows[0].columns
    expect(columns).toHaveLength(2)
    expect(columns.map((c) => c.props.width)).toEqual([25, 75])
    // The block stays in the first column rather than being rehomed.
    expect(columns[0].blocks).toHaveLength(1)
  })

  it('ignores a layout with no widths at all', () => {
    const doc = docOf()
    expect(setRowLayout(doc, firstRowId(doc), [])).toBe(doc)
    expect(setRowLayout(doc, firstRowId(doc), /** @type {any} */ (null))).toBe(doc)
  })
})

describe('updateBlocks()', () => {
  it('is the seam the drag handlers use, and keeps identity on a no-op', () => {
    const doc = docOf([createBlock('text')])
    const columnId = firstColumnId(doc)
    expect(updateBlocks(doc, columnId, (blocks) => blocks)).toBe(doc)
    expect(updateBlocks(doc, columnId, (blocks) => blocks.slice(0, 0))).not.toBe(doc)
  })
})

describe('normalize()', () => {
  it('is idempotent', () => {
    const once = normalize(createDocument())
    expect(normalize(once)).toBe(once)
  })

  it('fills in missing settings and stamps the version', () => {
    const raw = /** @type {any} */ ({ sections: [] })
    const next = normalize(raw)
    expect(next.version).toBe(1)
    expect(next.settings.width).toBe(600)
  })

  it('drops rows with no columns and sections with no rows', () => {
    const doc = /** @type {any} */ (createDocument())
    doc.sections.push({ id: 'sec_empty', type: 'section', props: {}, rows: [] })
    doc.sections[0].rows.push({ id: 'row_empty', type: 'row', props: {}, columns: [] })

    const next = normalize(doc)
    expect(next.sections.map((s) => s.id)).not.toContain('sec_empty')
    expect(next.sections[0].rows.map((r) => r.id)).not.toContain('row_empty')
  })

  it('re-ids duplicates, which is what a merge of two documents produces', () => {
    const doc = docOf([createBlock('text'), createBlock('text')])
    doc.sections[0].rows[0].columns[0].blocks[1].id =
      doc.sections[0].rows[0].columns[0].blocks[0].id

    const blocks = allBlocksIn(normalize(doc))
    expect(blocks[0].id).not.toBe(blocks[1].id)
  })

  it('clamps column widths back to 100, keeping the proportions', () => {
    const doc = docOfColumns([[], []])
    doc.sections[0].rows[0].columns[0].props.width = 30
    doc.sections[0].rows[0].columns[1].props.width = 10
    expect(normalize(doc).sections[0].rows[0].columns.map((c) => c.props.width)).toEqual([75, 25])
  })

  it('falls back to even widths when nothing declares one', () => {
    const doc = docOfColumns([[], [], []])
    for (const column of doc.sections[0].rows[0].columns) column.props.width = 0
    expect(normalize(doc).sections[0].rows[0].columns.map((c) => c.props.width)).toEqual([
      34, 33, 33,
    ])
  })

  it('coerces padding written as a bare number or as nonsense', () => {
    const doc = /** @type {any} */ (docOf([createBlock('text')]))
    doc.sections[0].props.padding = 12
    doc.sections[0].rows[0].props.padding = 'nope'
    const next = normalize(doc)
    expect(next.sections[0].props.padding).toEqual(spacing(12))
    expect(next.sections[0].rows[0].props.padding).toEqual(spacing(0))
  })

  it('drops blocks with no type and gives a propless block an object', () => {
    const doc = /** @type {any} */ (docOf([createBlock('text')]))
    doc.sections[0].rows[0].columns[0].blocks.push({ id: 'blk_bad' })
    doc.sections[0].rows[0].columns[0].blocks.push({ id: 'blk_np', type: 'text' })

    const blocks = allBlocksIn(normalize(doc))
    expect(blocks.map((b) => b.id)).not.toContain('blk_bad')
    expect(blocks.find((b) => b.id === 'blk_np')?.props).toEqual({})
  })

  it('keeps an unfinished condition so a half-typed draft survives a round trip', () => {
    const doc = /** @type {any} */ (docOf([createBlock('text')]))
    doc.sections[0].rows[0].columns[0].blocks[0].showIf = { path: '', op: 'truthy' }
    expect(allBlocksIn(normalize(doc))[0].showIf).toEqual({ path: '', op: 'truthy' })
  })

  it('discards a condition that is not even an object', () => {
    const doc = /** @type {any} */ (docOf([createBlock('text')]))
    doc.sections[0].rows[0].columns[0].blocks[0].showIf = 'yes'
    expect(allBlocksIn(normalize(doc))[0]).not.toHaveProperty('showIf')
  })

  it('hands back non-documents untouched', () => {
    expect(normalize(/** @type {any} */ (null))).toBeNull()
  })
})

describe('settleDrafts()', () => {
  it('strips the unfinished conditions and repeats that normalize kept', () => {
    const doc = /** @type {any} */ (docOf([createBlock('text'), createBlock('divider')]))
    const column = doc.sections[0].rows[0].columns[0]
    column.blocks[0].showIf = { path: '', op: 'truthy' }
    column.blocks[1].showIf = { path: 'user.pro', op: 'truthy' }
    doc.sections[0].rows[0].repeat = { path: 'order.items', as: '2bad', previewCount: 3 }

    const clean = settleDrafts(doc)
    expect(clean.sections[0].rows[0].columns[0].blocks[0]).not.toHaveProperty('showIf')
    expect(clean.sections[0].rows[0].columns[0].blocks[1].showIf).toEqual({
      path: 'user.pro',
      op: 'truthy',
    })
    expect(clean.sections[0].rows[0]).not.toHaveProperty('repeat')
  })

  it('returns the same document when there is nothing to strip', () => {
    const doc = docOf([createBlock('text')])
    expect(settleDrafts(doc)).toBe(doc)
  })
})
