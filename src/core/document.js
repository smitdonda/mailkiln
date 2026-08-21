/**
 * Pure document operations.
 *
 * Every function here takes a document and returns a *new* document, touching
 * only the branch that changed (untouched arrays keep their identity, so React
 * memoization on the canvas actually works). Nothing in this file knows about
 * the DOM, React or dnd-kit — which is exactly why drag & drop is unit-testable
 * without a browser: the drop handler is a one-line call into `moveBlock`.
 *
 * @module mailkiln/core/document
 */

import {
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  cloneWithNewIds,
  createBlock,
  createColumn,
  createRow,
  createSection,
  evenWidths,
  reserveIds,
  spacing,
} from './schema.js'
import {
  conditionDraft,
  normalizeCondition,
  normalizeRepeat,
  repeatDraft,
} from './conditions.js'

/** @typedef {import('./types.js').EmailDocument} EmailDocument */
/** @typedef {import('./types.js').Section} Section */
/** @typedef {import('./types.js').Row} Row */
/** @typedef {import('./types.js').Column} Column */
/** @typedef {import('./types.js').Block} Block */
/** @typedef {import('./types.js').NodeLocation} NodeLocation */

// ---------------------------------------------------------------------------
// lookup
// ---------------------------------------------------------------------------

/**
 * Resolve an id to its node, parent, index and path.
 *
 * @param {EmailDocument} doc
 * @param {string} id
 * @returns {NodeLocation | null}
 */
export function findNode(doc, id) {
  if (!doc || !id) return null
  const sections = doc.sections ?? []
  for (let si = 0; si < sections.length; si += 1) {
    const section = sections[si]
    if (section.id === id) {
      return { kind: 'section', node: section, parent: doc, index: si, path: [section.id] }
    }
    const rows = section.rows ?? []
    for (let ri = 0; ri < rows.length; ri += 1) {
      const row = rows[ri]
      if (row.id === id) {
        return { kind: 'row', node: row, parent: section, index: ri, path: [section.id, row.id] }
      }
      const columns = row.columns ?? []
      for (let ci = 0; ci < columns.length; ci += 1) {
        const column = columns[ci]
        if (column.id === id) {
          return {
            kind: 'column',
            node: column,
            parent: row,
            index: ci,
            path: [section.id, row.id, column.id],
          }
        }
        const blocks = column.blocks ?? []
        for (let bi = 0; bi < blocks.length; bi += 1) {
          const block = blocks[bi]
          if (block.id === id) {
            return {
              kind: 'block',
              node: block,
              parent: column,
              index: bi,
              path: [section.id, row.id, column.id, block.id],
            }
          }
        }
      }
    }
  }
  return null
}

/**
 * @param {EmailDocument} doc
 * @param {string} id
 * @returns {import('./types.js').NodeKind | null}
 */
export function nodeKind(doc, id) {
  return findNode(doc, id)?.kind ?? null
}

/**
 * @param {EmailDocument} doc
 * @returns {Block[]} every block, in document order
 */
export function listBlocks(doc) {
  /** @type {Block[]} */
  const out = []
  for (const s of doc.sections ?? []) {
    for (const r of s.rows ?? []) {
      for (const c of r.columns ?? []) out.push(...(c.blocks ?? []))
    }
  }
  return out
}

/**
 * @param {EmailDocument} doc
 * @returns {Column[]}
 */
export function listColumns(doc) {
  /** @type {Column[]} */
  const out = []
  for (const s of doc.sections ?? []) {
    for (const r of s.rows ?? []) out.push(...(r.columns ?? []))
  }
  return out
}

// ---------------------------------------------------------------------------
// immutable plumbing
// ---------------------------------------------------------------------------

/**
 * Replace (or drop, when `fn` returns null) the first matching element. Returns
 * the original array when nothing changed.
 *
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => boolean} match
 * @param {(item: T, index: number) => T | null} fn
 * @returns {T[]}
 */
function mapFirst(arr, match, fn) {
  const i = arr.findIndex(match)
  if (i === -1) return arr
  const next = fn(arr[i], i)
  if (next === arr[i]) return arr
  const copy = arr.slice()
  if (next === null) copy.splice(i, 1)
  else copy[i] = next
  return copy
}

