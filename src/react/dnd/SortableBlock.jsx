/**
 * A block on the canvas: sortable, selectable, and — for blocks that declare
 * `inlineEdit` — editable in place.
 *
 * Inline editing targets the element the block marked with `data-mk-edit`, never
 * the rendered block as a whole. The rendered block is a wrapper table around
 * styled markup; making *that* editable and reading its first child's innerHTML
 * back on blur wrote `<tbody><tr><td …>` into the text prop and destroyed the
 * user's copy. Only the block knows which element holds its text, so it says so.
 *
 * The listener placement is the other subtle part. Spreading drag listeners over
 * the whole block makes the body un-selectable for editing; putting them only on
 * a handle makes dragging feel fiddly. So: the whole block drags while it is
 * *not* being edited, and once selected the handle in the action strip takes over.
 *
 * @module mailkiln/react/dnd/SortableBlock
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { getBlockDef, normalizePastedHtml, normalizeRichText } from '../../core/index.js'
import { useI18n } from '../i18n/index.jsx'
import { IconCopy, IconDrag, IconTrash } from '../icons.jsx'
import { exec } from './exec.js'
import { InlineToolbar } from './InlineToolbar.jsx'

/**
 * @param {object} props
 * @param {import('../../core/types.js').Block} props.block
 * @param {string} props.columnId
 * @param {number} props.index
 * @param {string} props.html Rendered HTML for this block.
 * @param {{ label: string, hidden: boolean } | null} [props.condition] Display condition,
 *   resolved against the sample data. Marked, never hidden — see `conditionState`.
 * @param {boolean} props.selected
 * @param {(id: string | null) => void} props.onSelect
 * @param {(id: string) => void} props.onDelete
 * @param {(id: string) => void} props.onDuplicate
 * @param {(id: string, patch: Record<string, any>, tagKey?: string) => void} props.onPatch
 * @returns {import('react').ReactElement}
 */
