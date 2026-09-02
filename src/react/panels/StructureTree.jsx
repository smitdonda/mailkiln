/**
 * The structure pane: the document as a tree, on the left.
 *
 * Nothing here is invented for the editor — it is the same JSON the consumer
 * owns. A section is a section; a repeat is the repeat that becomes a `.map()`
 * on export.
 *
 * It exists because the canvas cannot answer three questions. Where am I, in a
 * document long enough to scroll? How do I reach a row whose columns fill it,
 * leaving none of the row itself to click? And which block is the linter
 * complaining about — answered here by a dot on the node, rather than by reading
 * the issue list and hunting for the block it names.
 *
 * @module mailkiln/react/panels/StructureTree
 */

import { useMemo, useState } from 'react'
import { getBlockDef, stripTags } from '../../core/index.js'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { IconChevronLeft, IconChevronRight, IconPlus } from '../icons.jsx'

/** @typedef {import('../../core/types.js').EmailDocument} EmailDocument */
/** @typedef {import('../../core/types.js').LintLevel} LintLevel */

/**
 * One row of the tree. Flat rather than nested: a list of buttons in document
 * order is one tab stop each, which is what both arrow keys and screen readers
 * want out of a tree.
 *
 * @typedef {object} TreeRow
 * @property {string} id
 * @property {'section' | 'row' | 'column' | 'block'} kind
 * @property {number} depth
 * @property {string} label
 * @property {boolean} branch Whether this node has children to fold away.
 * @property {string | null} columnId Set on the trailing "add block" row.
 */

/** Longest a block's own content may run before it is cut with an ellipsis. */
const SUMMARY_MAX = 30

/**
 * Props a block might carry its content in, most specific first. Blocks are
 * third-party-extensible, so this cannot be a lookup by type — but every block
 * that has something worth naming spells it one of these ways.
 */
const SUMMARY_KEYS = ['text', 'label', 'title', 'alt', 'src', 'href']

/**
 * @param {object} props
 * @param {() => void} [props.onQuickInsert] Opens quick insert. The tree selects
 *   the column first, so the block lands where the "add" row said it would.
 * @param {() => void} [props.onShowChecks] Switches to the Checks view. Without
 *   it the counts in the footer are text rather than a way in.
 * @returns {import('react').ReactElement}
 */
