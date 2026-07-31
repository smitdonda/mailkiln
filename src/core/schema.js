/**
 * Node factories, defaults, and the runtime schema check.
 *
 * `assertDocument()` is the replacement for the compile-time guarantee we gave
 * up by writing this in JavaScript: it fails loudly at the seam (load, import,
 * `value` prop) instead of letting a malformed document produce broken email
 * HTML three layers later.
 *
 * @module mailforge/core/schema
 */

import { getBlockDef } from './registry.js'
import { isDev } from './env.js'

/** @typedef {import('./types.js').EmailDocument} EmailDocument */
/** @typedef {import('./types.js').DocumentSettings} DocumentSettings */
/** @typedef {import('./types.js').Section} Section */
/** @typedef {import('./types.js').Row} Row */
/** @typedef {import('./types.js').Column} Column */
/** @typedef {import('./types.js').Block} Block */
/** @typedef {import('./types.js').Spacing} Spacing */

/** Current document shape. Bumped only on breaking changes. */
export const SCHEMA_VERSION = 1

/** @type {DocumentSettings} */
export const DEFAULT_SETTINGS = {
  name: '',
  subject: '',
  preheader: '',
  width: 600,
  backgroundColor: '#f4f5f7',
  contentBackgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
  textColor: '#1f2937',
  linkColor: '#2563eb',
  language: 'en',
  darkModeAware: true,
}

export { isDev } from './env.js'

// ---------------------------------------------------------------------------
// ids
// ---------------------------------------------------------------------------

let idCounter = 0

/**
 * Sequential ids keep renderer snapshots and exported JSX diffable. Collisions
 * across sessions are handled by {@link reserveIds}, which every entry point
 * (load, import, normalize) calls before minting new ones.
 *
 * @param {string} [prefix]
 * @returns {string}
 */
export function createId(prefix = 'n') {
  idCounter += 1
  return `${prefix}_${idCounter.toString(36)}`
}

/**
 * Test helper. Resets the id counter so snapshots are stable.
 *
 * @param {number} [to]
 * @returns {void}
 */
export function resetIds(to = 0) {
  idCounter = to
}

/**
 * Bump the counter past every id already present in `doc`, so a document loaded
 * from storage can never collide with freshly created nodes.
 *
 * @param {EmailDocument} doc
 * @returns {void}
 */
export function reserveIds(doc) {
  let max = idCounter
  walkIds(doc, (id) => {
    const tail = /_([0-9a-z]+)$/.exec(id)
    if (!tail) return
    const n = parseInt(tail[1], 36)
    if (Number.isFinite(n) && n > max) max = n
  })
  idCounter = max
}

/**
 * @param {EmailDocument} doc
 * @param {(id: string) => void} fn
 * @returns {void}
 */
