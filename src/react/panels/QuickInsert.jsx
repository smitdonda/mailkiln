/**
 * Quick insert: press `/` anywhere on the canvas to search and insert a block.
 *
 * This exists because the empty state advertises it. A UI that tells you to press
 * a key that does nothing is worse than one that says nothing, so the hint and
 * the feature ship together.
 *
 * @module mailkiln/react/panels/QuickInsert
 */

import { useMemo, useRef, useState } from 'react'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { targetColumnId } from './BlockPalette.jsx'
import { exhaustedTools } from '../tools.js'
import { BLOCK_ICONS, IconCode, IconSearch } from '../icons.jsx'

/**
 * @param {object} props
 * @param {() => void} props.onClose
 * @returns {import('react').ReactElement}
 */
export function QuickInsert({ onClose }) {
  const t = useI18n()
  const { blocks, store, tools } = useMailKilnContext()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null))

  const matches = useMemo(() => {
    // A tool at its usage limit is dropped rather than greyed out here: this list
    // is arrow-key driven, and a dead entry you can land on is worse than one
    // that isn't there. The palette, where you can hover for the reason, greys.
    const exhausted = exhaustedTools(store.doc, tools)
    const available = blocks.filter((def) => !exhausted.has(def.type))
    const needle = query.trim().toLowerCase()
    if (!needle) return available
    return available.filter(
      (def) => def.label.toLowerCase().includes(needle) || def.type.toLowerCase().includes(needle),
    )
  }, [blocks, query, store.doc, tools])

  /**
   * @param {import('../../core/types.js').BlockDef} [def]
   */
  const insert = (def) => {
    if (!def) return
    const columnId = targetColumnId(store)
    if (columnId) store.insertBlock(columnId, { type: def.type })
    onClose()
  }

  /**
   * @param {import('react').KeyboardEvent} event
   */
  const onKeyDown = (event) => {
    // Contained here rather than on the root: while this is open it owns the
    // arrow keys, and the editor's own shortcuts must not also fire.
    event.stopPropagation()
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (matches.length ? (index + 1) % matches.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (matches.length ? (index - 1 + matches.length) % matches.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      insert(matches[activeIndex])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="mk-overlay mk-overlay-top" role="presentation" onClick={onClose}>
      <div
        className="mk-quick"
        role="dialog"
        aria-modal="true"
        aria-label={t('quick.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mk-quick-search">
          <IconSearch />
          <input
            ref={inputRef}
            className="mk-input"
            type="text"
            autoFocus
            value={query}
            placeholder={t('quick.placeholder')}
            aria-label={t('quick.placeholder')}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onKeyDown}
          />
        </div>

        {matches.length === 0 ? (
          <p className="mk-empty">{t('quick.empty', { query })}</p>
        ) : (
          <ul className="mk-quick-list" role="listbox" aria-label={t('quick.title')}>
            {matches.map((def, index) => {
              const Icon = BLOCK_ICONS[String(def.icon ?? '')] ?? IconCode
              return (
                <li
                  key={def.type}
                  role="option"
                  aria-selected={index === activeIndex}
                  className="mk-quick-item"
                  data-active={index === activeIndex || undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    insert(def)
                  }}
                >
                  <span className="mk-quick-icon">
                    <Icon />
                  </span>
                  <span className="mk-quick-label">{def.label}</span>
                  <span className="mk-quick-group">{def.group}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
