/**
 * MJML emitter.
 *
 * IMPORTANT: this emits MJML *markup*, it does not compile it. The `mjml`
 * compiler is ~30MB and Node-only; bundling it would wreck the install size of
 * a browser library for a feature most consumers never use. Run `mjml` or
 * `mjml-browser` yourself on this output. This is stated in the README too,
 * because a surprise here is a bad surprise.
 *
 * Structural note: MJML's `mj-section` *is* a row of columns, so one mailkiln
 * Section with three Rows becomes three `mj-section`s inside one `mj-wrapper`.
 *
 * @module mailkiln/core/render/mjml
 */

import { getBlockDef } from '../registry.js'
import { attrs, escapeAttr, escapeHtml, spacingToCss } from './inline.js'
import { createRenderContext, withScope } from './context.js'
import { evaluateCondition, repeatScopes } from '../conditions.js'

/** @typedef {import('../types.js').EmailDocument} EmailDocument */
/** @typedef {import('../types.js').RenderContext} RenderContext */

/**
 * @param {import('../types.js').Block} block
 * @param {RenderContext} ctx
 * @returns {string}
 */
function blockMjml(block, ctx) {
  const def = getBlockDef(block.type)
  const props = block.props ?? {}
  if (!def) return `<mj-raw><!-- unknown block: ${escapeHtml(block.type)} --></mj-raw>`
  if (def.render.mjml) return def.render.mjml(props, ctx) ?? ''
  // No mjml renderer — wrap the block's HTML in mj-raw so nothing is lost.
  const padding = spacingToCss(props.padding)
  const html = def.render.html(props, ctx) ?? ''
  return padding
    ? `<mj-raw><div style="padding:${padding}">${html}</div></mj-raw>`
    : `<mj-raw>${html}</mj-raw>`
}

/**
 * @param {import('../types.js').Row} row
 * @param {RenderContext} ctx
 * @returns {string}
 */
function rowMjml(row, ctx) {
  if (!evaluateCondition(row.showIf, ctx.scope)) return ''
  if (row.repeat) {
    return repeatScopes(row.repeat, ctx.scope)
      .map((scope) => rowMjmlOnce({ ...row, repeat: undefined }, withScope(ctx, scope)))
      .join('')
  }
  return rowMjmlOnce(row, ctx)
}

/**
 * @param {import('../types.js').Row} row
 * @param {RenderContext} ctx
 * @returns {string}
 */
function rowMjmlOnce(row, ctx) {
  const columns = (row.columns ?? [])
    .map((column) => {
      const blocks = (column.blocks ?? [])
        .filter((b) => evaluateCondition(b.showIf, ctx.scope))
        .map((b) => blockMjml(b, ctx))
        .join('')
      return `<mj-column${attrs({
        width: `${column.props?.width ?? 100}%`,
        'vertical-align': column.props?.verticalAlign,
        'background-color': column.props?.backgroundColor,
        padding: spacingToCss(column.props?.padding),
        'border-top': column.props?.borderTop,
        'border-right': column.props?.borderRight,
        'border-bottom': column.props?.borderBottom,
        'border-left': column.props?.borderLeft,
      })}>${blocks}</mj-column>`
    })
    .join('')
  return `<mj-section${attrs({
    padding: spacingToCss(row.props?.padding) || '0',
    'background-color': row.props?.backgroundColor,
    'border-top': row.props?.borderTop,
    'border-right': row.props?.borderRight,
    'border-bottom': row.props?.borderBottom,
    'border-left': row.props?.borderLeft,
  })}>${columns}</mj-section>`
}

/**
 * @param {import('../types.js').Section} section
 * @param {RenderContext} ctx
 * @returns {string}
 */
function sectionMjml(section, ctx) {
  if (!evaluateCondition(section.showIf, ctx.scope)) return ''
  const props = section.props ?? {}
  const rows = (section.rows ?? []).map((row) => rowMjml(row, ctx)).join('')
  const needsWrapper =
    !!props.backgroundColor || !!props.backgroundImage || !!spacingToCss(props.padding)
  if (!needsWrapper) return rows
  return `<mj-wrapper${attrs({
    padding: spacingToCss(props.padding) || '0',
    'background-color': props.backgroundColor,
    'background-url': props.backgroundImage,
    'background-size': props.backgroundImage ? 'cover' : '',
    'full-width': props.fullWidth ? 'full-width' : '',
  })}>${rows}</mj-wrapper>`
}

/**
 * @param {EmailDocument} doc
 * @param {object} [options]
 * @param {import('../types.js').VarsDef | null} [options.vars]
 * @returns {string}
 */
export function renderToMjml(doc, options = {}) {
  const ctx = createRenderContext(doc, { vars: options.vars, target: 'mjml' })
  const settings = ctx.settings
  const sections = (doc?.sections ?? []).map((section) => sectionMjml(section, ctx)).join('')

  const head = [
    settings.subject ? `<mj-title>${escapeHtml(settings.subject)}</mj-title>` : '',
    settings.preheader
      ? `<mj-preview>${escapeHtml(ctx.resolve(settings.preheader))}</mj-preview>`
      : '',
    `<mj-attributes><mj-all font-family="${escapeAttr(settings.fontFamily)}" /><mj-text color="${escapeAttr(settings.textColor)}" /><mj-section padding="0" /></mj-attributes>`,
  ]
    .filter(Boolean)
    .join('')

  return `<mjml>
  <mj-head>${head}</mj-head>
  <mj-body${attrs({ 'background-color': settings.backgroundColor, width: `${settings.width}px` })}>${sections}</mj-body>
</mjml>`
}
