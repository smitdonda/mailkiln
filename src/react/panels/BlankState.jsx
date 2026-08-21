/**
 * The empty canvas.
 *
 * A blank document previously rendered as an empty dashed column inside an
 * otherwise invisible section — technically correct and completely unhelpful. This
 * gives a new template a starting point instead: one obvious action per common
 * first move.
 *
 * @module mailkiln/react/panels/BlankState
 */

import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { targetColumnId } from './BlockPalette.jsx'
import { IconButton as IconButtonGlyph, IconMail, IconRows, IconText } from '../icons.jsx'

/**
 * True when the document is untouched — no blocks, and no structure the user
 * could have built deliberately.
 *
 * The structure check matters: adding a two-column row leaves a document with
 * zero blocks, and replacing that row with a "start here" screen would throw away
 * work the user just did.
 *
 * @param {import('../../core/types.js').EmailDocument} doc
 * @returns {boolean}
 */
export function isPristine(doc) {
  const sections = doc?.sections ?? []
  if (sections.length > 1) return false
  if (sections.length === 0) return true
  const rows = sections[0].rows ?? []
  if (rows.length > 1) return false
  if (rows.length === 0) return true
  const columns = rows[0].columns ?? []
  if (columns.length > 1) return false
  return (columns[0]?.blocks ?? []).length === 0
}

/**
 * @param {object} props
 * @param {() => void} [props.onQuickInsert] Opens the quick-insert palette.
 * @returns {import('react').ReactElement}
 */
export function BlankState({ onQuickInsert }) {
  const t = useI18n()
  const { store, blocks } = useMailKilnContext()

  // A shortcut to a tool the consumer turned off would be a dead button. The
  // palette is already filtered by `tools`, so asking it is enough.
  const offers = (/** @type {string} */ type) => blocks.some((def) => def.type === type)

  /**
   * Every action stops propagation. The canvas deselects on click, so without
   * this the bubbling click immediately clears the selection the insert just
   * made, and the panel stays on the block list instead of opening the new
   * block's properties.
   *
   * @param {() => void} action
   * @returns {(event: import('react').MouseEvent) => void}
   */
  const run = (action) => (event) => {
    event.stopPropagation()
    action()
  }

  /**
   * @param {string} type
   */
  const add = (type) => {
    const columnId = targetColumnId(store)
    if (columnId) store.insertBlock(columnId, { type })
  }

  return (
    <div className="mk-blank">
      <span className="mk-blank-icon" aria-hidden="true">
        <IconMail />
      </span>
      <h2 className="mk-blank-title">{t('blank.title')}</h2>
      <p className="mk-blank-body">
        {t('blank.body')}{' '}
        {onQuickInsert ? (
          <>
            {t('blank.press')} <kbd className="mk-kbd">/</kbd> {t('blank.toQuickInsert')}
          </>
        ) : null}
      </p>
      <div className="mk-blank-actions">
        <button
          type="button"
          className="mk-btn mk-btn-outline"
          onClick={run(() => store.addRow(store.doc.sections[0]?.id, 2))}
        >
          <IconRows />
          {t('blank.addSection')}
        </button>
        {offers('text') ? (
          <button type="button" className="mk-btn mk-btn-outline" onClick={run(() => add('text'))}>
            <IconText />
            {t('blank.addText')}
          </button>
        ) : null}
        {offers('button') ? (
          <button type="button" className="mk-btn mk-btn-outline" onClick={run(() => add('button'))}>
            <IconButtonGlyph />
            {t('blank.addButton')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
