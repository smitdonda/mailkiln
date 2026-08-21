/**
 * The "Visibility" group: a display condition on any node, plus a repeat on rows.
 *
 * Deliberately three controls and not an expression box. A free-text expression
 * would need a parser, a sandbox, and a story for what happens when it cannot be
 * turned into JSX — and the whole point of this feature is that it *becomes* JSX.
 * Path + operator + value is the largest shape that survives that trip.
 *
 * @module mailkiln/react/panels/VisibilityFields
 */

import { useId } from 'react'
import { CONDITION_OPS, evaluateCondition, normalizeCondition } from '../../core/index.js'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { VarInput } from '../fields/VarInput.jsx'

/** Operator order in the dropdown: the common two first. */
const OP_ORDER = ['truthy', 'falsy', 'notEmpty', 'empty', 'eq', 'ne', 'gt', 'lt']

/**
 * @param {object} props
 * @param {import('../../core/types.js').Section | import('../../core/types.js').Row
 *   | import('../../core/types.js').Block} props.node
 * @returns {import('react').ReactElement}
 */
export function VisibilityFields({ node }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const id = useId()
  const condition = node.showIf ?? null
  const on = Boolean(condition)

  /** @param {Partial<import('../../core/types.js').Condition>} patch */
  const update = (patch) => {
    const next = { path: '', op: 'truthy', ...condition, ...patch }
    // Written straight through, valid or not: a half-typed condition has to stay
    // on screen while you finish typing it. The renderers treat an incomplete
    // condition as "always show", so nothing disappears in the meantime.
    store.setCondition(node.id, /** @type {any} */ (next))
  }

  const op = String(condition?.op ?? 'truthy')
  const needsValue = CONDITION_OPS[op]?.needsValue ?? false
  const complete = normalizeCondition(condition) !== null
  const matches = complete && evaluateCondition(condition, store.vars?.sample ?? {})

  return (
    <div className="mk-fields">
      <div className="mk-field mk-field-row">
        <span className="mk-label" id={`${node.id}-showif`}>
          {t('visibility.conditional')}
        </span>
        <button
          type="button"
          className="mk-toggle"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${node.id}-showif`}
          onClick={() => store.setCondition(node.id, on ? null : { path: '', op: 'truthy' })}
        />
      </div>

      {on ? (
        <>
          <div className="mk-field">
            <label className="mk-label" htmlFor={`${id}-path`}>
              {t('visibility.showWhen')}
            </label>
            <VarInput
              id={`${id}-path`}
              value={String(condition?.path ?? '')}
              placeholder="user.isPro"
              onChange={(path) => update({ path })}
            />
          </div>

          <div className="mk-field">
            <label className="mk-label" htmlFor={`${id}-op`}>
              {t('visibility.operator')}
            </label>
            <select
              id={`${id}-op`}
              className="mk-select"
              value={op}
              onChange={(event) => update({ op: /** @type {any} */ (event.target.value) })}
            >
              {OP_ORDER.map((key) => (
                <option key={key} value={key}>
                  {t(`visibility.op.${key}`)}
                </option>
              ))}
            </select>
          </div>

          {needsValue ? (
            <div className="mk-field">
              <label className="mk-label" htmlFor={`${id}-value`}>
                {t('visibility.value')}
              </label>
              <input
                id={`${id}-value`}
                className="mk-input"
                type="text"
                value={String(condition?.value ?? '')}
                onChange={(event) => update({ value: event.target.value })}
              />
            </div>
          ) : null}

          {/* Which way the branch falls for *your* sample data. Without it you
              are guessing whether the condition you just wrote is the one you
              meant, and the canvas deliberately shows conditional nodes either
              way. */}
          <p className="mk-help">
            {complete
              ? matches
                ? t('visibility.previewShown')
                : t('visibility.previewHidden')
              : t('visibility.previewIncomplete')}
          </p>
        </>
      ) : null}
    </div>
  )
}

/**
 * The repeat controls. Rows only — see `setRepeat` in core for why.
 *
 * @param {object} props
 * @param {import('../../core/types.js').Row} props.row
 * @returns {import('react').ReactElement}
 */
export function RepeatFields({ row }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const id = useId()
  const repeat = row.repeat ?? null
  const on = Boolean(repeat)

  /** @param {Partial<import('../../core/types.js').Repeat>} patch */
  const update = (patch) => {
    store.setRepeat(row.id, /** @type {any} */ ({ path: '', as: 'item', ...repeat, ...patch }))
  }

  const sample = store.vars?.sample
  const items = repeat?.path ? readPath(sample, repeat.path) : undefined
  const count = Array.isArray(items) ? items.length : null

  return (
    <div className="mk-fields">
      <div className="mk-field mk-field-row">
        <span className="mk-label" id={`${row.id}-repeat`}>
          {t('visibility.repeat')}
        </span>
        <button
          type="button"
          className="mk-toggle"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${row.id}-repeat`}
          onClick={() => store.setRepeat(row.id, on ? null : { path: '', as: 'item' })}
        />
      </div>

      {on ? (
        <>
          <div className="mk-field">
            <label className="mk-label" htmlFor={`${id}-path`}>
              {t('visibility.repeatOver')}
            </label>
            <VarInput
              id={`${id}-path`}
              value={String(repeat?.path ?? '')}
              placeholder="order.items"
              onChange={(path) => update({ path })}
            />
          </div>
          <div className="mk-field">
            <label className="mk-label" htmlFor={`${id}-as`}>
              {t('visibility.repeatAs')}
            </label>
            <input
              id={`${id}-as`}
              className="mk-input"
              type="text"
              value={String(repeat?.as ?? '')}
              onChange={(event) => update({ as: event.target.value })}
            />
            <span className="mk-help">
              {t('visibility.repeatHint', { as: String(repeat?.as || 'item') })}
            </span>
          </div>
          <p className="mk-help">
            {count === null
              ? t('visibility.repeatNoArray')
              : t('visibility.repeatCount', { count: String(count) })}
          </p>
        </>
      ) : null}
    </div>
  )
}

/**
 * Local copy of `getPath` — importing it would drag a core internal into a panel
 * for one lookup.
 *
 * @param {any} obj
 * @param {string} path
 * @returns {any}
 */
function readPath(obj, path) {
  return String(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .reduce((cursor, part) => (cursor == null ? cursor : cursor[part]), obj)
}
