/**
 * The merge variables every ESP substitutes for a link.
 *
 * These are not ordinary variables. `defineVars` never declares them — they come
 * from the sending platform, not from your data — yet a template is legally
 * required to contain at least one of them. So they live here, in core, with
 * three consumers agreeing on the same list: the unknown-variable lint rule
 * (which must not report them), the `unsubscribe` rule (which is satisfied by
 * one), and the editor's link field (which offers them).
 *
 * Labels are deliberately absent. Core is locale-free; the editor supplies
 * translated names from `richtext`/`link` i18n keys.
 *
 * @module mailforge/core/links
 */

/** Path names, without the `{{ }}`. */
export const SPECIAL_LINK_PATHS = /** @type {const} */ ([
  'unsubscribe_url',
  'preferences_url',
  'view_in_browser_url',
])

/** The same list as merge tags, ready to drop into an `href`. */
export const SPECIAL_LINKS = SPECIAL_LINK_PATHS.map((path) => `{{${path}}}`)

/**
 * @param {string} href
 * @returns {boolean}
 */
export function isSpecialLink(href) {
  return SPECIAL_LINKS.includes(String(href ?? '').trim())
}
