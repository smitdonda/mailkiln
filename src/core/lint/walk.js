/**
 * Shared traversal for lint rules, so twelve rules don't each hand-roll four
 * nested loops.
 *
 * @module mailforge/core/lint/walk
 */

/** @typedef {import('../types.js').EmailDocument} EmailDocument */
/** @typedef {import('../types.js').Block} Block */

/**
 * @param {EmailDocument} doc
 * @returns {Array<{ block: Block, columnId: string, rowId: string, sectionId: string }>}
 */
export function eachBlock(doc) {
  /** @type {Array<{ block: Block, columnId: string, rowId: string, sectionId: string }>} */
  const out = []
  for (const section of doc?.sections ?? []) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const block of column.blocks ?? []) {
          out.push({ block, columnId: column.id, rowId: row.id, sectionId: section.id })
        }
      }
    }
  }
  return out
}

/**
 * @param {EmailDocument} doc
 * @param {string} type
 * @returns {Block[]}
 */
export function blocksOfType(doc, type) {
  return eachBlock(doc)
    .filter((entry) => entry.block.type === type)
    .map((entry) => entry.block)
}

/**
 * The effective background colour behind a block: its own, else its column's,
 * row's, section's, and finally the document content background.
 *
 * @param {EmailDocument} doc
 * @param {string} blockId
 * @returns {string}
 */
export function effectiveBackground(doc, blockId) {
  for (const section of doc?.sections ?? []) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const block of column.blocks ?? []) {
          if (block.id !== blockId) continue
          return (
            block.props?.backgroundColor ||
            column.props?.backgroundColor ||
            row.props?.backgroundColor ||
            section.props?.backgroundColor ||
            doc.settings?.contentBackgroundColor ||
            '#ffffff'
          )
        }
      }
    }
  }
  return doc?.settings?.contentBackgroundColor || '#ffffff'
}
