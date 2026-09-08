/**
 * Node factories, id minting and the runtime document check.
 *
 * `validateDocument` is the compile-time guarantee this package traded away by
 * being written in JavaScript, so it gets the most attention here: each branch
 * is asserted through the *message* a consumer would actually read.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  assertDocument,
  cloneWithNewIds,
  createBlock,
  createColumn,
  createDocument,
  createId,
  createRow,
  createSection,
  deepClone,
  evenWidths,
  reserveIds,
  resetIds,
  spacing,
  validateDocument,
} from '../../src/core/index.js'
import { docOf } from '../support/kit.js'

afterEach(() => {
  // Ids are a module-level counter; leaving it wherever a spec stopped makes the
  // next spec's assertions depend on execution order.
  resetIds()
})

describe('ids', () => {
  it('mints sequential base-36 ids behind the requested prefix', () => {
    resetIds()
    expect(createId('blk')).toBe('blk_1')
    expect(createId('blk')).toBe('blk_2')
    expect(createId()).toBe('n_3')
  })

  it('counts past every id already in a loaded document', () => {
    resetIds()
    const loaded = docOf([createBlock('text')])
    loaded.sections[0].rows[0].columns[0].blocks[0].id = 'blk_zz'

    reserveIds(loaded)

    expect(createId('blk')).not.toBe('blk_zz')
    expect(parseInt(createId('blk').split('_')[1], 36)).toBeGreaterThan(parseInt('zz', 36))
  })

  it('ignores ids with no base-36 tail rather than throwing', () => {
    resetIds(5)
    reserveIds(/** @type {any} */ ({ sections: [{ id: 'legacy-uuid', rows: [] }] }))
    expect(createId()).toBe('n_6')
  })
})