/**
 * @param {EmailDocument} doc
 * @param {Section[]} sections
 * @returns {EmailDocument}
 */
function withSections(doc, sections) {
  return sections === doc.sections ? doc : { ...doc, sections }
}

/**
 * @param {EmailDocument} doc
 * @param {string} sectionId
 * @param {(section: Section) => Section | null} fn
 * @returns {EmailDocument}
 */
export function updateSection(doc, sectionId, fn) {
  return withSections(
    doc,
    mapFirst(doc.sections ?? [], (s) => s.id === sectionId, fn),
  )
}

/**
 * @param {EmailDocument} doc
 * @param {string} rowId
 * @param {(row: Row) => Row | null} fn
 * @returns {EmailDocument}
 */
export function updateRow(doc, rowId, fn) {
  const loc = findNode(doc, rowId)
  if (!loc || loc.kind !== 'row') return doc
  const [sectionId] = loc.path
  return updateSection(doc, sectionId, (section) => {
    const rows = mapFirst(section.rows, (r) => r.id === rowId, fn)
    return rows === section.rows ? section : { ...section, rows }
  })
}

/**
 * @param {EmailDocument} doc
 * @param {string} columnId
 * @param {(column: Column) => Column | null} fn
 * @returns {EmailDocument}
 */
export function updateColumn(doc, columnId, fn) {
  const loc = findNode(doc, columnId)
  if (!loc || loc.kind !== 'column') return doc
  const [, rowId] = loc.path
  return updateRow(doc, rowId, (row) => {
    const columns = mapFirst(row.columns, (c) => c.id === columnId, fn)
    return columns === row.columns ? row : { ...row, columns }
  })
}

/**
 * @param {EmailDocument} doc
 * @param {string} columnId
 * @param {(blocks: Block[]) => Block[]} fn
 * @returns {EmailDocument}
 */
export function updateBlocks(doc, columnId, fn) {
  return updateColumn(doc, columnId, (column) => {
    const blocks = fn(column.blocks ?? [])
    return blocks === column.blocks ? column : { ...column, blocks }
  })
}

/**
 * @param {number} index
 * @param {number} length
 * @returns {number}
 */
function clampIndex(index, length) {
  if (!Number.isFinite(index) || index < 0 || index > length) return length
  return Math.floor(index)
}

// ---------------------------------------------------------------------------
// block ops
// ---------------------------------------------------------------------------

/**
 * Insert a block into a column. Pass either a ready `block` or a `type` (+
 * optional `props`) to build one from the registry defaults — the palette drop
 * handler uses the latter.
 *
 * @param {EmailDocument} doc
 * @param {object} args
 * @param {string} args.columnId
 * @param {number} [args.index] Defaults to the end of the column.
 * @param {Block} [args.block]
 * @param {string} [args.type]
 * @param {Record<string, any>} [args.props]
 * @returns {EmailDocument}
 */
export function insertBlock(doc, { columnId, index, block, type, props }) {
  const target = findNode(doc, columnId)
  if (!target || target.kind !== 'column') return doc
  const node = block ?? createBlock(/** @type {string} */ (type), props)
  if (!node) return doc
  return updateBlocks(doc, columnId, (blocks) => {
    const at = clampIndex(index ?? blocks.length, blocks.length)
    const next = blocks.slice()
    next.splice(at, 0, node)
    return next
  })
}

/**
 * Move a block to a column + index. Works across columns *and* across sections
 * because the target is addressed by column id, not by coordinates.
 *
 * A same-column move accounts for the removal shifting later indices, so
 * `moveBlock(doc, { blockId, toColumnId: same, toIndex: 3 })` lands at 3.
 *
 * @param {EmailDocument} doc
 * @param {object} args
 * @param {string} args.blockId
 * @param {string} args.toColumnId
 * @param {number} [args.toIndex]
 * @returns {EmailDocument}
 */