export function StructureTree({ onQuickInsert, onShowChecks }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const { doc, lint, selectedId } = store
  const [collapsed, setCollapsed] = useState(false)
  const [folded, setFolded] = useState(/** @type {Record<string, boolean>} */ ({}))

  // Worst level per node, so a block with an error and a warning shows the
  // error. Rules report against the node at fault, which is exactly the node
  // this tree draws.
  const levels = useMemo(() => {
    /** @type {Record<string, LintLevel>} */
    const map = {}
    for (const issue of lint.issues) {
      if (!issue.nodeId || issue.level === 'info') continue
      if (map[issue.nodeId] === 'error') continue
      map[issue.nodeId] = issue.level
    }
    return map
  }, [lint])

  const rows = useMemo(() => buildRows(doc, folded, t), [doc, folded, t])

  const title = t('structure.title')

  return (
    <aside className="mk-tree" data-collapsed={collapsed ? 'true' : undefined} aria-label={title}>
      <div className="mk-tree-head">
        <span className="mk-tree-title">{title}</span>
        <button
          type="button"
          className="mk-btn mk-btn-icon mk-tree-toggle"
          aria-label={collapsed ? t('structure.expand') : t('structure.collapse')}
          title={collapsed ? t('structure.expand') : t('structure.collapse')}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((open) => !open)}
        >
          <IconChevronLeft />
        </button>
      </div>

      <div className="mk-tree-body">
        {rows.map((row) =>
          row.columnId ? (
            <button
              key={row.id}
              type="button"
              className="mk-tree-add"
              data-depth={row.depth}
              onClick={() => {
                // Select the column first: quick insert appends to the current
                // selection, so this is what makes "add here" mean here.
                store.select(row.columnId)
                onQuickInsert?.()
              }}
            >
              <IconPlus />
              {t('structure.add')}
            </button>
          ) : (
            <button
              key={row.id}
              type="button"
              className="mk-tree-node"
              data-kind={row.kind}
              data-depth={row.depth}
              data-selected={selectedId === row.id ? 'true' : undefined}
              aria-expanded={row.branch ? !folded[row.id] : undefined}
              onClick={() => store.select(row.id)}
              onKeyDown={(event) => {
                // Arrow keys fold and unfold, as they do in every tree. The
                // twisty is a mouse target; this is the same action for anyone
                // driving the editor from the keyboard.
                if (!row.branch) return
                if (event.key === 'ArrowRight') setFolded(unfold(row.id))
                else if (event.key === 'ArrowLeft') setFolded(fold(row.id))
              }}
            >
              {row.branch ? (
                <span
                  className="mk-tree-twist"
                  aria-hidden="true"
                  onClick={(event) => {
                    // Folding is not selecting. Without this, reaching for the
                    // twisty also moves the panel to another node.
                    event.stopPropagation()
                    setFolded((state) => ({ ...state, [row.id]: !state[row.id] }))
                  }}
                >
                  <IconChevronRight />
                </span>
              ) : (
                <span className="mk-tree-twist" />
              )}
              <span className="mk-tree-label">{row.label}</span>
              {levels[row.id] ? <span className="mk-tree-dot" data-level={levels[row.id]} /> : null}
            </button>
          ),
        )}
      </div>

      {lint.errors + lint.warnings > 0 ? (
        <div className="mk-tree-foot">
          {lint.errors > 0 ? (
            <button type="button" className="mk-tree-count" onClick={onShowChecks}>
              <span className="mk-tree-dot" data-level="error" />
              {t(lint.errors === 1 ? 'lint.error' : 'lint.errors', { count: lint.errors })}
            </button>
          ) : null}
          {lint.warnings > 0 ? (
            <button type="button" className="mk-tree-count" onClick={onShowChecks}>
              <span className="mk-tree-dot" data-level="warn" />
              {t(lint.warnings === 1 ? 'lint.warning' : 'lint.warnings', {
                count: lint.warnings,
              })}
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

/**
 * @param {string} id
 * @returns {(state: Record<string, boolean>) => Record<string, boolean>}
 */
function fold(id) {
  return (state) => ({ ...state, [id]: true })
}

/**
 * @param {string} id
 * @returns {(state: Record<string, boolean>) => Record<string, boolean>}
 */
function unfold(id) {
  return (state) => ({ ...state, [id]: false })
}

/**
 * Flatten the document into rows, skipping what carries no information: a
 * single-column row has no column worth a line of its own, so its blocks hang
 * off the row directly.
 *
 * @param {EmailDocument} doc
 * @param {Record<string, boolean>} folded
 * @param {import('../i18n/index.jsx').Translate} t
 * @returns {TreeRow[]}
 */
function buildRows(doc, folded, t) {
  /** @type {TreeRow[]} */
  const rows = []

  doc.sections.forEach((section, index) => {
    rows.push({
      id: section.id,
      kind: 'section',
      depth: 0,
      label: `${t('inspector.section')} ${index + 1}`,
      branch: (section.rows ?? []).length > 0,
      columnId: null,
    })
    if (folded[section.id]) return

    for (const row of section.rows ?? []) {
      const columns = row.columns ?? []
      rows.push({
        id: row.id,
        kind: 'row',
        depth: 1,
        label: rowLabel(row, columns.length, t),
        branch: columns.length > 0,
        columnId: null,
      })
      if (folded[row.id]) continue

      const single = columns.length === 1
      columns.forEach((column, columnIndex) => {
        if (!single) {
          rows.push({
            id: column.id,
            kind: 'column',
            depth: 2,
            label: `${t('inspector.column')} ${columnIndex + 1}`,
            branch: (column.blocks ?? []).length > 0,
            columnId: null,
          })
        }
        if (!single && folded[column.id]) return

        const depth = single ? 2 : 3
        for (const block of column.blocks ?? []) {
          rows.push({
            id: block.id,
            kind: 'block',
            depth,
            label: blockLabel(block),
            branch: false,
            columnId: null,
          })
        }
        rows.push({
          id: `${column.id}:add`,
          kind: 'column',
          depth,
          label: t('structure.add'),
          branch: false,
          columnId: column.id,
        })
      })
    }
  })

  return rows
}

/**
 * @param {import('../../core/types.js').Row} row
 * @param {number} count
 * @param {import('../i18n/index.jsx').Translate} t
 * @returns {string}
 */
function rowLabel(row, count, t) {
  // `rows.1` … `rows.4` already say "1 column" / "2 columns" in every locale we
  // ship, so the tree borrows them rather than adding a second spelling.
  const columns = count >= 1 && count <= 4 ? t(`rows.${count}`) : `${count}`
  const label = `${t('inspector.row')} · ${columns}`
  const path = row.repeat?.path
  return path ? `${label} · ${t('structure.repeats', { path })}` : label
}

/**
 * A block's own words, where it has any: "Heading — Your order is on its way"
 * beats four rows all reading "Heading".
 *
 * @param {import('../../core/types.js').Block} block
 * @returns {string}
 */
function blockLabel(block) {
  const name = getBlockDef(block.type)?.label ?? block.type
  const summary = blockSummary(block.props ?? {})
  return summary ? `${name} — ${summary}` : name
}

/**
 * @param {Record<string, any>} props
 * @returns {string}
 */
function blockSummary(props) {
  for (const key of SUMMARY_KEYS) {
    const value = props[key]
    if (typeof value !== 'string') continue
    const text = stripTags(value).replace(/\s+/g, ' ').trim()
    if (!text) continue
    return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1)}…` : text
  }
  return ''
}
