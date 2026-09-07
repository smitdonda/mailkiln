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
 * A row is three things side by side, and they are deliberately separate: the
 * node's *kind* as a glyph, its *name*, and its own words as dimmed metadata.
 * Welded into one string — "Heading — Your order is on its way" — the pane
 * ellipsises nearly every line, and you read the same four letters fourteen
 * times over. Split, the kind is read before the label, and only the part that
 * can be sacrificed is.
 *
 * The section stubs are rendered whether or not the pane is folded: CSS decides
 * which of the two bodies is on show, so the pane can fold to a rail below
 * 1024px without this component having to know the viewport width.
 *
 * @module mailkiln/react/panels/StructureTree
 */

import { Fragment, useMemo, useState } from 'react'
import { getBlockDef, stripTags } from '../../core/index.js'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import {
  BLOCK_ICONS,
  IconChevronLeft,
  IconChevronRight,
  IconCode,
  IconColumns,
  IconPlus,
  IconRow,
  IconSection,
} from '../icons.jsx'

/** @typedef {import('../../core/types.js').EmailDocument} EmailDocument */
/** @typedef {import('../../core/types.js').LintLevel} LintLevel */
/** @typedef {import('../icons.jsx').IconComponent} IconComponent */

/**
 * One row of the tree. Flat rather than nested: a list of buttons in document
 * order is one tab stop each, which is what both arrow keys and screen readers
 * want out of a tree.
 *
 * @typedef {object} TreeRow
 * @property {string} id
 * @property {'section' | 'row' | 'column' | 'block'} kind
 * @property {number} depth
 * @property {string} name What the node *is*. Never truncated.
 * @property {string} meta Its own words, or its shape. Truncated first.
 * @property {string} repeat The repeat binding, where the node has one.
 * @property {IconComponent} Icon
 * @property {boolean} branch Whether this node has children to fold away.
 * @property {boolean} split Draws a rule above, between one section and the next.
 * @property {string | null} columnId The column an "add" here would fill. Set on
 *   every node that sits in one, so insertion happens where the pointer already
 *   is rather than at a trailing row of its own.
 */

/** Longest a block's own content may run before it is cut with an ellipsis. */
const SUMMARY_MAX = 40

/**
 * Props a block might carry its content in, most specific first. Blocks are
 * third-party-extensible, so this cannot be a lookup by type — but every block
 * that has something worth naming spells it one of these ways.
 */
const SUMMARY_KEYS = ['text', 'label', 'title', 'alt', 'src', 'href']

/**
 * @param {object} props
 * @param {() => void} [props.onQuickInsert] Opens quick insert. The tree selects
 *   the column first, so the block lands where the "add" button said it would.
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
  const stubs = useMemo(() => sectionStubs(rows, levels), [rows, levels])

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

      {/* A rail that is only a way back is 40px of nothing. One stub per section
          — carrying that section's worst issue — keeps it a jump list, so a pane
          folded by hand or by the viewport still earns the width it kept. */}
      <div className="mk-tree-stubs">
        {stubs.map((stub) => (
          <button
            key={stub.id}
            type="button"
            className="mk-tree-stub"
            data-selected={selectedId === stub.id ? 'true' : undefined}
            aria-label={stub.name}
            title={stub.name}
            onClick={() => store.select(stub.id)}
          >
            <IconSection />
            {stub.level ? <span className="mk-tree-dot" data-level={stub.level} /> : null}
          </button>
        ))}
      </div>

      <div className="mk-tree-body">
        {rows.length === 0 ? <p className="mk-tree-empty">{t('structure.empty')}</p> : null}

        {rows.map((row) => (
          <Fragment key={row.id}>
            {row.split ? <div className="mk-tree-split" /> : null}
            <div className="mk-tree-row" data-selected={selectedId === row.id ? 'true' : undefined}>
              <button
                type="button"
                className="mk-tree-node"
                data-kind={row.kind}
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
                {/* Indent is drawn, not padded: a hairline per level makes
                    parentage traceable down a long list, where bare padding
                    leaves a ragged edge and nothing to follow. */}
                {Array.from({ length: row.depth }, (_, level) => (
                  <span key={level} className="mk-tree-rail" />
                ))}
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
                <row.Icon className="mk-tree-type" />
                <span className="mk-tree-label">{row.name}</span>
                {row.meta ? <span className="mk-tree-meta">{row.meta}</span> : null}
                {row.repeat ? <span className="mk-tree-repeat">{row.repeat}</span> : null}
                {levels[row.id] ? (
                  <span className="mk-tree-dot" data-level={levels[row.id]} />
                ) : null}
              </button>

              {/* Insertion follows the pointer. The trailing "Add block" rows
                  this replaces were revealed by a hover anywhere in the body, so
                  all of them lit at once — five blue lines in a three-section
                  document — and each cost a row of height whether or not you
                  wanted it. */}
              {row.columnId ? (
                <button
                  type="button"
                  className="mk-tree-add"
                  aria-label={t('structure.addTo', { name: row.name })}
                  title={t('structure.add')}
                  onClick={() => {
                    // Select the column first: quick insert appends to the
                    // current selection, so this is what makes "add here" mean
                    // here.
                    store.select(/** @type {string} */ (row.columnId))
                    onQuickInsert?.()
                  }}
                >
                  <IconPlus />
                </button>
              ) : null}
            </div>
          </Fragment>
        ))}
      </div>

      {/* Always present. Appearing only once a rule fired moved every row in the
          list at the moment you were reading one. */}
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
        {lint.errors + lint.warnings === 0 ? (
          <span className="mk-tree-clean">{t('structure.clean')}</span>
        ) : null}
        <span className="mk-tree-total">{t('structure.nodes', { count: rows.length })}</span>
      </div>
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
 * The sections, each carrying the worst level found anywhere beneath it, for
 * the folded rail. The flat row list makes this a forward scan: a section owns
 * every row until the next one at depth 0.
 *
 * @param {TreeRow[]} rows
 * @param {Record<string, LintLevel>} levels
 * @returns {Array<{ id: string, name: string, level: LintLevel | null }>}
 */
