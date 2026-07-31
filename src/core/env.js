/**
 * Environment probe, in its own module so `registry.js` and `schema.js` can both
 * use it without importing each other.
 *
 * @module mailforge/core/env
 */

/**
 * True unless we're demonstrably in a production build. Guards dev-only checks
 * and warnings so they cost nothing in a consumer's shipped bundle.
 *
 * @returns {boolean}
 */
export function isDev() {
  try {
    return typeof process === 'undefined' || process.env?.NODE_ENV !== 'production'
  } catch {
    // `process` can throw in some sandboxed runtimes rather than be undefined.
    return true
  }
}
