import { describe, expect, it } from 'vitest'
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
  moveBlock,
  moveRow,
  moveSection,
  normalize,
  patchProps,
  patchSettings,
  removeNode,
  setColumnWidths,
  setRowColumns,
  spacing,
} from '../src/core/index.js'
import { allBlocksIn, twoColumnDocument } from './helpers.js'

describe('findNode', () => {
  it('resolves every node kind with its parent, index and path', () => {
    const doc = twoColumnDocument()
    const section = doc.sections[0]
    const row = section.rows[0]
    const column = row.columns[1]
    const block = column.blocks[0]

    expect(findNode(doc, section.id)).toMatchObject({ kind: 'section', index: 0, parent: doc })
    expect(findNode(doc, row.id)).toMatchObject({ kind: 'row', index: 0, parent: section })
    expect(findNode(doc, column.id)).toMatchObject({ kind: 'column', index: 1, parent: row })
    expect(findNode(doc, block.id)).toMatchObject({ kind: 'block', index: 0, parent: column })
    expect(findNode(doc, block.id)?.path).toEqual([section.id, row.id, column.id, block.id])
  })

  it('returns null for an unknown id', () => {
    expect(findNode(twoColumnDocument(), 'nope')).toBeNull()
  })
})

describe('insertBlock', () => {
  it('appends by default and inserts at an index when given one', () => {
    const doc = twoColumnDocument()
    const columnId = doc.sections[0].rows[0].columns[0].id

    const appended = insertBlock(doc, { columnId, type: 'text', props: { text: 'second' } })
    expect(texts(appended, 0)).toEqual(['A', 'second'])

    const prepended = insertBlock(appended, {
      columnId,
      index: 0,
      type: 'text',
      props: { text: 'first' },
    })
    expect(texts(prepended, 0)).toEqual(['first', 'A', 'second'])
  })

  it('clamps an out-of-range index to the end rather than throwing', () => {
    const doc = twoColumnDocument()
    const columnId = doc.sections[0].rows[0].columns[0].id
    const next = insertBlock(doc, { columnId, index: 99, type: 'text', props: { text: 'z' } })
    expect(texts(next, 0)).toEqual(['A', 'z'])
  })

  it('is a no-op for an unknown column', () => {
    const doc = twoColumnDocument()
    expect(insertBlock(doc, { columnId: 'nope', type: 'text' })).toBe(doc)
  })

  it('uses registry defaults for props it is not given', () => {
    const doc = twoColumnDocument()
    const columnId = doc.sections[0].rows[0].columns[0].id
    const next = insertBlock(doc, { columnId, type: 'button' })
    const button = next.sections[0].rows[0].columns[0].blocks[1]
    expect(button.props.buttonColor).toBe('#4f46e5')
    expect(button.props.padding).toEqual(spacing(16, 24))
  })
})