export function moveBlock(doc, { blockId, toColumnId, toIndex }) {
  const loc = findNode(doc, blockId)
  if (!loc || loc.kind !== 'block') return doc
  const dest = findNode(doc, toColumnId)
  if (!dest || dest.kind !== 'column') return doc

  const fromColumnId = /** @type {Column} */ (loc.parent).id
  const block = /** @type {Block} */ (loc.node)

  if (fromColumnId === toColumnId) {
    return updateBlocks(doc, toColumnId, (blocks) => {
      const from = blocks.findIndex((b) => b.id === blockId)
      let to = clampIndex(toIndex ?? blocks.length, blocks.length)
      if (from === -1) return blocks
      if (to > from) to -= 1
      if (to === from) return blocks
      const next = blocks.slice()
      next.splice(from, 1)
      next.splice(to, 0, block)
      return next
    })
  }

  const without = updateBlocks(doc, fromColumnId, (blocks) => blocks.filter((b) => b.id !== blockId))
  return insertBlock(without, { columnId: toColumnId, index: toIndex, block })
}

/**
 * @param {EmailDocument} doc
 * @param {string} blockId
 * @returns {EmailDocument}
 */
export function removeBlock(doc, blockId) {
  const loc = findNode(doc, blockId)
  if (!loc || loc.kind !== 'block') return doc
  return updateBlocks(doc, /** @type {Column} */ (loc.parent).id, (blocks) =>
    blocks.filter((b) => b.id !== blockId),
  )
}

// ---------------------------------------------------------------------------
// generic node ops
// ---------------------------------------------------------------------------

/**
 * Remove any node by id. Removing the last row of a section removes the
 * section too — `normalize` would do it anyway, doing it here keeps undo to one
 * step.
 *
 * @param {EmailDocument} doc
 * @param {string} id
 * @returns {EmailDocument}
 */
export function removeNode(doc, id) {
  const loc = findNode(doc, id)
  if (!loc) return doc
  switch (loc.kind) {
    case 'block':
      return removeBlock(doc, id)
    case 'column': {
      const row = /** @type {Row} */ (loc.parent)
      if (row.columns.length <= 1) return removeNode(doc, row.id)
      return updateRow(doc, row.id, (r) => {
        const columns = r.columns.filter((c) => c.id !== id)
        return { ...r, columns: rebalance(columns) }
      })
    }
    case 'row': {
      const section = /** @type {Section} */ (loc.parent)
      if (section.rows.length <= 1) return removeNode(doc, section.id)
      return updateSection(doc, section.id, (s) => ({
        ...s,
        rows: s.rows.filter((r) => r.id !== id),
      }))
    }
    case 'section':
      return withSections(
        doc,
        (doc.sections ?? []).filter((s) => s.id !== id),
      )
    default:
      return doc
  }
}

/**
 * Duplicate any node, inserting the copy directly after the original with fresh
 * ids throughout.
 *
 * @param {EmailDocument} doc
 * @param {string} id
 * @returns {EmailDocument}
 */
export function duplicateNode(doc, id) {
  const loc = findNode(doc, id)
  if (!loc) return doc
  const copy = cloneWithNewIds(/** @type {any} */ (loc.node))

  switch (loc.kind) {
    case 'block':
      return updateBlocks(doc, /** @type {Column} */ (loc.parent).id, (blocks) => {
        const next = blocks.slice()
        next.splice(loc.index + 1, 0, copy)
        return next
      })
    case 'column':
      return updateRow(doc, /** @type {Row} */ (loc.parent).id, (row) => {
        const columns = row.columns.slice()
        columns.splice(loc.index + 1, 0, copy)
        return { ...row, columns: rebalance(columns) }
      })
    case 'row':
      return updateSection(doc, /** @type {Section} */ (loc.parent).id, (section) => {
        const rows = section.rows.slice()
        rows.splice(loc.index + 1, 0, copy)
        return { ...section, rows }
      })
    case 'section': {
      const sections = (doc.sections ?? []).slice()
      sections.splice(loc.index + 1, 0, copy)
      return withSections(doc, sections)
    }
    default:
      return doc
  }
}

/**
 * Patch a node's props. Keys may be dotted paths (`padding.top`), which is what
 * the auto-generated Inspector fields emit.
 *
 * @param {EmailDocument} doc
 * @param {string} id
 * @param {Record<string, any>} patch
 * @returns {EmailDocument}
 */
