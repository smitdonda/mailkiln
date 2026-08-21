/**
 * The content palette: a grid of block tiles, grouped and searchable.
 *
 * Tiles rather than a list because that is what people recognise from every
 * other builder, and because an icon + short label is faster to scan than a row
 * of text when you already know what you want.
 *
 * @module mailkiln/react/panels/BlockPalette
 */

import { useMemo, useState } from 'react'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { PaletteDraggable } from '../dnd/PaletteDraggable.jsx'
import { findNode, listColumns } from '../../core/index.js'
import { exhaustedTools } from '../tools.js'
import { IconSearch } from '../icons.jsx'

/**
 * @returns {import('react').ReactElement}
 */
export function BlockPalette() {
  const t = useI18n()
  const { blocks, store, tools } = useMailKilnContext()
  const [query, setQuery] = useState('')

  const exhausted = useMemo(() => exhaustedTools(store.doc, tools), [store.doc, tools])

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? blocks.filter(
          (def) =>
            def.label.toLowerCase().includes(needle) || def.type.toLowerCase().includes(needle),
        )
      : blocks
    /** @type {Map<string, import('../../core/types.js').BlockDef[]>} */
    const map = new Map()
    for (const def of filtered) {
      const key = def.group ?? 'Blocks'
      const list = map.get(key)
      if (list) list.push(def)
      else map.set(key, [def])
    }
    return [...map.entries()]
  }, [blocks, query])

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
    <>
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

      {groups.length === 0 ? (
        <p className="mk-empty">
          <IconSearch />
          {t('palette.empty', { query })}
        </p>
      ) : (
        groups.map(([group, defs]) => (
          <div key={group}>
            <div className="mk-section-label">{group}</div>
            <div className="mk-tiles">
              {defs.map((def) => (
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
          </div>
        ))
      )}

      <p className="mk-help" style={{ padding: '0 14px 16px' }}>
        {t('panel.contentHint')}
      </p>
    </>
  )
}

/**
 * The column a keyboard-appended block should go into: the selected column, the
 * column holding the selected block, or the last column in the document.
 *
 * @param {import('../useMailKiln.js').EditorStore} store
 * @returns {string | null}
 */
export function targetColumnId(store) {
  const { doc, selectedId } = store
  if (selectedId) {
    const found = findNode(doc, selectedId)
    if (found?.kind === 'column') return found.node.id
    if (found?.kind === 'block') return found.parent.id
    if (found?.kind === 'row') return found.node.columns?.[0]?.id ?? null
    if (found?.kind === 'section') return found.node.rows?.[0]?.columns?.[0]?.id ?? null
  }
  const columns = listColumns(doc)
  return columns.length ? columns[columns.length - 1].id : null
}
