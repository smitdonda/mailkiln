/**
 * The content palette: a category rail, and the blocks in the category you are
 * standing in.
 *
 * It used to be one long scroll of grouped tiles, which had two problems worth
 * fixing. Eleven blocks in a three-up grid is taller than the panel, so the last
 * group was cut off before anyone had added anything; and every group ended on a
 * ragged row, because block counts are not multiples of three.
 *
 * A rail solves both by showing one category at a time — and it is the only
 * arrangement that still works for a consumer who registers a dozen custom
 * blocks, which is the case this panel has to survive. Search stays global: a
 * query looks across every category, because somebody typing "video" should not
 * have to know which drawer it lives in.
 *
 * @module mailkiln/react/panels/BlockPalette
 */

import { useMemo, useState } from 'react'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { PaletteDraggable } from '../dnd/PaletteDraggable.jsx'
import { findNode, listColumns } from '../../core/index.js'
import { exhaustedTools } from '../tools.js'
import { BLOCK_ICONS, IconCode, IconImage, IconRows, IconSearch, IconText } from '../icons.jsx'

/**
 * Icons for the group names the built-in blocks use. Anything else — a group a
 * consumer invented — falls back to the icon of the first block in it, which is
 * always more meaningful than a generic placeholder.
 *
 * @type {Record<string, import('../icons.jsx').IconComponent>}
 */
const GROUP_ICONS = {
  content: IconText,
  media: IconImage,
  layout: IconRows,
  advanced: IconCode,
}

/**
 * @returns {import('react').ReactElement}
 */
export function BlockPalette() {
  const t = useI18n()
  const { blocks, store, tools } = useMailKilnContext()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(/** @type {string | null} */ (null))

  const exhausted = useMemo(() => exhaustedTools(store.doc, tools), [store.doc, tools])

  // Categories come from the block definitions, in the order the palette is
  // already sorted into — so a `tools` position still decides which leads.
  const groups = useMemo(() => {
    /** @type {Map<string, import('../../core/types.js').BlockDef[]>} */
    const map = new Map()
    for (const def of blocks) {
      const key = def.group ?? 'Blocks'
      const list = map.get(key)
      if (list) list.push(def)
      else map.set(key, [def])
    }
    return [...map.entries()]
  }, [blocks])

  // A category that stops existing — its last block disabled through `tools` —
  // falls back to the first rather than leaving an empty pane behind.
  const active = groups.some(([name]) => name === picked) ? picked : (groups[0]?.[0] ?? null)

  const needle = query.trim().toLowerCase()
  const searching = needle.length > 0

  const visible = useMemo(() => {
    if (searching) {
      return blocks.filter(
        (def) => def.label.toLowerCase().includes(needle) || def.type.toLowerCase().includes(needle),
      )
    }
    return groups.find(([name]) => name === active)?.[1] ?? []
  }, [blocks, groups, active, needle, searching])

  /**
   * Click / Enter appends to the selected column, or to the last column when
   * nothing is selected. Drag is not the only way in — it can't be, for keyboard
   * and touch users.
   *
   * @param {string} type
   */
  const append = (type) => {
    if (exhausted.has(type)) return
    const columnId = targetColumnId(store)
    if (columnId) store.insertBlock(columnId, { type })
  }

  return (
    <div className="mk-palette">
      <div className="mk-rail" role="group" aria-label={t('palette.categories')}>
        {groups.map(([name, defs]) => {
          const Icon =
            GROUP_ICONS[name.toLowerCase()] ?? BLOCK_ICONS[String(defs[0]?.icon ?? '')] ?? IconCode
          return (
            <button
              key={name}
              type="button"
              className="mk-rail-btn"
              // Nothing reads as selected while a search is running: the results
              // span every category, so claiming one of them is current is a lie.
              aria-pressed={!searching && name === active}
              title={name}
              onClick={() => {
                setPicked(name)
                setQuery('')
              }}
            >
              <Icon />
              <span className="mk-rail-label">{name}</span>
            </button>
          )
        })}
      </div>

      <div className="mk-palette-body">
        <div className="mk-search">
          <div className="mk-search-wrap">
            <IconSearch />
            <input
              className="mk-input"
              type="search"
              value={query}
              placeholder={t('palette.search')}
              aria-label={t('palette.search')}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="mk-empty">
            <IconSearch />
            {t('palette.empty', { query })}
          </p>
        ) : (
          <div className="mk-tiles">
            {visible.map((def) => (
              <PaletteDraggable
                key={def.type}
                def={def}
                disabled={exhausted.has(def.type)}
                disabledReason={t('palette.limit', {
                  limit: String(tools?.[def.type]?.usageLimit ?? ''),
                  label: def.label,
                })}
                onActivate={() => append(def.type)}
              />
            ))}
          </div>
        )}

        <p className="mk-help mk-palette-hint">{t('panel.contentHint')}</p>
      </div>
    </div>
  )
}

/**
 * The column a keyboard-appended block should go into: the selected column, the
 * column holding the selected block, the column the last selection was in, or
 * the last column in the document.
 *
 * The third of those is what makes appending twice into the same column work.
 * Opening the palette requires deselecting — the panel shows the selected node's
 * properties otherwise — so without a remembered column every append after the
 * first would land at the bottom of the document.
 *
 * @param {import('../useMailKiln.js').EditorStore} store
 * @returns {string | null}
 */
export function targetColumnId(store) {
  const { doc, selectedId, focusColumnId } = store
  if (selectedId) {
    const found = findNode(doc, selectedId)
    if (found?.kind === 'column') return found.node.id
    if (found?.kind === 'block') return found.parent.id
    if (found?.kind === 'row') return found.node.columns?.[0]?.id ?? null
    if (found?.kind === 'section') return found.node.rows?.[0]?.columns?.[0]?.id ?? null
  }
  if (focusColumnId && findNode(doc, focusColumnId)?.kind === 'column') return focusColumnId
  const columns = listColumns(doc)
  return columns.length ? columns[columns.length - 1].id : null
}