export function patchProps(doc, id, patch) {
  const loc = findNode(doc, id)
  if (!loc) return doc
  const node = /** @type {any} */ (loc.node)
  const props = applyPatch(node.props ?? {}, patch)
  if (props === node.props) return doc
  const updated = { ...node, props }

  switch (loc.kind) {
    case 'block':
      return updateBlocks(doc, /** @type {Column} */ (loc.parent).id, (blocks) =>
        blocks.map((b) => (b.id === id ? updated : b)),
      )
    case 'column':
      return updateColumn(doc, id, () => updated)
    case 'row':
      return updateRow(doc, id, () => updated)
    case 'section':
      return updateSection(doc, id, () => updated)
    default:
      return doc
  }
}

/**
 * @param {Record<string, any>} target
 * @param {Record<string, any>} patch
 * @returns {Record<string, any>} a new object, or `target` when the patch is a no-op
 */
function applyPatch(target, patch) {
  let changed = false
  const next = { ...target }
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key.includes('.')) {
      const [head, ...rest] = key.split('.')
      const branch = applyPatch(next[head] ?? {}, { [rest.join('.')]: value })
      if (branch !== next[head]) {
        next[head] = branch
        changed = true
      }
    } else if (next[key] !== value) {
      next[key] = value
      changed = true
    }
  }
  return changed ? next : target
}

/**
 * @param {EmailDocument} doc
 * @param {Partial<import('./types.js').DocumentSettings>} patch
 * @returns {EmailDocument}
 */
export function patchSettings(doc, patch) {
  const settings = applyPatch(doc.settings ?? {}, patch)
  return settings === doc.settings
    ? doc
    : { ...doc, settings: /** @type {import('./types.js').DocumentSettings} */ (settings) }
}

/**
 * Set (or clear) a node's display condition.
 *
 * `showIf` sits on the node rather than inside `props` on purpose: it means the
 * same thing for a section, a row and a block, and it is not a block property —
 * a `BlockDef` should not have to declare it, and `patchProps` should not be able
 * to clobber it.
 *
 * @param {EmailDocument} doc
 * @param {string} id
 * @param {import('./types.js').Condition | null} showIf Pass `null` to remove it.
 * @returns {EmailDocument}
 */
export function setCondition(doc, id, showIf) {
  return replaceNode(doc, id, (node) => {
    // A *draft*, not a normalized condition: the Inspector has to store one the
    // moment you flip the switch, before you have typed a path. Readers still
    // refuse an incomplete condition, and `normalize()` drops it on save/load.
    const next = showIf == null ? null : conditionDraft(showIf)
    if (!next && !node.showIf) return node
    if (next && node.showIf && JSON.stringify(next) === JSON.stringify(node.showIf)) return node
    const copy = { ...node }
    if (next) copy.showIf = next
    else delete copy.showIf
    return copy
  })
}

/**
 * Set (or clear) a row's repeat.
 *
 * Rows only. A repeated block would have to duplicate its wrapper cell, and a
 * repeated section would repeat the page background — the row is the level where
 * "one of these per item" means what people expect.
 *
 * @param {EmailDocument} doc
 * @param {string} rowId
 * @param {import('./types.js').Repeat | null} repeat Pass `null` to remove it.
 * @returns {EmailDocument}
 */
export function setRepeat(doc, rowId, repeat) {
  const loc = findNode(doc, rowId)
  if (!loc || loc.kind !== 'row') return doc
  return replaceNode(doc, rowId, (node) => {
    const next = repeat == null ? null : repeatDraft(repeat)
    if (!next && !node.repeat) return node
    if (next && node.repeat && JSON.stringify(next) === JSON.stringify(node.repeat)) return node
    const copy = { ...node }
    if (next) copy.repeat = next
    else delete copy.repeat
    return copy
  })
}

/**
 * Swap a node for the result of `fn`, whatever kind it is.
 *
 * @param {EmailDocument} doc
 * @param {string} id
 * @param {(node: any) => any} fn
 * @returns {EmailDocument}
 */
function replaceNode(doc, id, fn) {
  const loc = findNode(doc, id)
  if (!loc) return doc
  const updated = fn(loc.node)
  if (updated === loc.node) return doc

  switch (loc.kind) {
    case 'block':
      return updateBlocks(doc, /** @type {Column} */ (loc.parent).id, (blocks) =>
        blocks.map((b) => (b.id === id ? updated : b)),
      )
    case 'column':
      return updateColumn(doc, id, () => updated)
    case 'row':
      return updateRow(doc, id, () => updated)
    case 'section':
      return updateSection(doc, id, () => updated)
    default:
      return doc
  }
}