describe('moveBlock', () => {
  it('moves a block across columns', () => {
    const doc = twoColumnDocument()
    const [left, right] = doc.sections[0].rows[0].columns
    const next = moveBlock(doc, { blockId: left.blocks[0].id, toColumnId: right.id, toIndex: 0 })
    expect(texts(next, 0)).toEqual([])
    expect(texts(next, 1)).toEqual(['A', 'B'])
  })

  it('moves a block across sections', () => {
    let doc = normalize(
      createDocument({
        sections: [
          createSection({
            rows: [createRow({ children: [createColumn({ blocks: [createBlock('text', { text: 'A' })] })] })],
          }),
          createSection({ rows: [createRow({ children: [createColumn({})] })] }),
        ],
      }),
    )
    const source = doc.sections[0].rows[0].columns[0]
    const destination = doc.sections[1].rows[0].columns[0]
    doc = moveBlock(doc, { blockId: source.blocks[0].id, toColumnId: destination.id })
    expect(doc.sections[0].rows[0].columns[0].blocks).toHaveLength(0)
    expect(doc.sections[1].rows[0].columns[0].blocks[0].props.text).toBe('A')
  })

  it('accounts for the removal when reordering inside one column', () => {
    const doc = normalize(
      createDocument({
        sections: [
          createSection({
            rows: [
              createRow({
                children: [
                  createColumn({
                    blocks: ['a', 'b', 'c'].map((text) => createBlock('text', { text })),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    )
    const column = doc.sections[0].rows[0].columns[0]
    // Asking for index 3 (the end) must land at the end, not at index 2.
    const moved = moveBlock(doc, {
      blockId: column.blocks[0].id,
      toColumnId: column.id,
      toIndex: 3,
    })
    expect(texts(moved, 0)).toEqual(['b', 'c', 'a'])
  })

  it('is a no-op when the target index is where the block already is', () => {
    const doc = twoColumnDocument()
    const column = doc.sections[0].rows[0].columns[0]
    expect(moveBlock(doc, { blockId: column.blocks[0].id, toColumnId: column.id, toIndex: 0 })).toBe(
      doc,
    )
  })

  it('preserves object identity for untouched branches', () => {
    let doc = insertSection(twoColumnDocument(), {})
    doc = normalize(doc)
    const untouched = doc.sections[1]
    const column = doc.sections[0].rows[0].columns[0]
    const next = moveBlock(doc, {
      blockId: column.blocks[0].id,
      toColumnId: doc.sections[0].rows[0].columns[1].id,
      toIndex: 0,
    })
    expect(next.sections[1]).toBe(untouched)
  })
})

describe('removeNode', () => {
  it('removes a block', () => {
    const doc = twoColumnDocument()
    const block = doc.sections[0].rows[0].columns[0].blocks[0]
    expect(listBlocks(removeNode(doc, block.id))).toHaveLength(1)
  })

  it('rebalances the remaining columns when one is removed', () => {
    const doc = twoColumnDocument()
    const next = removeNode(doc, doc.sections[0].rows[0].columns[0].id)
    expect(next.sections[0].rows[0].columns).toHaveLength(1)
    expect(next.sections[0].rows[0].columns[0].props.width).toBe(100)
  })

  it('removes the row when its last column goes, and the section with its last row', () => {
    const doc = normalize(
      createDocument({
        sections: [createSection({ rows: [createRow({ children: [createColumn({})] })] })],
      }),
    )
    const columnId = doc.sections[0].rows[0].columns[0].id
    expect(removeNode(doc, columnId).sections).toHaveLength(0)
  })
})

describe('duplicateNode', () => {
  it('inserts the copy after the original with fresh ids', () => {
    const doc = twoColumnDocument()
    const block = doc.sections[0].rows[0].columns[0].blocks[0]
    const next = duplicateNode(doc, block.id)
    const blocks = next.sections[0].rows[0].columns[0].blocks
    expect(blocks).toHaveLength(2)
    expect(blocks[1].props.text).toBe('A')
    expect(blocks[1].id).not.toBe(blocks[0].id)
  })

  it('re-ids nested children when duplicating a section', () => {
    const doc = twoColumnDocument()
    const next = duplicateNode(doc, doc.sections[0].id)
    const ids = allBlocksIn(next).map((block) => block.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('patchProps', () => {
  it('patches a shallow key', () => {
    const doc = twoColumnDocument()
    const block = doc.sections[0].rows[0].columns[0].blocks[0]
    const next = patchProps(doc, block.id, { text: 'changed' })
    expect(next.sections[0].rows[0].columns[0].blocks[0].props.text).toBe('changed')
  })

  it('patches a dotted path without dropping its siblings', () => {
    const doc = twoColumnDocument()
    const block = doc.sections[0].rows[0].columns[0].blocks[0]
    const next = patchProps(doc, block.id, { 'padding.top': 40 })
    expect(next.sections[0].rows[0].columns[0].blocks[0].props.padding).toEqual({
      top: 40,
      right: 24,
      bottom: 8,
      left: 24,
    })
  })

  it('returns the same document when the patch changes nothing', () => {
    const doc = twoColumnDocument()
    const block = doc.sections[0].rows[0].columns[0].blocks[0]
    expect(patchProps(doc, block.id, { text: 'A' })).toBe(doc)
  })

  it('patches settings', () => {
    const doc = twoColumnDocument()
    expect(patchSettings(doc, { subject: 'Hi' }).settings.subject).toBe('Hi')
    expect(patchSettings(doc, { subject: '' })).toBe(doc)
  })
})

describe('structure ops', () => {
  it('adds sections and rows', () => {
    let doc = twoColumnDocument()
    doc = insertSection(doc, {})
    expect(doc.sections).toHaveLength(2)
    doc = insertRow(doc, { sectionId: doc.sections[0].id, columns: 3 })
    expect(doc.sections[0].rows).toHaveLength(2)
    expect(doc.sections[0].rows[1].columns).toHaveLength(3)
  })

  it('moves sections', () => {
    let doc = twoColumnDocument()
    doc = normalize(insertSection(doc, { columns: 1 }))
    const [first, second] = doc.sections
    const moved = moveSection(doc, second.id, 0)
    expect(moved.sections[0].id).toBe(second.id)
    expect(moved.sections[1].id).toBe(first.id)
  })

  it('moves a row into another section', () => {
    let doc = twoColumnDocument()
    doc = normalize(insertSection(doc, { columns: 1 }))
    const row = doc.sections[0].rows[0]
    const moved = normalize(moveRow(doc, { rowId: row.id, toSectionId: doc.sections[1].id }))
    // The source section had only that row, so normalize prunes the empty section.
    expect(moved.sections).toHaveLength(1)
    expect(moved.sections[0].rows.some((r) => r.id === row.id)).toBe(true)
  })

  it('keeps orphaned blocks when a row loses columns', () => {
    const doc = twoColumnDocument()
    const next = setRowColumns(doc, doc.sections[0].rows[0].id, 1)
    expect(next.sections[0].rows[0].columns).toHaveLength(1)
    expect(texts(next, 0)).toEqual(['A', 'B'])
  })

  it('adds columns and rebalances', () => {
    const doc = twoColumnDocument()
    const next = setRowColumns(doc, doc.sections[0].rows[0].id, 3)
    expect(next.sections[0].rows[0].columns.map((/** @type {any} */ c) => c.props.width)).toEqual([34, 33, 33])
  })

  it('sets explicit column widths', () => {
    const doc = twoColumnDocument()
    const next = setColumnWidths(doc, doc.sections[0].rows[0].id, [70, 30])
    expect(next.sections[0].rows[0].columns.map((/** @type {any} */ c) => c.props.width)).toEqual([70, 30])
  })
})

/**
 * These tests feed  deliberately malformed input — that is the
 * function's job. The cast keeps checkJs from rejecting the very shapes we need
 * to prove it survives.
 *
 * @param {any} doc
 * @returns {any}
 */
const normalizeMalformed = (doc) => normalize(doc)

describe('normalize', () => {
  it('returns the same reference when nothing needs fixing', () => {
    const doc = twoColumnDocument()
    expect(normalize(doc)).toBe(doc)
  })

  it('fills in missing settings and the version', () => {
    const next = normalizeMalformed({ sections: [] })
    expect(next.version).toBe(1)
    expect(next.settings.width).toBe(600)
  })

  it('prunes rows with no columns and sections with no rows', () => {
    const next = normalizeMalformed({
      version: 1,
      settings: {},
      sections: [
        { id: 's1', type: 'section', props: {}, rows: [{ id: 'r1', type: 'row', props: {}, columns: [] }] },
        {
          id: 's2',
          type: 'section',
          props: {},
          rows: [
            {
              id: 'r2',
              type: 'row',
              props: {},
              columns: [{ id: 'c2', type: 'column', props: { width: 100 }, blocks: [] }],
            },
          ],
        },
      ],
    })
    expect(next.sections).toHaveLength(1)
    expect(next.sections[0].id).toBe('s2')
  })

  it('scales column widths to sum to 100', () => {
    const next = normalizeMalformed({
      version: 1,
      settings: {},
      sections: [
        {
          id: 's',
          type: 'section',
          props: {},
          rows: [
            {
              id: 'r',
              type: 'row',
              props: {},
              columns: [
                { id: 'a', type: 'column', props: { width: 30 }, blocks: [] },
                { id: 'b', type: 'column', props: { width: 30 }, blocks: [] },
              ],
            },
          ],
        },
      ],
    })
    const widths = next.sections[0].rows[0].columns.map((/** @type {any} */ c) => c.props.width)
    expect(widths.reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0)).toBe(100)
  })

  it('assigns even widths when none are usable', () => {
    const next = normalizeMalformed({
      version: 1,
      settings: {},
      sections: [
        {
          id: 's',
          type: 'section',
          props: {},
          rows: [
            {
              id: 'r',
              type: 'row',
              props: {},
              columns: [
                { id: 'a', type: 'column', props: {}, blocks: [] },
                { id: 'b', type: 'column', props: {}, blocks: [] },
                { id: 'c', type: 'column', props: {}, blocks: [] },
              ],
            },
          ],
        },
      ],
    })
    expect(next.sections[0].rows[0].columns.map((/** @type {any} */ c) => c.props.width)).toEqual([34, 33, 33])
  })

  it('re-ids duplicates so two merged documents cannot collide', () => {
    const next = normalizeMalformed({
      version: 1,
      settings: {},
      sections: [
        {
          id: 'dup',
          type: 'section',
          props: {},
          rows: [
            {
              id: 'r',
              type: 'row',
              props: {},
              columns: [
                {
                  id: 'c',
                  type: 'column',
                  props: { width: 100 },
                  blocks: [
                    { id: 'same', type: 'text', props: { text: 'one' } },
                    { id: 'same', type: 'text', props: { text: 'two' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    const ids = allBlocksIn(next).map((block) => block.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('coerces numeric and missing padding into a full Spacing', () => {
    const next = normalizeMalformed({
      version: 1,
      settings: {},
      sections: [
        {
          id: 's',
          type: 'section',
          props: { padding: 12 },
          rows: [
            {
              id: 'r',
              type: 'row',
              props: {},
              columns: [{ id: 'c', type: 'column', props: { width: 100 }, blocks: [] }],
            },
          ],
        },
      ],
    })
    expect(next.sections[0].props.padding).toEqual({ top: 12, right: 12, bottom: 12, left: 12 })
    expect(next.sections[0].rows[0].props.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })
})

/**
 * @param {import('../src/core/types.js').EmailDocument} doc
 * @param {number} columnIndex
 * @returns {string[]}
 */
function texts(doc, columnIndex) {
  return doc.sections[0].rows[0].columns[columnIndex].blocks.map((block) => block.props.text)
}
