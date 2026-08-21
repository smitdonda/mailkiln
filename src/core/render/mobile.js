/**
 * Per-block mobile behaviour: hide on narrow screens, and a smaller font size
 * below the breakpoint.
 *
 * Both are media queries, which means both are a stylesheet — the one thing an
 * email is otherwise built to avoid. That is fine here for the same reason the
 * column stacking rule is fine: Outlook ignores the `<style>` block entirely and
 * gets the desktop layout, which is exactly what a desktop client should show.
 *
 * Shared by the HTML and JSX renderers so the ejected component behaves like the
 * sent email rather than merely resembling it.
 *
 * @module mailkiln/core/render/mobile
 */

/** Applied to a block wrapper that should disappear below the breakpoint. */
export const HIDE_CLASS = 'mk-hide-sm'

/**
 * The mobile breakpoint for a given content width: one pixel *below* it.
 *
 * `max-width:600px` matches at exactly 600px, where the content still fits
 * perfectly — so a 600px viewport got the stacked mobile layout, and a block
 * marked "hide on mobile" vanished from the editor's own desktop preview. The
 * condition we actually mean is "narrower than the content".
 *
 * @param {number} width
 * @returns {number}
 */
export function mobileBreakpoint(width) {
  return Math.max(1, (Number(width) || 600) - 1)
}

/**
 * A stable per-block class, so one block's mobile font size cannot leak into
 * another's. Ids are `prefix_base36`, which is already a valid class name.
 *
 * @param {string} id
 * @returns {string}
 */
export function blockClass(id) {
  return `mk-b-${String(id).replace(/[^\w-]/g, '')}`
}

/**
 * The mobile font size of a block, or 0 when it has none.
 *
 * @param {Record<string, any>} props
 * @returns {number}
 */
export function mobileFontSize(props) {
  const size = Number(props?.mobileFontSize)
  return Number.isFinite(size) && size > 0 ? size : 0
}

/**
 * @param {import('../types.js').EmailDocument} doc
 * @returns {import('../types.js').Block[]}
 */
function everyBlock(doc) {
  return (doc?.sections ?? []).flatMap((section) =>
    (section.rows ?? []).flatMap((row) =>
      (row.columns ?? []).flatMap((column) => column.blocks ?? []),
    ),
  )
}

/**
 * The per-block rules that belong inside the mobile media query.
 *
 * The descendant selector is deliberate: a text block's size lives on the inner
 * `<div>`, a heading's on the `<h2>`, a button's on the `<a>`. Targeting the
 * wrapper alone would style nothing.
 *
 * @param {import('../types.js').EmailDocument} doc
 * @returns {string[]}
 */
export function mobileRules(doc) {
  /** @type {string[]} */
  const rules = []
  for (const block of everyBlock(doc)) {
    const size = mobileFontSize(block.props ?? {})
    if (!size) continue
    const selector = blockClass(block.id)
    rules.push(`.${selector} td,.${selector} td *{font-size:${size}px !important}`)
  }
  return rules
}

/**
 * The complete media query for the JSX target, or `''` when the document has no
 * mobile overrides at all.
 *
 * The HTML renderer composes its own — it has the column-stacking rules to fold
 * in too — but the ejected component's `<Head>` would otherwise be empty, and an
 * empty `<style>` in someone's exported code is noise.
 *
 * @param {import('../types.js').EmailDocument} doc
 * @param {number} width Content width, in px.
 * @returns {string}
 */
export function mobileMediaCss(doc, width) {
  const rules = mobileRules(doc)
  const hides = everyBlock(doc).some((block) => block.props?.hideOnMobile === true)
  if (!rules.length && !hides) return ''
  const hideRule = hides ? `.${HIDE_CLASS}{display:none !important}` : ''
  return `@media only screen and (max-width:${mobileBreakpoint(width)}px){${hideRule}${rules.join('')}}`
}
