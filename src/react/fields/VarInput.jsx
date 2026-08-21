/**
 * Text input with merge-variable autocomplete.
 *
 * Typing `{{` opens a list of the paths derived from the sample object passed to
 * `defineVars` — the same list the linter checks against and the same one the JSX
 * emitter turns into props. One declaration, four features; this is the part the
 * author actually touches.
 *
 * @module mailkiln/react/fields/VarInput
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'

/** Matches an in-progress `{{partial` immediately before the caret. */
const OPEN_TAG = /\{\{\s*([A-Za-z0-9_$.[\]]*)$/

/**
 * @param {object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {boolean} [props.multiline]
 * @param {string} [props.placeholder]
 * @param {string} [props.id]
 * @param {boolean} [props.vars] Enable autocomplete. Off = a plain input.
 * @returns {import('react').ReactElement}
 */
export function VarInput({ value, onChange, multiline, placeholder, id, vars = true }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const inputRef = useRef(/** @type {any} */ (null))
  const [query, setQuery] = useState(/** @type {string | null} */ (null))
  const [activeIndex, setActiveIndex] = useState(0)

  const matches = useMemo(() => {
    if (query === null) return []
    const needle = query.toLowerCase()
    return (store.vars?.paths ?? [])
      .filter((path) => path.leaf || path.kind === 'array')
      .filter((path) => path.path.toLowerCase().includes(needle))
      .slice(0, 40)
  }, [store.vars, query])

  const open = vars && query !== null && matches.length > 0

  const updateQuery = useCallback(
    /** @param {any} element */
    (element) => {
      if (!vars || !store.vars) {
        setQuery(null)
        return
      }
      const caret = element.selectionStart ?? element.value.length
      const match = OPEN_TAG.exec(element.value.slice(0, caret))
      setQuery(match ? match[1] : null)
      setActiveIndex(0)
    },
    [store.vars, vars],
  )

  const insert = useCallback(
    /** @param {string} path */
    (path) => {
      const element = inputRef.current
      if (!element) return
      const caret = element.selectionStart ?? element.value.length
      const before = element.value.slice(0, caret)
      const after = element.value.slice(caret)
      const match = OPEN_TAG.exec(before)
      if (!match) return
      const head = before.slice(0, match.index)
      // Swallow a `}}` the user (or an editor) already typed, so inserting never
      // produces `{{path}}}}`.
      const tail = after.replace(/^\s*\}\}/, '')
      const next = `${head}{{${path}}}${tail}`
      onChange(next)
      setQuery(null)
      requestAnimationFrame(() => {
        const at = head.length + path.length + 4
        element.setSelectionRange?.(at, at)
        element.focus?.()
      })
    },
    [onChange],
  )

  const handleKeyDown = useCallback(
    /** @param {any} event */
    (event) => {
      if (!open) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % matches.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => (index - 1 + matches.length) % matches.length)
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        insert(matches[activeIndex].path)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setQuery(null)
      }
    },
    [activeIndex, insert, matches, open],
  )

  const shared = {
    id,
    ref: inputRef,
    value: value ?? '',
    placeholder,
    onChange: (/** @type {any} */ event) => {
      onChange(event.target.value)
      updateQuery(event.target)
    },
    onKeyUp: (/** @type {any} */ event) => updateQuery(event.target),
    onClick: (/** @type {any} */ event) => updateQuery(event.target),
    onKeyDown: handleKeyDown,
    onBlur: () => setTimeout(() => setQuery(null), 120),
    'aria-expanded': open || undefined,
    'aria-autocomplete': vars && store.vars ? /** @type {const} */ ('list') : undefined,
  }

  return (
    <div className="mk-var-wrap">
      {multiline ? (
        <textarea className="mk-textarea" rows={4} {...shared} />
      ) : (
        <input className="mk-input" type="text" {...shared} />
      )}
      {open ? (
        <ul className="mk-var-menu" role="listbox" aria-label={t('field.vars')}>
          {matches.map((path, index) => (
            <li
              key={path.path}
              role="option"
              aria-selected={index === activeIndex}
              className="mk-var-item"
              data-active={index === activeIndex || undefined}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => {
                // mousedown, not click: the input's blur would close the menu first.
                event.preventDefault()
                insert(path.path)
              }}
            >
              <span>{path.path}</span>
              <span className="mk-var-sample">{formatSample(path.sample)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * @param {any} sample
 * @returns {string}
 */
function formatSample(sample) {
  if (sample === null || sample === undefined) return ''
  if (Array.isArray(sample)) return `${sample.length} items`
  if (typeof sample === 'object') return '{…}'
  const text = String(sample)
  return text.length > 22 ? `${text.slice(0, 21)}…` : text
}
