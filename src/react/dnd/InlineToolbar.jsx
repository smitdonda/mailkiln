/**
 * The formatting bar that floats over a block while its text is being edited.
 *
 * Bold, italic, underline, link, lists, clear formatting — issued through
 * `document.execCommand`. That API is deprecated but universally implemented,
 * and every alternative (Slate, ProseMirror, Lexical) is larger than the whole
 * of mailforge and would blow the two-runtime-dependency budget. The risk is
 * contained on purpose: commands are issued from this one file, and
 * `normalizeRichText` runs on every commit, so we only depend on the browser
 * producing *something* reasonable — never something exact.
 *
 * Two details do most of the work:
 *
 *   - Every button suppresses `mousedown`. Without it the button takes focus,
 *     the editable element blurs, and the selection the command was meant to
 *     act on is gone before the click fires.
 *   - The link popover cannot avoid taking focus, so it stores the `Range`
 *     first and restores it before running the command.
 *
 * @module mailforge/react/dnd/InlineToolbar
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { escapeAttr, escapeHtml } from '../../core/index.js'
import { VarInput } from '../fields/VarInput.jsx'
import { useI18n } from '../i18n/index.jsx'
import { exec, queryState } from './exec.js'
import {
  IconBold,
  IconClearFormat,
  IconItalic,
  IconLink,
  IconListBullet,
  IconListNumber,
  IconUnderline,
  IconUnlink,
} from '../icons.jsx'

/** Commands whose pressed state the toolbar reflects. */
const STATES = /** @type {const} */ ([
  'bold',
  'italic',
  'underline',
  'insertUnorderedList',
  'insertOrderedList',
])

/**
 * A list inside an `<h2>` is invalid HTML, so the list buttons are hidden on
 * headings. A UI rule, not a schema one — no change to the `BlockDef` API.
 *
 * @param {HTMLElement | null} target
 * @returns {boolean}
 */
function allowsLists(target) {
  return !/^H[1-6]$/.test(target?.tagName ?? '')
}

/**
 * The anchor the caret currently sits in, if any.
 *
 * @param {HTMLElement} target
 * @returns {HTMLAnchorElement | null}
 */
function anchorAtCaret(target) {
  const selection = target.ownerDocument.getSelection()
  const node = selection?.anchorNode
  if (!node || !target.contains(node)) return null
  const element = node.nodeType === 1 ? /** @type {Element} */ (node) : node.parentElement
  return /** @type {HTMLAnchorElement | null} */ (element?.closest('a') ?? null)
}

/**
 * @param {object} props
 * @param {HTMLElement} props.target The element carrying `data-mf-edit`.
 * @param {() => void} props.onCommit Write the edited markup back to the document.
 * @returns {import('react').ReactElement}
 */