// ---------------------------------------------------------------------------
// structure ops
// ---------------------------------------------------------------------------

/**
 * @param {EmailDocument} doc
 * @param {object} [args]
 * @param {number} [args.index]
 * @param {Section} [args.section]
 * @param {number} [args.columns] Column count when building a fresh section.
 * @param {number[]} [args.widths] Explicit column widths; overrides `columns`.
 * @returns {EmailDocument}
 */
export function insertSection(doc, { index, section, columns, widths } = {}) {
  const node = section ?? createSection({ rows: [createRow({ columns: columns ?? 1, widths })] })
  const sections = (doc.sections ?? []).slice()
  sections.splice(clampIndex(index ?? sections.length, sections.length), 0, node)
  return withSections(doc, sections)
}

/**
 * @param {EmailDocument} doc
 * @param {object} args
 * @param {string} args.sectionId
 * @param {number} [args.index]
 * @param {Row} [args.row]
 * @param {number} [args.columns]
 * @param {number[]} [args.widths] Explicit column widths; overrides `columns`.
 * @returns {EmailDocument}
 */
export function insertRow(doc, { sectionId, index, row, columns, widths }) {
  const loc = findNode(doc, sectionId)
  if (!loc || loc.kind !== 'section') return doc
  const node = row ?? createRow({ columns: columns ?? 1, widths })
  return updateSection(doc, sectionId, (section) => {
    const rows = section.rows.slice()
    rows.splice(clampIndex(index ?? rows.length, rows.length), 0, node)
    return { ...section, rows }
  })
}

/**
 * @param {EmailDocument} doc
 * @param {string} sectionId
 * @param {number} toIndex
 * @returns {EmailDocument}
 */
export function moveSection(doc, sectionId, toIndex) {
  const sections = doc.sections ?? []
  const from = sections.findIndex((s) => s.id === sectionId)
  if (from === -1) return doc
  let to = clampIndex(toIndex, sections.length)
  if (to > from) to -= 1
  if (to === from) return doc
  const next = sections.slice()
  const [node] = next.splice(from, 1)
  next.splice(to, 0, node)
  return withSections(doc, next)
}

/**
 * Move a row, optionally into a different section.
 *
 * @param {EmailDocument} doc
 * @param {object} args
 * @param {string} args.rowId
 * @param {string} [args.toSectionId]
 * @param {number} [args.toIndex]
 * @returns {EmailDocument}
 */
export function moveRow(doc, { rowId, toSectionId, toIndex }) {
  const loc = findNode(doc, rowId)
  if (!loc || loc.kind !== 'row') return doc
  const fromSectionId = /** @type {Section} */ (loc.parent).id
  const targetSectionId = toSectionId ?? fromSectionId
  const row = /** @type {Row} */ (loc.node)

  if (targetSectionId === fromSectionId) {
    return updateSection(doc, fromSectionId, (section) => {
      const from = section.rows.findIndex((r) => r.id === rowId)
      let to = clampIndex(toIndex ?? section.rows.length, section.rows.length)
      if (to > from) to -= 1
      if (to === from) return section
      const rows = section.rows.slice()
      rows.splice(from, 1)
      rows.splice(to, 0, row)
      return { ...section, rows }
    })
  }

  const without = updateSection(doc, fromSectionId, (section) => ({
    ...section,
    rows: section.rows.filter((r) => r.id !== rowId),
  }))
  const moved = insertRow(without, { sectionId: targetSectionId, index: toIndex, row })
  // Dropping the last row out of a section leaves it empty; normalize prunes it.
  return moved
}

/**
 * Change a row's column count, keeping existing content. Extra columns are
 * appended; removed columns have their blocks appended to the last survivor so
 * changing the layout never silently deletes content.
 *
 * @param {EmailDocument} doc
 * @param {string} rowId
 * @param {number} count
 * @returns {EmailDocument}
 */
