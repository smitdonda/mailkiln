import { describe, expect, it } from 'vitest'
import {
  assertDocument,
  cloneWithNewIds,
  createBlock,
  createDocument,
  createId,
  createRow,
  evenWidths,
  reserveIds,
  resetIds,
  spacing,
  validateDocument,
} from '../src/core/index.js'
import { twoColumnDocument } from './helpers.js'

describe('ids', () => {
  it('are sequential so snapshots and exports stay diffable', () => {
    resetIds()
    expect(createId('blk')).toBe('blk_1')
    expect(createId('blk')).toBe('blk_2')
  })

  it('reserveIds bumps past ids already in a loaded document, preventing collisions', () => {
    // The scenario this guards: a document is saved in one session and edited in
    // the next, where the counter has restarted at 1.
    resetIds()
    const doc = {
      version: 1,
      settings: {},
      sections: [
        {
          id: 'sec_1',
          type: 'section',
          props: {},
          rows: [
            {
              id: 'row_1',
              type: 'row',
              props: {},
              columns: [
                { id: 'col_1', type: 'column', props: { width: 100 }, blocks: [{ id: 'blk_z', type: 'text', props: {} }] },
              ],
            },
          ],
        },
      ],
    }
    reserveIds(/** @type {any} */ (doc))
    // 'z' is 35 in base 36, so the next id must be past it.
    expect(createId('blk')).toBe('blk_10')
  })
})

describe('spacing and evenWidths', () => {
  it('expands CSS-shorthand-style arguments', () => {
    expect(spacing(10)).toEqual({ top: 10, right: 10, bottom: 10, left: 10 })
    expect(spacing(10, 20)).toEqual({ top: 10, right: 20, bottom: 10, left: 20 })
    expect(spacing(1, 2, 3)).toEqual({ top: 1, right: 2, bottom: 3, left: 2 })
    expect(spacing(1, 2, 3, 4)).toEqual({ top: 1, right: 2, bottom: 3, left: 4 })
  })

  it('always sums to 100 and clamps the count to 1–6', () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const widths = evenWidths(n)
      expect(widths).toHaveLength(n)
      expect(widths.reduce((a, b) => a + b, 0)).toBe(100)
    }
    expect(evenWidths(0)).toEqual([100])
    expect(evenWidths(99)).toHaveLength(6)
  })
})

describe('cloneWithNewIds', () => {
  it('deep-clones and re-ids every descendant', () => {
    const row = createRow({ columns: 2 })
    row.columns[0].blocks.push(createBlock('text', { text: 'x' }))
    const copy = cloneWithNewIds(row)

    expect(copy).not.toBe(row)
    expect(copy.id).not.toBe(row.id)
    expect(copy.columns[0].id).not.toBe(row.columns[0].id)
    expect(copy.columns[0].blocks[0].id).not.toBe(row.columns[0].blocks[0].id)
    expect(copy.columns[0].blocks[0].props.text).toBe('x')
    // Deep clone, not a shared reference.
    copy.columns[0].blocks[0].props.text = 'changed'
    expect(row.columns[0].blocks[0].props.text).toBe('x')
  })
})

describe('validateDocument', () => {
  it('passes a well-formed document', () => {
    expect(validateDocument(twoColumnDocument())).toEqual([])
  })

  it('rejects non-objects', () => {
    expect(validateDocument(null)).toEqual(['document is not an object.'])
    expect(validateDocument('nope')).toEqual(['document is not an object.'])
  })

  it('reports each structural problem with a path', () => {
    const problems = validateDocument({
      version: 1,
      settings: { width: 0 },
      sections: [{ id: 's', type: 'wrong', props: {}, rows: 'nope' }],
    })
    expect(problems).toContain('document.settings.width must be a positive number.')
    expect(problems).toContain('sections[0].type must be "section".')
    expect(problems).toContain('sections[0].rows must be an array.')
    expect(problems).toContain('sections[0].props.padding must be a Spacing.')
  })

  it('reports duplicate ids', () => {
    const doc = twoColumnDocument()
    doc.sections[0].rows[0].columns[1].id = doc.sections[0].rows[0].columns[0].id
    expect(validateDocument(doc).join(' ')).toMatch(/reuses id/)
  })

  it('reports column widths that do not sum to 100', () => {
    const doc = twoColumnDocument()
    doc.sections[0].rows[0].columns[0].props.width = 10
    expect(validateDocument(doc).join(' ')).toMatch(/widths sum to 60, expected 100/)
  })

  it('flags a future schema version as "upgrade mailforge"', () => {
    expect(validateDocument({ version: 99, settings: { width: 600 }, sections: [] }).join(' ')).toMatch(
      /Upgrade mailforge/,
    )
  })

  it('only flags unregistered block types when asked', () => {
    const doc = createDocument()
    doc.sections[0].rows[0].columns[0].blocks.push({ id: 'x', type: 'nope', props: {} })
    expect(validateDocument(doc)).toEqual([])
    expect(validateDocument(doc, { knownBlocksOnly: true }).join(' ')).toMatch(
      /unregistered type "nope"/,
    )
  })
})

describe('assertDocument', () => {
  it('returns the document when it is valid', () => {
    const doc = twoColumnDocument()
    expect(assertDocument(doc)).toBe(doc)
  })

  it('throws one error listing the problems', () => {
    expect(() => assertDocument({ version: 1, settings: {}, sections: 'nope' })).toThrow(
      /mailforge: invalid document/,
    )
  })

  it('truncates a long problem list rather than printing a wall of text', () => {
    const sections = Array.from({ length: 20 }, (_, i) => ({
      id: `s${i}`,
      type: 'nope',
      props: {},
      rows: [],
    }))
    expect(() => assertDocument({ version: 1, settings: { width: 600 }, sections })).toThrow(
      /… and \d+ more/,
    )
  })
})