export function InlineToolbar({ target, onCommit }) {
  const t = useI18n()
  const [active, setActive] = useState(/** @type {Record<string, boolean>} */ ({}))
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkHref, setLinkHref] = useState('')
  const [linkText, setLinkText] = useState('')
  const savedRange = useRef(/** @type {Range | null} */ (null))
  const existingAnchor = useRef(/** @type {HTMLAnchorElement | null} */ (null))

  const refresh = useCallback(() => {
    const doc = target.ownerDocument
    const selection = doc.getSelection()
    if (!selection?.anchorNode || !target.contains(selection.anchorNode)) return
    /** @type {Record<string, boolean>} */
    const next = {}
    for (const command of STATES) next[command] = queryState(doc, command)
    next.link = anchorAtCaret(target) !== null
    setActive(next)
  }, [target])

  useEffect(() => {
    const doc = target.ownerDocument
    // execCommand emits `<span style="font-weight:700">` unless told otherwise;
    // with styleWithCSS off it emits `<b>`, which is what email wants and what
    // the normalizer would otherwise have to reconstruct.
    exec(doc, 'styleWithCSS', 'false')
    exec(doc, 'defaultParagraphSeparator', 'br')
    doc.addEventListener('selectionchange', refresh)
    target.addEventListener('keyup', refresh)
    refresh()
    return () => {
      doc.removeEventListener('selectionchange', refresh)
      target.removeEventListener('keyup', refresh)
    }
  }, [target, refresh])

  const run = useCallback(
    /**
     * @param {string} command
     * @param {string} [value]
     */
    (command, value) => {
      target.focus()
      exec(target.ownerDocument, command, value)
      refresh()
      onCommit()
    },
    [onCommit, refresh, target],
  )

  const openLink = useCallback(() => {
    const selection = target.ownerDocument.getSelection()
    const range =
      selection && selection.rangeCount > 0 && target.contains(selection.anchorNode)
        ? selection.getRangeAt(0).cloneRange()
        : null
    savedRange.current = range
    const anchor = anchorAtCaret(target)
    existingAnchor.current = anchor
    setLinkHref(anchor?.getAttribute('href') ?? '')
    setLinkText(anchor?.textContent ?? range?.toString() ?? '')
    setLinkOpen(true)
  }, [target])

  /** Put the caret back where it was before the popover stole focus. */
  const restoreSelection = useCallback(
    /** @param {Range | null} range */
    (range) => {
      target.focus()
      if (!range) return
      const selection = target.ownerDocument.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    },
    [target],
  )

  const applyLink = useCallback(() => {
    const href = linkHref.trim()
    if (!href) return
    const anchor = existingAnchor.current
    const doc = target.ownerDocument

    if (anchor) {
      // Editing an existing link: set the attribute directly rather than
      // unlink-then-createLink, which loses any formatting inside it.
      anchor.setAttribute('href', href)
      if (linkText.trim() && linkText !== anchor.textContent) anchor.textContent = linkText
    } else {
      const range = savedRange.current
      restoreSelection(range)
      if (!range || range.collapsed) {
        // No selection to wrap, so the link brings its own text. Defaulting to
        // the href keeps `{{unsubscribe_url}}` from inserting an invisible link.
        const label = escapeHtml(linkText.trim() || href)
        exec(doc, 'insertHTML', `<a href="${escapeAttr(href)}">${label}</a>`)
      } else {
        exec(doc, 'createLink', href)
      }
    }

    setLinkOpen(false)
    savedRange.current = null
    existingAnchor.current = null
    refresh()
    onCommit()
  }, [linkHref, linkText, onCommit, refresh, restoreSelection, target])

  const removeLink = useCallback(() => {
    const anchor = existingAnchor.current
    if (anchor) {
      const range = target.ownerDocument.createRange()
      range.selectNodeContents(anchor)
      restoreSelection(range)
      exec(target.ownerDocument, 'unlink')
    }
    setLinkOpen(false)
    existingAnchor.current = null
    savedRange.current = null
    refresh()
    onCommit()
  }, [onCommit, refresh, restoreSelection, target])

  /**
   * @param {object} config
   * @param {string} config.command
   * @param {string} config.label
   * @param {import('react').ReactElement} config.children
   * @returns {import('react').ReactElement}
   */
  const button = ({ command, label, children }) => (
    <button
      type="button"
      className="mf-rt-button"
      data-active={active[command] || undefined}
      aria-label={label}
      aria-pressed={Boolean(active[command])}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        run(command)
      }}
    >
      {children}
    </button>
  )

  return (
    <div
      className="mf-inline-toolbar"
      role="toolbar"
      aria-label={t('richtext.toolbar')}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {button({ command: 'bold', label: t('richtext.bold'), children: <IconBold /> })}
      {button({ command: 'italic', label: t('richtext.italic'), children: <IconItalic /> })}
      {button({ command: 'underline', label: t('richtext.underline'), children: <IconUnderline /> })}

      <span className="mf-rt-sep" />

      <button
        type="button"
        className="mf-rt-button"
        data-active={active.link || undefined}
        aria-label={t('richtext.link')}
        aria-expanded={linkOpen}
        title={t('richtext.link')}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (linkOpen) setLinkOpen(false)
          else openLink()
        }}
      >
        <IconLink />
      </button>

      {allowsLists(target) ? (
        <>
          {button({
            command: 'insertUnorderedList',
            label: t('richtext.bulletList'),
            children: <IconListBullet />,
          })}
          {button({
            command: 'insertOrderedList',
            label: t('richtext.numberList'),
            children: <IconListNumber />,
          })}
        </>
      ) : null}

      <span className="mf-rt-sep" />

      {button({
        command: 'removeFormat',
        label: t('richtext.clear'),
        children: <IconClearFormat />,
      })}

      {linkOpen ? (
        <div className="mf-rt-popover">
          <label className="mf-rt-field">
            <span className="mf-label">{t('richtext.linkUrl')}</span>
            <VarInput
              value={linkHref}
              onChange={setLinkHref}
              placeholder="https://example.com"
            />
          </label>
          <label className="mf-rt-field">
            <span className="mf-label">{t('richtext.linkText')}</span>
            <VarInput value={linkText} onChange={setLinkText} placeholder={t('richtext.linkText')} />
          </label>
          <div className="mf-rt-popover-actions">
            {existingAnchor.current ? (
              <button type="button" className="mf-btn mf-btn-sm" onClick={removeLink}>
                <IconUnlink />
                {t('richtext.unlink')}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="mf-btn mf-btn-sm mf-btn-primary"
              onClick={applyLink}
            >
              {t('richtext.apply')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