export function setRowColumns(doc, rowId, count) {
  return updateRow(doc, rowId, (row) => {
    const target = Math.max(1, Math.min(6, Math.round(count)))
    if (target === row.columns.length) return row
    let columns = row.columns.slice()
    if (target > columns.length) {
      while (columns.length < target) columns.push(createColumn())
    } else {
      const dropped = columns.slice(target)
      columns = columns.slice(0, target)
      const orphans = dropped.flatMap((c) => c.blocks ?? [])
      if (orphans.length) {
        const last = columns[columns.length - 1]
        columns[columns.length - 1] = { ...last, blocks: [...(last.blocks ?? []), ...orphans] }
      }
    }
    return { ...row, columns: rebalance(columns) }
  })
}

/**
 * Apply a whole layout to an existing row: column count *and* widths, in one
 * operation so it lands as a single undo step. Doing it as
 * `setRowColumns` + `setColumnWidths` produced two entries, and undoing a layout
 * change left the row half-converted.
 *
 * @param {EmailDocument} doc
 * @param {string} rowId
 * @param {number[]} widths Percentages; their length is the new column count.
 * @returns {EmailDocument}
 */
export function setRowLayout(doc, rowId, widths) {
  if (!Array.isArray(widths) || widths.length === 0) return doc
  const resized = setRowColumns(doc, rowId, widths.length)
  return setColumnWidths(resized, rowId, widths)
}

/**
 * @param {EmailDocument} doc
 * @param {string} rowId
 * @param {number[]} widths
 * @returns {EmailDocument}
 */
export function setColumnWidths(doc, rowId, widths) {
  return updateRow(doc, rowId, (row) => ({
    ...row,
    columns: row.columns.map((c, i) => {
      const width = widths[i]
      if (typeof width !== 'number' || c.props.width === width) return c
      return { ...c, props: { ...c.props, width } }
    }),
  }))
}

/**
 * Reset column widths to even shares.
 *
 * @param {Column[]} columns
 * @returns {Column[]}
 */
function rebalance(columns) {
  const widths = evenWidths(columns.length)
  return columns.map((c, i) =>
    c.props.width === widths[i] ? c : { ...c, props: { ...c.props, width: widths[i] } },
  )
}

// ---------------------------------------------------------------------------
// normalize
// ---------------------------------------------------------------------------

/**
 * Bring a document back to a canonical, renderable state:
 *
 * - fill in missing settings and the schema version
 * - drop rows with no columns and sections with no rows
 * - re-id duplicates (documents merged from two sources)
 * - clamp each row's column widths so they sum to 100
 * - coerce padding to full `Spacing` objects
 *
 * Returns the *same* document when nothing needed fixing, so it is safe to call
 * from a React effect without looping.
 *
 * @param {EmailDocument} doc
 * @returns {EmailDocument}
 */
export function normalize(doc) {
  if (!doc || typeof doc !== 'object') return doc
  reserveIds(doc)

  const seen = new Set()
  /**
   * @param {string} id
   * @param {string} prefix
   * @returns {string}
   */
  const uniqueId = (id, prefix) => {
    let next = typeof id === 'string' && id ? id : `${prefix}_x`
    while (seen.has(next)) next = `${prefix}_${Math.random().toString(36).slice(2, 7)}`
    seen.add(next)
    return next
  }

  const sections = (doc.sections ?? [])
    .filter((s) => s && Array.isArray(s.rows))
    .map((section) => {
      const rows = (section.rows ?? [])
        .filter((r) => r && Array.isArray(r.columns) && r.columns.length > 0)
        .map((row) => {
          const columns = row.columns
            .filter(Boolean)
            .map((column) => ({
              ...column,
              id: uniqueId(column.id, 'col'),
              type: /** @type {'column'} */ ('column'),
              props: {
                verticalAlign: 'top',
                ...column.props,
                width: Number(column.props?.width) || 0,
                padding: asSpacing(column.props?.padding),
              },
              blocks: (column.blocks ?? [])
                .filter((b) => b && typeof b.type === 'string')
                .map((block) =>
                  settled({
                    ...block,
                    id: uniqueId(block.id, 'blk'),
                    props: block.props && typeof block.props === 'object' ? block.props : {},
                  }),
                ),
            }))
          return settled({
            ...row,
            id: uniqueId(row.id, 'row'),
            type: /** @type {'row'} */ ('row'),
            props: {
              stackOnMobile: true,
              gap: 0,
              ...row.props,
              padding: asSpacing(row.props?.padding),
            },
            columns: normalizeWidths(/** @type {Column[]} */ (columns)),
          })
        })
      return settled({
        ...section,
        id: uniqueId(section.id, 'sec'),
        type: /** @type {'section'} */ ('section'),
        props: { ...section.props, padding: asSpacing(section.props?.padding) },
        rows,
      })
    })
    .filter((s) => s.rows.length > 0)

  const next = {
    ...doc,
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...doc.settings },
    sections,
  }

  // Documents are small (tens of nodes); a stringify compare is cheaper than
  // threading a dirty flag through every branch above, and it keeps this
  // function honest about returning the same reference on a no-op.
  return JSON.stringify(next) === JSON.stringify(doc) ? doc : next
}

