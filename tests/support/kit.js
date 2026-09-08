/**
 * Shared test kit.
 *
 * Deliberately thin: builders for the three shapes every spec needs (a document
 * with known blocks, a `VarsDef`, a DOM parser) and one narrowing lookup, so the
 * specs themselves stay about behaviour rather than about setup.
 *
 * @module tests/support/kit
 */

import { parseHTML } from 'linkedom'
import {
  createBlock,
  createColumn,
  createDocument,
  createRow,
  createSection,
  defineVars,
  findNode,
} from '../../src/core/index.js'

/** @typedef {import('../../src/core/types.js').EmailDocument} EmailDocument */
/** @typedef {import('../../src/core/types.js').Block} Block */

/**
 * Node has no DOM, so the importer and the rich-text normalizer take one.
 * linkedom's document is structurally a `Document` for everything they touch.
 *
 * @type {(html: string) => Document}
 */
export const parseHtml = (html) => /** @type {any} */ (parseHTML(html).document)

/**
 * A one-section, one-row, one-column document holding `blocks`.
 *
 * @param {Block[]} [blocks]
 * @param {object} [init]
 * @param {Partial<import('../../src/core/types.js').DocumentSettings>} [init.settings]
 * @param {Partial<import('../../src/core/types.js').SectionProps>} [init.section]
 * @param {Partial<import('../../src/core/types.js').RowProps>} [init.row]
 * @returns {EmailDocument}
 */
export function docOf(blocks = [], init = {}) {
  return createDocument({
    settings: init.settings,
    sections: [
      createSection({
        props: init.section,
        rows: [
          createRow({
            props: init.row,
            children: [createColumn({ width: 100, blocks })],
          }),
        ],
      }),
    ],
  })
}

/**
 * A document whose single row has `count` columns, each holding its own blocks.
 *
 * @param {Block[][]} cells
 * @returns {EmailDocument}
 */
export function docOfColumns(cells) {
  const widths = cells.map(() => Math.floor(100 / cells.length))
  widths[0] += 100 - widths.reduce((a, b) => a + b, 0)
  return createDocument({
    sections: [
      createSection({
        rows: [
          createRow({
            children: cells.map((blocks, i) => createColumn({ width: widths[i], blocks })),
          }),
        ],
      }),
    ],
  })
}

/**
 * @param {string} type
 * @param {Record<string, any>} [props]
 * @returns {Block}
 */
export function block(type, props = {}) {
  return createBlock(type, props)
}

/**
 * `findNode`, but it throws instead of returning null — a spec that looks up an
 * id it just created wants a failure, not a silent `undefined` three lines later.
 *
 * @param {EmailDocument} doc
 * @param {string} id
 * @returns {import('../../src/core/types.js').NodeLocation}
 */
export function at(doc, id) {
  const found = findNode(doc, id)
  if (!found) throw new Error(`test kit: no node "${id}" in this document`)
  return found
}

/**
 * The first column id — where most specs insert.
 *
 * @param {EmailDocument} doc
 * @returns {string}
 */
export function firstColumnId(doc) {
  const id = doc.sections[0]?.rows[0]?.columns[0]?.id
  if (!id) throw new Error('test kit: document has no first column')
  return id
}

/**
 * @param {EmailDocument} doc
 * @returns {string}
 */
export function firstRowId(doc) {
  const id = doc.sections[0]?.rows[0]?.id
  if (!id) throw new Error('test kit: document has no first row')
  return id
}

/**
 * Every block in document order, for asserting on structure ops.
 *
 * @param {EmailDocument} doc
 * @returns {Block[]}
 */
export function allBlocksIn(doc) {
  return (doc.sections ?? []).flatMap((s) =>
    (s.rows ?? []).flatMap((r) => (r.columns ?? []).flatMap((c) => c.blocks ?? [])),
  )
}

/**
 * The sample data the merge-variable specs share. Covers every `kindOf` branch:
 * string, number, boolean, nested object and array of objects.
 *
 * @returns {import('../../src/core/types.js').VarsDef}
 */
export function sampleVars() {
  return defineVars({
    sample: {
      user: { name: 'Ada', pro: true, visits: 12 },
      order: {
        id: 'A-1',
        total: 42.5,
        items: [
          { title: 'Kiln', price: 30 },
          { title: 'Clay', price: 12.5 },
        ],
      },
    },
  })
}