function sectionStubs(rows, levels) {
  /** @type {Array<{ id: string, name: string, level: LintLevel | null }>} */
  const stubs = []
  for (const row of rows) {
    if (row.depth === 0) stubs.push({ id: row.id, name: row.name, level: levels[row.id] ?? null })
    const current = stubs[stubs.length - 1]
    if (!current || current.level === 'error') continue
    const level = levels[row.id]
    if (level) current.level = level
  }
  return stubs
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
      name: `${t('inspector.section')} ${index + 1}`,
      meta: '',
      repeat: '',
      Icon: IconSection,
      branch: (section.rows ?? []).length > 0,
      split: index > 0,
      columnId: null,
    })
    if (folded[section.id]) return

    for (const row of section.rows ?? []) {
      const columns = row.columns ?? []
      const single = columns.length === 1
      rows.push({
        id: row.id,
        kind: 'row',
        depth: 1,
        name: t('inspector.row'),
        // `rows.1` … `rows.4` already say "1 column" / "2 columns" in every
        // locale we ship, so the tree borrows them rather than adding a second
        // spelling.
        meta: columns.length >= 1 && columns.length <= 4 ? t(`rows.${columns.length}`) : '',
        repeat: row.repeat?.path ? t('structure.repeats', { path: row.repeat.path }) : '',
        Icon: IconRow,
        branch: columns.length > 0,
        split: false,
        // A single-column row *is* its column here, so it is also where a block
        // added at this line would go — including when that column is empty and
        // has no line of its own to carry the button.
        columnId: single ? (columns[0]?.id ?? null) : null,
      })
      if (folded[row.id]) continue

      columns.forEach((column, columnIndex) => {
        if (!single) {
          rows.push({
            id: column.id,
            kind: 'column',
            depth: 2,
            name: `${t('inspector.column')} ${columnIndex + 1}`,
            meta: '',
            repeat: '',
            Icon: IconColumns,
            branch: (column.blocks ?? []).length > 0,
            split: false,
            columnId: column.id,
          })
        }
        if (!single && folded[column.id]) return

        const depth = single ? 2 : 3
        for (const block of column.blocks ?? []) {
          const def = getBlockDef(block.type)
          rows.push({
            id: block.id,
            kind: 'block',
            depth,
            name: def?.label ?? block.type,
            meta: blockSummary(block.props ?? {}),
            repeat: '',
            Icon: BLOCK_ICONS[String(def?.icon ?? '')] ?? IconCode,
            branch: false,
            split: false,
            columnId: column.id,
          })
        }
      })
    }
  })

  return rows
}

/**
 * A block's own words, where it has any: "Your order is on its way" beside a
 * Heading beats four rows all reading "Heading".
 *
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
