/**
 * A guarded `document.execCommand`.
 *
 * Two reasons this is not called directly. jsdom does not implement it at all,
 * so the component tests would throw on the first keystroke; and `execCommand`
 * is deprecated, so a browser dropping a command should degrade to "nothing
 * happened" rather than break the editor. Keeping every call behind one
 * function also means there is exactly one place to change if the day comes
 * when this has to be reimplemented with `Range`.
 *
 * @module mailforge/react/dnd/exec
 */

/**
 * @param {Document} doc
 * @param {string} command
 * @param {string} [value]
 * @returns {boolean} whether the command ran
 */
export function exec(doc, command, value) {
  const run = /** @type {any} */ (doc).execCommand
  if (typeof run !== 'function') return false
  try {
    return Boolean(run.call(doc, command, false, value))
  } catch {
    return false
  }
}

/**
 * @param {Document} doc
 * @param {string} command
 * @returns {boolean}
 */
export function queryState(doc, command) {
  const query = /** @type {any} */ (doc).queryCommandState
  if (typeof query !== 'function') return false
  try {
    return Boolean(query.call(doc, command))
  } catch {
    return false
  }
}