/**
 * Canonicalize a node's condition and repeat without discarding an unfinished
 * one.
 *
 * The tempting move is to drop anything `normalizeCondition` rejects. That is
 * wrong here: `normalize()` runs on every change of the controlled `value`
 * prop, so dropping a half-typed condition means the Inspector's switch cannot
 * stay on long enough for you to type a path — the draft dies on the round trip.
 * Discarding it would also throw away real, if unfinished, work the moment you
 * clicked another block.
 *
 * So drafts survive editing and stay inert (every reader ignores an incomplete
 * condition); `exportDocument` is where they are stripped, because *that* is the
 * artifact that has to be clean.
 *
 * @template T
 * @param {T} node
 * @returns {T}
 */
function settled(node) {
  const draft = /** @type {any} */ (node)
  if (draft.showIf !== undefined) {
    const showIf = conditionDraft(draft.showIf)
    if (showIf) draft.showIf = showIf
    else delete draft.showIf
  }
  if (draft.repeat !== undefined) {
    const repeat = repeatDraft(draft.repeat)
    if (repeat) draft.repeat = repeat
    else delete draft.repeat
  }
  return node
}

/**
 * Strip conditions and repeats that were never finished. Called by
 * `exportDocument` so a saved template carries only usable ones.
 *
 * @param {EmailDocument} doc
 * @returns {EmailDocument}
 */
export function settleDrafts(doc) {
  /** @param {any} node */
  const clean = (node) => {
    const next = { ...node }
    if (next.showIf !== undefined && !normalizeCondition(next.showIf)) delete next.showIf
    if (next.repeat !== undefined && !normalizeRepeat(next.repeat)) delete next.repeat
    return next
  }
  let changed = false
  const sections = (doc?.sections ?? []).map((section) => {
    const rows = (section.rows ?? []).map((row) => {
      const columns = (row.columns ?? []).map((column) => {
        const blocks = (column.blocks ?? []).map((block) => {
          const next = clean(block)
          if (next.showIf !== block.showIf) changed = true
          return next
        })
        return { ...column, blocks }
      })
      const next = clean({ ...row, columns })
      if (next.showIf !== row.showIf || next.repeat !== row.repeat) changed = true
      return next
    })
    const next = clean({ ...section, rows })
    if (next.showIf !== section.showIf) changed = true
    return next
  })
  return changed ? { ...doc, sections } : doc
}

/**
 * @param {any} value
 * @returns {import('./types.js').Spacing}
 */
function asSpacing(value) {
  if (typeof value === 'number') return spacing(value)
  if (!value || typeof value !== 'object') return spacing(0)
  return {
    top: num(value.top),
    right: num(value.right),
    bottom: num(value.bottom),
    left: num(value.left),
  }
}

/**
 * @param {any} v
 * @returns {number}
 */
function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Clamp widths to sum to 100, preserving relative proportions.
 *
 * @param {Column[]} columns
 * @returns {Column[]}
 */
function normalizeWidths(columns) {
  if (columns.length === 0) return columns
  const total = columns.reduce((sum, c) => sum + (Number(c.props.width) || 0), 0)
  if (total > 0 && Math.abs(total - 100) <= 0.5) return columns
  const widths =
    total <= 0
      ? evenWidths(columns.length)
      : (() => {
          const scaled = columns.map((c) => Math.round(((Number(c.props.width) || 0) / total) * 100))
          const drift = 100 - scaled.reduce((a, b) => a + b, 0)
          scaled[0] += drift
          return scaled
        })()
  return columns.map((c, i) =>
    c.props.width === widths[i] ? c : { ...c, props: { ...c.props, width: widths[i] } },
  )
}
