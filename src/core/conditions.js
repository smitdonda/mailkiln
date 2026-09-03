/**
 * Display conditions — show a section, row or block only when the data says so.
 *
 * Unlayer solves this by baking the ESP's own template syntax into the exported
 * HTML (`{% if user.isPro %}`), which welds the output to one platform. We can do
 * better, because pillar 1 means the export is *code*: a condition becomes a real
 * JSX expression, and the same condition drives the preview against your sample
 * data. One declaration, two honest outputs — no template language in the middle.
 *
 * The shape is deliberately tiny. A condition is a path, an operator and
 * (sometimes) a value:
 *
 *     { path: 'user.isPro', op: 'truthy' }
 *     { path: 'order.total', op: 'gt', value: 100 }
 *     { path: 'order.items', op: 'notEmpty' }
 *
 * A full expression language would need a parser, a sandbox and an editor UI
 * nobody would enjoy, and it would still not survive being emitted as JSX.
 *
 * @module mailkiln/core/conditions
 */

import { getPath, optionalChain } from './vars.js'

/** @typedef {import('./types.js').Condition} Condition */

/**
 * Operators, with the JSX each one emits.
 *
 * `empty` / `notEmpty` are not redundant with `falsy` / `truthy`: an empty array
 * is truthy in JavaScript, so "show this when the cart has items" written as
 * `truthy` would render the section for an empty cart. That bug is subtle enough
 * to be worth its own operator.
 *
 * @type {Record<string, { needsValue: boolean, label: string }>}
 */
export const CONDITION_OPS = {
  truthy: { needsValue: false, label: 'is set' },
  falsy: { needsValue: false, label: 'is not set' },
  notEmpty: { needsValue: false, label: 'is not empty' },
  empty: { needsValue: false, label: 'is empty' },
  eq: { needsValue: true, label: 'equals' },
  ne: { needsValue: true, label: 'does not equal' },
  gt: { needsValue: true, label: 'is greater than' },
  lt: { needsValue: true, label: 'is less than' },
}

/**
 * Turn whatever the Inspector produced into a comparable value.
 *
 * Text inputs hand back strings, so `order.total > "100"` would be a string
 * comparison in the preview and a numeric one in the exported code. Coercing
 * once, here, is what keeps the two agreeing.
 *
 * @param {unknown} value
 * @returns {string | number | boolean}
 */
export function coerceValue(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return value
  const text = String(value ?? '').trim()
  if (text === 'true') return true
  if (text === 'false') return false
  if (text !== '' && Number.isFinite(Number(text))) return Number(text)
  return text
}

/**
 * A usable condition, or `null`.
 *
 * Half-filled conditions are normal while someone is typing one, and a condition
 * with no path must not start hiding things.
 *
 * @param {any} condition
 * @returns {Condition | null}
 */
export function normalizeCondition(condition) {
  if (!condition || typeof condition !== 'object') return null
  const path = String(condition.path ?? '').trim()
  const op = String(condition.op ?? 'truthy')
  if (!path || !CONDITION_OPS[op]) return null
  return CONDITION_OPS[op].needsValue
    ? { path, op: /** @type {Condition['op']} */ (op), value: coerceValue(condition.value) }
    : { path, op: /** @type {Condition['op']} */ (op) }
}

/**
 * A condition as the *editor* stores it — shape-checked, but allowed to be
 * incomplete.
 *
 * `normalizeCondition` rejects an empty path, which is right for every reader:
 * a half-typed condition must not hide anything. But it makes the thing
 * unstorable, and the Inspector has to store one the moment you flip the
 * "Show conditionally" switch — before you have typed a path. So writes keep the
 * draft and readers keep refusing it. `normalize(doc)` drops any draft that is
 * still incomplete, so nothing junk survives a save/load round trip.
 *
 * @param {any} condition
 * @returns {import('./types.js').Condition | null}
 */
