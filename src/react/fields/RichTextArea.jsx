/**
 * The rich-text field: a merge-variable textarea with a formatting bar.
 *
 * The canvas has had an inline toolbar for a while, but the property panel
 * offered a bare textarea — so anyone editing copy there had to type `<b>`,
 * `<br />` and `<a href="…">` by hand, which is exactly the markup this package
 * exists to stop people writing. This wraps the selection instead.
 *
 * It stays a textarea on purpose. A second contentEditable surface in the panel
 * would mean two editing models for one prop, and the panel is where people
 * paste variables and long copy — both of which a plain textarea handles better.
 *
 * @module mailkiln/react/fields/RichTextArea
 */

import { useCallback, useRef } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { VarInput } from './VarInput.jsx'
import {
  IconBold,
  IconClearFormat,
  IconItalic,
  IconLink,
  IconListBullet,
  IconUnderline,
} from '../icons.jsx'

/**
 * @param {object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {string} [props.id]
 * @param {boolean} [props.vars]
 * @returns {import('react').ReactElement}
 */
export function RichTextArea({ value, onChange, placeholder, id, vars = true }) {
  const t = useI18n()
  const elementRef = useRef(/** @type {any} */ (null))

  /**
   * Apply a transform to the selected run and put the caret back where the
   * author expects it: around the text they just formatted.
   *
   * @param {(selected: string) => { text: string, caret?: number }} transform
   */
  const apply = useCallback(
    (/** @type {(selected: string) => { text: string, caret?: number }} */ transform) => {
      const element = elementRef.current
      if (!element) return
      const current = String(value ?? '')
      const start = element.selectionStart ?? current.length
      const end = element.selectionEnd ?? start
      const selected = current.slice(start, end)
      const { text, caret } = transform(selected)
      const next = current.slice(0, start) + text + current.slice(end)
      onChange(next)
      const at = start + (caret ?? text.length)
      requestAnimationFrame(() => {
        element.focus?.()
        element.setSelectionRange?.(at, at)
      })
    },
    [onChange, value],
  )

  /** @param {string} tag */
  const wrapTag = (tag) =>
    apply((/** @type {string} */ selected) => ({
      text: `<${tag}>${selected}</${tag}>`,
      // Nothing selected: drop the caret between the tags so typing continues
      // inside the formatting rather than after it.
      caret: selected ? undefined : tag.length + 2,
    }))

  const wrapLink = () =>
    apply((/** @type {string} */ selected) => ({
      text: `<a href="https://">${selected || t('richtext.link')}</a>`,
      caret: '<a href="'.length + 'https://'.length,
    }))

  const bulletList = () =>
    apply((selected) => {
      const lines = (selected || '').split(/\r?\n/).filter((line) => line.trim() !== '')
      const items = (lines.length ? lines : ['']).map((line) => `<li>${line.trim()}</li>`).join('')
      return { text: `<ul>${items}</ul>` }
    })

  const clear = () =>
    apply((/** @type {string} */ selected) => ({ text: selected.replace(/<[^>]+>/g, '') }))

  const buttons = /** @type {const} */ ([
    ['richtext.bold', IconBold, () => wrapTag('b')],
    ['richtext.italic', IconItalic, () => wrapTag('i')],
    ['richtext.underline', IconUnderline, () => wrapTag('u')],
    ['richtext.link', IconLink, wrapLink],
    ['richtext.bulletList', IconListBullet, bulletList],
    ['richtext.clear', IconClearFormat, clear],
  ])

  return (
    <div className="mk-richtext-field">
      <div className="mk-richtext-bar" role="group" aria-label={t('richtext.toolbar')}>
        {buttons.map(([key, Icon, run]) => (
          <button
            key={key}
            type="button"
            className="mk-btn mk-btn-icon mk-btn-sm"
            aria-label={t(key)}
            title={t(key)}
            // Without this the textarea loses focus — and its selection — before
            // the click handler ever runs, so every button would format nothing.
            onMouseDown={(event) => event.preventDefault()}
            onClick={run}
          >
            <Icon />
          </button>
        ))}
      </div>
      <VarInput
        id={id}
        multiline
        value={value}
        placeholder={placeholder}
        vars={vars}
        onChange={onChange}
        onElement={(node) => {
          elementRef.current = node
        }}
      />
    </div>
  )
}