export function SortableBlock({
  block,
  columnId,
  index,
  html,
  condition,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onPatch,
}) {
  const t = useI18n()
  const def = getBlockDef(block.type)
  const editing = selected && !!def?.inlineEdit
  const bodyRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const [editTarget, setEditTarget] = useState(/** @type {HTMLElement | null} */ (null))

  // Latest props, read by the blur handler without making it a new function on
  // every keystroke (which would detach and re-attach the listener mid-edit).
  const propsRef = useRef(block.props)
  propsRef.current = block.props

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { kind: 'block', blockId: block.id, columnId, index },
    // dnd-kit sets role="button" on the activator, which is the right pattern —
    // but on its own a screen reader just hears "button". The role description
    // makes it "Text, sortable" instead of leaving the user to guess.
    attributes: { roleDescription: `${def?.label ?? block.type}, sortable` },
  })

  // The rendered HTML is written imperatively rather than through
  // `dangerouslySetInnerHTML`, and never while the caret is inside: React
  // re-rendering a contentEditable element resets the caret to the start, so
  // every keystroke would jump the cursor.
  //
  // `domVersion` bumps only when the write actually happens. The editing effect
  // below keys off it rather than off `html`, because a formatting command
  // commits *while the caret is in the element*: keying off `html` would tear
  // the contentEditable attribute off a focused element on every bold, and
  // removing it blurs.
  const [domVersion, setDomVersion] = useState(0)
  useEffect(() => {
    const node = bodyRef.current
    if (!node) return
    if (node.contains(document.activeElement)) return
    if (node.innerHTML !== html) {
      node.innerHTML = html
      setDomVersion((version) => version + 1)
    }
  }, [html])

  const commit = useCallback(
    /** @param {HTMLElement} target */
    (target) => {
      const key = target.getAttribute('data-mk-edit')
      if (!key) return
      // Nothing reaches the document without passing the normalizer. Whatever
      // the browser's contentEditable produced — styled spans, <font>, a Word
      // paste that slipped through — is reduced to the email-safe subset here.
      const next = normalizeRichText(target.innerHTML)
      if (next !== String(propsRef.current?.[key] ?? '')) {
        onPatch(block.id, { [key]: next }, key)
      }
    },
    [block.id, onPatch],
  )

  /** Commit whatever is currently marked editable — used by the toolbar. */
  const commitEdit = useCallback(() => {
    const target = /** @type {HTMLElement | null} */ (
      bodyRef.current?.querySelector('[data-mk-edit]') ?? null
    )
    if (target) commit(target)
  }, [commit])

  // contentEditable is toggled on the marked element imperatively, because that
  // element is created by `innerHTML` above and React does not own it.
  useEffect(() => {
    const target = /** @type {HTMLElement | null} */ (
      bodyRef.current?.querySelector('[data-mk-edit]') ?? null
    )
    if (!target || !editing) {
      setEditTarget(null)
      return undefined
    }

    target.setAttribute('contenteditable', 'true')
    target.style.outline = 'none'
    setEditTarget(target)

    const onBlur = (/** @type {FocusEvent} */ event) => {
      // Focus moving into the toolbar's link popover is not the end of the
      // edit. Committing there would re-render the markup out from under the
      // Range the popover saved.
      const next = /** @type {HTMLElement | null} */ (event.relatedTarget)
      if (next?.closest?.('.mk-inline-toolbar')) return
      commit(target)
    }

    const onKeyDown = (/** @type {KeyboardEvent} */ event) => {
      if (event.key === 'Escape') target.blur()
      // Enter would otherwise wrap the following line in a <div>. Inside a list
      // the browser's own handling is right — that is how you get the next <li>.
      if (event.key === 'Enter' && !event.shiftKey && !inList(target)) {
        event.preventDefault()
        exec(target.ownerDocument, 'insertLineBreak')
      }
      // Typing must not reach the editor's shortcut handler — otherwise "d"
      // duplicates the block and Delete removes it mid-sentence. Ctrl+B/I/U are
      // left to the browser: contentEditable already implements them, and with
      // styleWithCSS off they produce exactly the tags we want.
      event.stopPropagation()
    }

    const onPaste = (/** @type {ClipboardEvent} */ event) => {
      // The single biggest source of junk in an email template is a paste from
      // Word or Google Docs, so it never lands unfiltered.
      event.preventDefault()
      const clipboard = event.clipboardData
      const markup = normalizePastedHtml({
        html: clipboard?.getData('text/html'),
        text: clipboard?.getData('text/plain'),
      })
      if (markup) exec(target.ownerDocument, 'insertHTML', markup)
    }

    target.addEventListener('blur', onBlur)
    target.addEventListener('keydown', onKeyDown)
    target.addEventListener('paste', onPaste)

    return () => {
      // Commit on unmount too: deselecting by deleting or re-rendering the tree
      // otherwise drops the edit silently.
      if (document.activeElement === target) commit(target)
      target.removeEventListener('blur', onBlur)
      target.removeEventListener('keydown', onKeyDown)
      target.removeEventListener('paste', onPaste)
      target.removeAttribute('contenteditable')
    }
  }, [editing, commit, domVersion])

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  }

  const dragProps = editing ? {} : { ...attributes, ...listeners }

  return (
    <div
      ref={setNodeRef}
      className="mk-node"
      style={style}
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      data-conditional={condition ? '' : undefined}
      data-cond-off={condition?.hidden || undefined}
      data-block-id={block.id}
      data-block-type={block.type}
      aria-label={def?.label ?? block.type}
      onClick={(event) => {
        // The rendered block is real email HTML, so it contains real anchors —
        // buttons, image links, the unsubscribe link. Selecting one would
        // otherwise navigate the whole editor away (or open a tab) and lose
        // unsaved work. Caret placement happens on mousedown, so suppressing the
        // click default does not break inline editing.
        event.preventDefault()
        event.stopPropagation()
        onSelect(block.id)
      }}
      {...dragProps}
    >
      {editing && editTarget ? (
        <InlineToolbar target={editTarget} onCommit={commitEdit} />
      ) : null}

      {condition ? (
        <span className="mk-cond-badge" data-off={condition.hidden || undefined} title={condition.label}>
          {condition.label}
        </span>
      ) : null}

      {selected ? (
        <>
          {/* The toolbar takes the top-left slot while editing, so the type
              label steps aside rather than stacking two chips on one corner. */}
          {editing ? null : <span className="mk-node-label">{def?.label ?? block.type}</span>}
          <div className="mk-node-tools">
            {/* The handle is always present while selected, not just while
                editing: once a text block is selected its body becomes
                contentEditable and loses its drag listeners, and a selected
                block you cannot move is a dead end. */}
            <button
              type="button"
              className="mk-node-tool"
              data-handle="true"
              aria-label={t('canvas.drag')}
              title={t('canvas.drag')}
              {...attributes}
              {...listeners}
            >
              <IconDrag />
            </button>
            <button
              type="button"
              className="mk-node-tool"
              aria-label={t('canvas.duplicate')}
              title={t('canvas.duplicate')}
              onClick={(event) => {
                event.stopPropagation()
                onDuplicate(block.id)
              }}
            >
              <IconCopy />
            </button>
            <button
              type="button"
              className="mk-node-tool"
              aria-label={t('canvas.delete')}
              title={t('canvas.delete')}
              onClick={(event) => {
                event.stopPropagation()
                onDelete(block.id)
              }}
            >
              <IconTrash />
            </button>
          </div>
        </>
      ) : null}

      {/* Classed, not bare: the "condition is false" dimming has to target the
          block's content without also dimming the chrome that lets you turn the
          condition back off. */}
      <div className="mk-node-body" ref={bodyRef} />
    </div>
  )
}

/**
 * Is the caret inside a list item?
 *
 * @param {HTMLElement} target
 * @returns {boolean}
 */
function inList(target) {
  const node = target.ownerDocument.getSelection()?.anchorNode
  if (!node || !target.contains(node)) return false
  const element = node.nodeType === 1 ? /** @type {Element} */ (node) : node.parentElement
  return Boolean(element?.closest('li'))
}