function walkIds(doc, fn) {
  for (const section of doc?.sections ?? []) {
    fn(section.id)
    for (const row of section.rows ?? []) {
      fn(row.id)
      for (const col of row.columns ?? []) {
        fn(col.id)
        for (const block of col.blocks ?? []) fn(block.id)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// small value helpers
// ---------------------------------------------------------------------------

/**
 * CSS-shorthand-style spacing builder: `spacing(10)`, `spacing(10, 24)`, …
 *
 * @param {number} [top]
 * @param {number} [right]
 * @param {number} [bottom]
 * @param {number} [left]
 * @returns {Spacing}
 */
export function spacing(top = 0, right = top, bottom = top, left = right) {
  return { top, right, bottom, left }
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

// ---------------------------------------------------------------------------
// factories
// ---------------------------------------------------------------------------

/**
 * Create a block, merging `props` over the registered `defaultProps`.
 *
 * @param {string} type
 * @param {Record<string, any>} [props]
 * @returns {Block}
 */
export function createBlock(type, props = {}) {
  const def = getBlockDef(type)
  const defaults = def ? deepClone(def.defaultProps) : {}
  return { id: createId('blk'), type, props: { ...defaults, ...props } }
}

/**
 * @param {object} [init]
 * @param {number} [init.width]
 * @param {Block[]} [init.blocks]
 * @param {Partial<import('./types.js').ColumnProps>} [init.props]
 * @returns {Column}
 */
export function createColumn(init = {}) {
  return {
    id: createId('col'),
    type: 'column',
    props: {
      width: init.width ?? 100,
      padding: spacing(0),
      verticalAlign: 'top',
      ...init.props,
    },
    blocks: init.blocks ?? [],
  }
}

/**
 * @param {object} [init]
 * @param {number} [init.columns] How many equal-width columns. Default 1.
 * @param {number[]} [init.widths] Explicit widths (percent); overrides `columns`.
 * @param {Column[]} [init.children]
 * @param {Partial<import('./types.js').RowProps>} [init.props]
 * @returns {Row}
 */
export function createRow(init = {}) {
  let columns = init.children
  if (!columns) {
    const widths = init.widths ?? evenWidths(init.columns ?? 1)
    columns = widths.map((width) => createColumn({ width }))
  }
  return {
    id: createId('row'),
    type: 'row',
    props: { padding: spacing(0), stackOnMobile: true, gap: 0, ...init.props },
    columns,
  }
}

/**
 * @param {object} [init]
 * @param {Row[]} [init.rows]
 * @param {Partial<import('./types.js').SectionProps>} [init.props]
 * @returns {Section}
 */
export function createSection(init = {}) {
  return {
    id: createId('sec'),
    type: 'section',
    props: { padding: spacing(0), ...init.props },
    rows: init.rows ?? [createRow()],
  }
}

/**
 * @param {number} count
 * @returns {number[]} `count` widths summing to 100, remainder on the first column
 */
export function evenWidths(count) {
  const n = Math.max(1, Math.min(6, Math.round(count)))
  const base = Math.floor(100 / n)
  const widths = Array.from({ length: n }, () => base)
  widths[0] += 100 - base * n
  return widths
}

/**
 * Create an empty document: one section, one row, one empty column.
 *
 * @param {object} [init]
 * @param {Partial<DocumentSettings>} [init.settings]
 * @param {Section[]} [init.sections]
 * @returns {EmailDocument}
 */
export function createDocument(init = {}) {
  return {
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...init.settings },
    sections: init.sections ?? [createSection()],
  }
}

/**
 * Deep-clone a subtree, minting fresh ids so the copy can live alongside the
 * original. Used by duplicate and by palette drops of composite presets.
 *
 * @template {Section | Row | Column | Block} T
 * @param {T} node
 * @returns {T}
 */
export function cloneWithNewIds(node) {
  const copy = deepClone(node)
  reid(copy)
  return copy
}

/**
 * @param {any} node
 * @returns {void}
 */
function reid(node) {
  if (!node || typeof node !== 'object') return
  if (typeof node.id === 'string') {
    node.id = createId(node.id.split('_')[0] || 'n')
  }
  for (const key of ['rows', 'columns', 'blocks']) {
    if (Array.isArray(node[key])) node[key].forEach(reid)
  }
}

// ---------------------------------------------------------------------------
// runtime validation
// ---------------------------------------------------------------------------

/**
 * @param {any} v
 * @returns {boolean}
 */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * @param {any} v
 * @returns {boolean}
 */
function isSpacing(v) {
  return (
    isPlainObject(v) &&
    ['top', 'right', 'bottom', 'left'].every((k) => typeof v[k] === 'number' && Number.isFinite(v[k]))
  )
}

/**
 * Collect everything wrong with a document. Returns messages rather than
 * throwing, so callers can decide (the editor warns; `assertDocument` throws).
 *
 * @param {any} doc
 * @param {object} [options]
 * @param {boolean} [options.knownBlocksOnly] Also flag block types that aren't registered.
 * @returns {string[]}
 */
export function validateDocument(doc, options = {}) {
  /** @type {string[]} */
  const problems = []
  const seen = new Set()

  /**
   * @param {string} id
   * @param {string} where
   */
  const checkId = (id, where) => {
    if (typeof id !== 'string' || id === '') {
      problems.push(`${where} has no id.`)
      return
    }
    if (seen.has(id)) problems.push(`${where} reuses id "${id}".`)
    seen.add(id)
  }

  if (!isPlainObject(doc)) return ['document is not an object.']
  if (typeof doc.version !== 'number') problems.push('document.version must be a number.')
  else if (doc.version > SCHEMA_VERSION) {
    problems.push(
      `document.version is ${doc.version} but this build of mailforge understands ${SCHEMA_VERSION}. Upgrade mailforge.`,
    )
  }
  if (!isPlainObject(doc.settings)) problems.push('document.settings must be an object.')
  else {
    if (typeof doc.settings.width !== 'number' || doc.settings.width <= 0) {
      problems.push('document.settings.width must be a positive number.')
    }
  }
  if (!Array.isArray(doc.sections)) return [...problems, 'document.sections must be an array.']

  doc.sections.forEach((/** @type {any} */ section, /** @type {number} */ si) => {
    const sw = `sections[${si}]`
    if (!isPlainObject(section)) {
      problems.push(`${sw} is not an object.`)
      return
    }
    checkId(section.id, sw)
    if (section.type !== 'section') problems.push(`${sw}.type must be "section".`)
    if (!isSpacing(section.props?.padding)) problems.push(`${sw}.props.padding must be a Spacing.`)
    if (!Array.isArray(section.rows)) {
      problems.push(`${sw}.rows must be an array.`)
      return
    }

    section.rows.forEach((/** @type {any} */ row, /** @type {number} */ ri) => {
      const rw = `${sw}.rows[${ri}]`
      if (!isPlainObject(row)) {
        problems.push(`${rw} is not an object.`)
        return
      }
      checkId(row.id, rw)
      if (row.type !== 'row') problems.push(`${rw}.type must be "row".`)
      if (!Array.isArray(row.columns) || row.columns.length === 0) {
        problems.push(`${rw}.columns must be a non-empty array.`)
        return
      }

      let total = 0
      row.columns.forEach((/** @type {any} */ col, /** @type {number} */ ci) => {
        const cw = `${rw}.columns[${ci}]`
        if (!isPlainObject(col)) {
          problems.push(`${cw} is not an object.`)
          return
        }
        checkId(col.id, cw)
        if (col.type !== 'column') problems.push(`${cw}.type must be "column".`)
        if (typeof col.props?.width !== 'number') problems.push(`${cw}.props.width must be a number.`)
        else total += col.props.width
        if (!Array.isArray(col.blocks)) {
          problems.push(`${cw}.blocks must be an array.`)
          return
        }

        col.blocks.forEach((/** @type {any} */ block, /** @type {number} */ bi) => {
          const bw = `${cw}.blocks[${bi}]`
          if (!isPlainObject(block)) {
            problems.push(`${bw} is not an object.`)
            return
          }
          checkId(block.id, bw)
          if (typeof block.type !== 'string' || block.type === '') {
            problems.push(`${bw}.type must be a non-empty string.`)
          } else if (options.knownBlocksOnly && !getBlockDef(block.type)) {
            problems.push(
              `${bw} has unregistered type "${block.type}". Pass it via the \`blocks\` prop before loading this document.`,
            )
          }
          if (!isPlainObject(block.props)) problems.push(`${bw}.props must be an object.`)
        })
      })

      if (row.columns.length && Math.abs(total - 100) > 1) {
        problems.push(
          `${rw} column widths sum to ${total}, expected 100. Call normalize() to clamp them.`,
        )
      }
    })
  })

  return problems
}

/**
 * Throw if the document is malformed. Cheap enough to call on load and on every
 * `value` change in dev; skipped entirely in production builds.
 *
 * @param {any} doc
 * @param {object} [options]
 * @param {boolean} [options.knownBlocksOnly]
 * @param {boolean} [options.force] Run even in production.
 * @returns {EmailDocument} the same document, for chaining
 */
export function assertDocument(doc, options = {}) {
  if (!options.force && !isDev()) return doc
  const problems = validateDocument(doc, options)
  if (problems.length) {
    const shown = problems.slice(0, 12)
    const more = problems.length - shown.length
    throw new Error(
      `mailforge: invalid document.\n  - ${shown.join('\n  - ')}${more > 0 ? `\n  … and ${more} more` : ''}`,
    )
  }
  return doc
}
