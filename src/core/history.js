/**
 * Undo / redo.
 *
 * A plain immutable value (past / present / future) rather than a class, so it
 * drops straight into React state and time travel is just another render.
 *
 * Coalescing is the part that matters in practice: typing into a text field
 * fires `patchProps` on every keystroke, and without coalescing one sentence
 * becomes forty undo steps. Commits that share a `tag` within `coalesceMs`
 * replace the present instead of pushing a new entry.
 *
 * @module mailforge/core/history
 */

/** @typedef {import('./types.js').EmailDocument} EmailDocument */
/** @typedef {import('./types.js').History} History */

/** Default cap on stored snapshots. */
export const HISTORY_LIMIT = 50

/** Default coalescing window in ms. */
export const COALESCE_MS = 500

/**
 * @param {EmailDocument} present
 * @param {object} [options]
 * @param {number} [options.limit]
 * @returns {History}
 */
export function createHistory(present, options = {}) {
  return {
    past: [],
    present,
    future: [],
    lastTag: null,
    lastAt: 0,
    limit: options.limit ?? HISTORY_LIMIT,
  }
}

/**
 * Commit a new document.
 *
 * @param {History} history
 * @param {EmailDocument} next
 * @param {object} [options]
 * @param {string | null} [options.tag] Coalescing key. Same tag twice in a row within
 *   `coalesceMs` is one undo step. The editor uses `patch:<nodeId>:<propKey>`.
 * @param {number} [options.coalesceMs]
 * @param {number} [options.now] Injectable clock, so tests don't sleep.
 * @returns {History}
 */
export function commit(history, next, options = {}) {
  if (next === history.present) return history

  const now = options.now ?? Date.now()
  const tag = options.tag ?? null
  const coalesceMs = options.coalesceMs ?? COALESCE_MS
  const coalesce = tag !== null && tag === history.lastTag && now - history.lastAt < coalesceMs

  if (coalesce) {
    return { ...history, present: next, future: [], lastAt: now }
  }

  const past = [...history.past, history.present]
  if (past.length > history.limit) past.splice(0, past.length - history.limit)

  return { ...history, past, present: next, future: [], lastTag: tag, lastAt: now }
}

/**
 * @param {History} history
 * @returns {History}
 */
export function undo(history) {
  if (!history.past.length) return history
  const past = history.past.slice()
  const present = /** @type {EmailDocument} */ (past.pop())
  return {
    ...history,
    past,
    present,
    future: [history.present, ...history.future],
    // Break coalescing: the next edit must start a fresh entry, otherwise it
    // would merge into the step we just undid.
    lastTag: null,
    lastAt: 0,
  }
}

/**
 * @param {History} history
 * @returns {History}
 */
export function redo(history) {
  if (!history.future.length) return history
  const [present, ...future] = history.future
  return {
    ...history,
    past: [...history.past, history.present],
    present,
    future,
    lastTag: null,
    lastAt: 0,
  }
}

/**
 * @param {History} history
 * @returns {boolean}
 */
export function canUndo(history) {
  return history.past.length > 0
}

/**
 * @param {History} history
 * @returns {boolean}
 */
export function canRedo(history) {
  return history.future.length > 0
}

/**
 * Replace the present without recording history — for external `value` changes
 * that the editor did not cause.
 *
 * @param {History} history
 * @param {EmailDocument} present
 * @returns {History}
 */
export function reset(history, present) {
  return { ...history, past: [], present, future: [], lastTag: null, lastAt: 0 }
}

/**
 * Tag builder for property edits, so consecutive keystrokes on one field
 * collapse but a jump to another field does not.
 *
 * @param {string} nodeId
 * @param {string} propKey
 * @returns {string}
 */
export function patchTag(nodeId, propKey) {
  return `patch:${nodeId}:${propKey}`
}