describe('spacing()', () => {
  it('follows the CSS shorthand it is modelled on', () => {
    expect(spacing(10)).toEqual({ top: 10, right: 10, bottom: 10, left: 10 })
    expect(spacing(10, 24)).toEqual({ top: 10, right: 24, bottom: 10, left: 24 })
    expect(spacing(12, 24, 4)).toEqual({ top: 12, right: 24, bottom: 4, left: 24 })
    expect(spacing(1, 2, 3, 4)).toEqual({ top: 1, right: 2, bottom: 3, left: 4 })
    expect(spacing()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })
})

describe('evenWidths()', () => {
  it('always sums to 100, with the remainder on the first column', () => {
    for (let n = 1; n <= 6; n += 1) {
      const widths = evenWidths(n)
      expect(widths).toHaveLength(n)
      expect(widths.reduce((a, b) => a + b, 0)).toBe(100)
    }
    expect(evenWidths(3)).toEqual([34, 33, 33])
  })

  it('clamps the count to between one and six columns', () => {
    expect(evenWidths(0)).toEqual([100])
    expect(evenWidths(-4)).toEqual([100])
    expect(evenWidths(99)).toHaveLength(6)
  })
})

describe('factories', () => {
  it('merges block props over the registered defaults', () => {
    const heading = createBlock('heading', { level: 4, text: 'Ship it' })
    expect(heading.type).toBe('heading')
    expect(heading.props.level).toBe(4)
    expect(heading.props.text).toBe('Ship it')
    // Untouched defaults survive.
    expect(heading.props.fontWeight).toBe('bold')
  })

  it('gives an unregistered type exactly the props it was handed', () => {
    const custom = createBlock('countdown', { until: '2026-01-01' })
    expect(custom.props).toEqual({ until: '2026-01-01' })
  })

  it('deep-clones defaults so two blocks never share a nested object', () => {
    const a = createBlock('text')
    const b = createBlock('text')
    a.props.padding.top = 999
    expect(b.props.padding.top).not.toBe(999)
  })

  it('builds a column that is full width, top aligned and empty', () => {
    const column = createColumn()
    expect(column.type).toBe('column')
    expect(column.props.width).toBe(100)
    expect(column.props.verticalAlign).toBe('top')
    expect(column.blocks).toEqual([])
  })

  it('builds a row from a count, from explicit widths, or from children', () => {
    expect(createRow({ columns: 3 }).columns.map((c) => c.props.width)).toEqual([34, 33, 33])
    expect(createRow({ widths: [70, 30] }).columns.map((c) => c.props.width)).toEqual([70, 30])
    // Explicit widths beat a count.
    expect(createRow({ columns: 4, widths: [60, 40] }).columns).toHaveLength(2)

    const child = createColumn({ width: 100 })
    expect(createRow({ children: [child] }).columns[0]).toBe(child)
  })

  it('gives a bare section one row so it is never unrenderable', () => {
    const section = createSection()
    expect(section.rows).toHaveLength(1)
    expect(section.rows[0].columns).toHaveLength(1)
  })

  it('stamps the schema version and fills in every default setting', () => {
    const doc = createDocument()
    expect(doc.version).toBe(SCHEMA_VERSION)
    expect(doc.settings).toEqual(DEFAULT_SETTINGS)
    expect(doc.sections).toHaveLength(1)
  })

  it('lets a caller override individual settings without losing the rest', () => {
    const doc = createDocument({ settings: { width: 640, subject: 'Hello' } })
    expect(doc.settings.width).toBe(640)
    expect(doc.settings.subject).toBe('Hello')
    expect(doc.settings.linkColor).toBe(DEFAULT_SETTINGS.linkColor)
  })
})

describe('cloneWithNewIds()', () => {
  it('re-ids the whole subtree and leaves the original alone', () => {
    const section = createSection({
      rows: [createRow({ children: [createColumn({ blocks: [createBlock('text')] })] })],
    })
    const copy = cloneWithNewIds(section)

    /** @param {any} node */
    const ids = (node) => [
      node.id,
      ...node.rows.flatMap((/** @type {any} */ r) => [
        r.id,
        ...r.columns.flatMap((/** @type {any} */ c) => [
          c.id,
          ...c.blocks.map((/** @type {any} */ b) => b.id),
        ]),
      ]),
    ]
    const before = ids(section)
    const after = ids(copy)

    expect(after).toHaveLength(before.length)
    expect(after.some((/** @type {string} */ id) => before.includes(id))).toBe(false)
    // The prefix is preserved, so ids stay readable after a duplicate.
    expect(after[0].startsWith('sec_')).toBe(true)
    expect(copy.rows[0].columns[0].blocks[0].props.text).toBe(
      section.rows[0].columns[0].blocks[0].props.text,
    )
  })
})

describe('deepClone()', () => {
  it('detaches nested structures', () => {
    const source = { padding: { top: 1 }, items: [{ label: 'a' }] }
    const copy = deepClone(source)
    copy.padding.top = 2
    copy.items[0].label = 'b'
    expect(source.padding.top).toBe(1)
    expect(source.items[0].label).toBe('a')
  })
})

describe('validateDocument()', () => {
  it('passes a freshly built document', () => {
    expect(validateDocument(createDocument())).toEqual([])
  })

  it('rejects a non-object outright, with no further noise', () => {
    expect(validateDocument(null)).toEqual(['document is not an object.'])
    expect(validateDocument('{}')).toEqual(['document is not an object.'])
  })

  it('names the version when the document is newer than this build', () => {
    const doc = createDocument()
    doc.version = SCHEMA_VERSION + 3
    const [problem] = validateDocument(doc)
    expect(problem).toContain(`document.version is ${SCHEMA_VERSION + 3}`)
    expect(problem).toContain('Upgrade mailkiln')
  })

  it('requires a numeric version and a positive width', () => {
    const doc = /** @type {any} */ (createDocument())
    doc.version = '1'
    doc.settings.width = 0
    const problems = validateDocument(doc)
    expect(problems).toContain('document.version must be a number.')
    expect(problems).toContain('document.settings.width must be a positive number.')
  })

  it('stops at the sections check when sections is not an array', () => {
    const doc = /** @type {any} */ (createDocument())
    doc.sections = { 0: {} }
    expect(validateDocument(doc)).toContain('document.sections must be an array.')
  })

  it('reports a reused id once, at the second occurrence', () => {
    const doc = docOf([createBlock('text'), createBlock('text')])
    const blocks = doc.sections[0].rows[0].columns[0].blocks
    blocks[1].id = blocks[0].id
    const problems = validateDocument(doc)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(`reuses id "${blocks[0].id}"`)
  })

  it('checks the discriminator on every level', () => {
    const doc = /** @type {any} */ (docOf([createBlock('text')]))
    doc.sections[0].type = 'group'
    doc.sections[0].rows[0].type = 'line'
    doc.sections[0].rows[0].columns[0].type = 'cell'
    const problems = validateDocument(doc)
    expect(problems).toContain('sections[0].type must be "section".')
    expect(problems).toContain('sections[0].rows[0].type must be "row".')
    expect(problems).toContain('sections[0].rows[0].columns[0].type must be "column".')
  })

  it('insists padding is a full four-sided Spacing', () => {
    const doc = /** @type {any} */ (createDocument())
    doc.sections[0].props.padding = { top: 4 }
    expect(validateDocument(doc)).toContain('sections[0].props.padding must be a Spacing.')
  })

  it('flags column widths that do not add up, and points at the fix', () => {
    const doc = createDocument({
      sections: [
        createSection({
          rows: [
            createRow({
              children: [createColumn({ width: 40 }), createColumn({ width: 40 })],
            }),
          ],
        }),
      ],
    })
    const [problem] = validateDocument(doc)
    expect(problem).toContain('column widths sum to 80')
    expect(problem).toContain('normalize()')
  })

  it('tolerates a rounding drift of one percent', () => {
    const doc = createDocument({
      sections: [
        createSection({
          rows: [
            createRow({ children: [createColumn({ width: 34 }), createColumn({ width: 67 })] }),
          ],
        }),
      ],
    })
    expect(validateDocument(doc)).toEqual([])
  })

  it('only complains about unregistered types when asked to', () => {
    const doc = docOf([createBlock('countdown', {})])
    expect(validateDocument(doc)).toEqual([])
    const [problem] = validateDocument(doc, { knownBlocksOnly: true })
    expect(problem).toContain('unregistered type "countdown"')
    expect(problem).toContain('`blocks` prop')
  })

  it('requires a non-empty block type and an object of props', () => {
    const doc = /** @type {any} */ (docOf([createBlock('text')]))
    doc.sections[0].rows[0].columns[0].blocks[0].type = ''
    doc.sections[0].rows[0].columns[0].blocks[0].props = null
    const problems = validateDocument(doc)
    expect(problems).toContain(
      'sections[0].rows[0].columns[0].blocks[0].type must be a non-empty string.',
    )
    expect(problems).toContain('sections[0].rows[0].columns[0].blocks[0].props must be an object.')
  })
})

describe('assertDocument()', () => {
  it('returns the same document when it is valid, for chaining', () => {
    const doc = createDocument()
    expect(assertDocument(doc, { force: true })).toBe(doc)
  })

  it('throws one error listing the problems it found', () => {
    expect(() => assertDocument(null, { force: true })).toThrow(/mailkiln: invalid document/)
  })

  it('truncates a long list rather than printing a wall of text', () => {
    const doc = /** @type {any} */ (createDocument())
    doc.sections = Array.from({ length: 20 }, () => ({ id: 'dup', type: 'nope', rows: [] }))
    let message = ''
    try {
      assertDocument(doc, { force: true })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toMatch(/… and \d+ more/)
    expect(message.split('\n  - ')).toHaveLength(13)
  })
})