export function conditionDraft(condition) {
  if (!condition || typeof condition !== 'object') return null
  const op = CONDITION_OPS[condition.op] ? condition.op : 'truthy'
  /** @type {any} */
  const draft = { path: String(condition.path ?? ''), op }
  if (CONDITION_OPS[op].needsValue) draft.value = coerceValue(condition.value)
  return draft
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmpty(value) {
  if (value === null || value === undefined) return true
  if (Array.isArray(value) || typeof value === 'string') return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Should the node render, given this data?
 *
 * An absent or malformed condition means "always" — the safe direction. A
 * condition someone half-typed should never silently delete a section from an
 * email that is about to go out.
 *
 * @param {any} condition
 * @param {Record<string, any> | null | undefined} scope Sample data (or a repeat scope).
 * @returns {boolean}
 */
export function evaluateCondition(condition, scope) {
  const normalized = normalizeCondition(condition)
  if (!normalized) return true
  const actual = getPath(scope ?? {}, normalized.path)

  switch (normalized.op) {
    case 'falsy':
      return !actual
    case 'notEmpty':
      return !isEmpty(actual)
    case 'empty':
      return isEmpty(actual)
    case 'eq':
      return coerceValue(actual) === normalized.value
    case 'ne':
      return coerceValue(actual) !== normalized.value
    case 'gt':
      return Number(actual) > Number(normalized.value)
    case 'lt':
      return Number(actual) < Number(normalized.value)
    default:
      return Boolean(actual)
  }
}

/**
 * The condition as a JSX expression, for the ejected component.
 *
 * @param {any} condition
 * @returns {string} '' when there is nothing to emit
 */
export function conditionExpression(condition) {
  const normalized = normalizeCondition(condition)
  if (!normalized) return ''
  const { op, value } = normalized
  // Optional-chained, so a condition on data that never arrived decides the
  // branch instead of throwing. The results line up with `evaluateCondition`:
  // absent reads as empty, and as not-notEmpty.
  const path = optionalChain(normalized.path)
  const literal = JSON.stringify(value)

  switch (op) {
    case 'falsy':
      return `!${path}`
    case 'notEmpty':
      return `${path}?.length > 0`
    case 'empty':
      return `!${path}?.length`
    case 'eq':
      return `${path} === ${literal}`
    case 'ne':
      return `${path} !== ${literal}`
    case 'gt':
      return `${path} > ${literal}`
    case 'lt':
      return `${path} < ${literal}`
    default:
      return path
  }
}

/**
 * A short human label for the canvas badge. Locale-free by design — core has no
 * i18n, and the operator words are the same ones the Inspector shows.
 *
 * @param {any} condition
 * @returns {string} '' when there is no condition
 */
export function conditionSummary(condition) {
  const normalized = normalizeCondition(condition)
  if (!normalized) return ''
  const { path, op, value } = normalized
  const { needsValue, label } = CONDITION_OPS[op]
  return needsValue ? `${path} ${label} ${value}` : `${path} ${label}`
}

/**
 * Every merge path a condition depends on. Feeds `documentVarPaths`, so a path
 * used only in a condition still becomes a prop on the exported component and is
 * still checked by the unknown-variable rule.
 *
 * @param {any} condition
 * @returns {string[]}
 */
export function conditionPaths(condition) {
  const normalized = normalizeCondition(condition)
  return normalized ? [normalized.path] : []
}

// ---------------------------------------------------------------------------
// repeat
// ---------------------------------------------------------------------------

/** @typedef {import('./types.js').Repeat} Repeat */

/** How many iterations the canvas and the HTML preview show by default. */
export const DEFAULT_PREVIEW_COUNT = 3

/** A loop variable has to be a plain identifier — it becomes one in the export. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/**
 * A usable repeat, or `null`.
 *
 * @param {any} repeat
 * @returns {Repeat | null}
 */
export function normalizeRepeat(repeat) {
  const draft = repeatDraft(repeat)
  if (!draft) return null
  return draft.path && IDENTIFIER.test(draft.as) ? draft : null
}

/**
 * A repeat as the editor stores it — see {@link conditionDraft} for why writes
 * and reads disagree on purpose.
 *
 * @param {any} repeat
 * @returns {Repeat | null}
 */
export function repeatDraft(repeat) {
  if (!repeat || typeof repeat !== 'object') return null
  const count = Number(repeat.previewCount)
  return {
    path: String(repeat.path ?? '').trim(),
    as: String(repeat.as ?? '').trim(),
    previewCount:
      Number.isFinite(count) && count > 0 ? Math.min(20, Math.round(count)) : DEFAULT_PREVIEW_COUNT,
  }
}

/**
 * The scopes a repeated row renders with — one per iteration.
 *
 * The loop variable is layered *over* the outer scope rather than replacing it,
 * so `{{item.title}}` and `{{user.name}}` both work inside the same row. Shadowing
 * an outer name is the author's business; JavaScript would do the same.
 *
 * When the sample array is empty (or the path is wrong) the preview still gets one
 * iteration with the variable undefined — showing nothing at all would make a
 * repeated row look broken in the editor while being perfectly correct in the
 * export.
 *
 * @param {any} repeat
 * @param {Record<string, any>} scope
 * @returns {Array<Record<string, any>>} `[scope]` when there is no repeat
 */
export function repeatScopes(repeat, scope) {
  const normalized = normalizeRepeat(repeat)
  if (!normalized) return [scope]
  const items = getPath(scope ?? {}, normalized.path)
  const list = Array.isArray(items) ? items : []
  const count = Math.max(1, Math.min(list.length || 1, normalized.previewCount ?? DEFAULT_PREVIEW_COUNT))
  return Array.from({ length: count }, (_unused, index) => ({
    ...(scope ?? {}),
    [normalized.as]: list[index],
    [`${normalized.as}Index`]: index,
  }))
}

/**
 * @param {any} repeat
 * @returns {string[]}
 */
export function repeatPaths(repeat) {
  const normalized = normalizeRepeat(repeat)
  return normalized ? [normalized.path] : []
}
