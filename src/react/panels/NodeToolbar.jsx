/**
 * The action strip for a selected section, row or column.
 *
 * Blocks had one from the start; structural nodes did not, which left "I added a
 * row I don't want" with no visible way out — the Delete key worked, but nothing
 * on screen said so. It also carries move up/down, because reordering sections
 * was simply not possible in the UI before: `moveSection` existed in core with
 * nothing wired to it.
 *
 * Only the *selected* node shows a strip, and one node is selected at a time, so
 * these can share the top-right corner with the block strip without colliding.
 *
 * @module mailkiln/react/panels/NodeToolbar
 */

import { useI18n } from '../i18n/index.jsx'
import { IconArrowDown, IconArrowUp, IconCopy, IconTrash } from '../icons.jsx'

/**
 * @param {object} props
 * @param {string} props.label Shown in the type-label tab.
 * @param {boolean} [props.canMoveUp]
 * @param {boolean} [props.canMoveDown]
 * @param {() => void} [props.onMoveUp]
 * @param {() => void} [props.onMoveDown]
 * @param {() => void} props.onDuplicate
 * @param {() => void} props.onDelete
 * @returns {import('react').ReactElement}
 */
export function NodeToolbar({
  label,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}) {
  const t = useI18n()

  /**
   * Every action stops propagation: the canvas selects on click, and a bubbling
   * click would re-select the node we just deleted.
   *
   * @param {() => void} [action]
   * @returns {(event: import('react').MouseEvent) => void}
   */
  const run = (action) => (event) => {
    event.preventDefault()
    event.stopPropagation()
    action?.()
  }

  return (
    <>
      <span className="mk-node-label">{label}</span>
      <div className="mk-node-tools" data-orientation="horizontal">
        {onMoveUp ? (
          <button
            type="button"
            className="mk-node-tool"
            disabled={!canMoveUp}
            aria-label={`${t('canvas.moveUp')} ${label}`}
            title={t('canvas.moveUp')}
            onClick={run(onMoveUp)}
          >
            <IconArrowUp />
          </button>
        ) : null}
        {onMoveDown ? (
          <button
            type="button"
            className="mk-node-tool"
            disabled={!canMoveDown}
            aria-label={`${t('canvas.moveDown')} ${label}`}
            title={t('canvas.moveDown')}
            onClick={run(onMoveDown)}
          >
            <IconArrowDown />
          </button>
        ) : null}
        <button
          type="button"
          className="mk-node-tool"
          aria-label={`${t('canvas.duplicate')} ${label}`}
          title={t('canvas.duplicate')}
          onClick={run(onDuplicate)}
        >
          <IconCopy />
        </button>
        <button
          type="button"
          className="mk-node-tool"
          aria-label={`${t('canvas.delete')} ${label}`}
          title={t('canvas.delete')}
          onClick={run(onDelete)}
        >
          <IconTrash />
        </button>
      </div>
    </>
  )
}
