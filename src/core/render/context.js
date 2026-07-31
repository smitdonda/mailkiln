/**
 * The render context every block renderer receives. One builder, four targets,
 * so `ctx.settings` and `ctx.resolve` mean the same thing everywhere.
 *
 * @module mailforge/core/render/context
 */

import { DEFAULT_SETTINGS } from '../schema.js'
import { interpolate } from '../vars.js'

/** @typedef {import('../types.js').RenderContext} RenderContext */

/**
 * @param {import('../types.js').EmailDocument} doc
 * @param {object} [options]
 * @param {import('../types.js').VarsDef | null} [options.vars]
 * @param {'html' | 'jsx' | 'mjml' | 'text'} [options.target]
 * @param {Record<string, any>} [options.options]
 * @param {boolean} [options.raw] Leave `{{tags}}` untouched instead of interpolating
 *   sample data. The JSX emitter needs the tags intact to turn them into props.
 * @returns {RenderContext}
 */
export function createRenderContext(doc, options = {}) {
  const vars = options.vars ?? null
  const settings = { ...DEFAULT_SETTINGS, ...doc?.settings }
  const scope = vars?.sample ?? {}
  return {
    doc,
    settings,
    vars,
    scope,
    raw: options.raw === true,
    target: options.target ?? 'html',
    options: options.options ?? {},
    resolve: options.raw ? (text) => text ?? '' : (text) => interpolate(text ?? '', scope),
  }
}

/**
 * A context whose merge tags resolve against a different object — one iteration
 * of a repeated row, where `{{item.title}}` has to mean something the outer
 * sample data has no name for.
 *
 * `raw` contexts (the JSX emitter) are handed back untouched: their whole job is
 * to leave `{{tags}}` intact so they can become expressions, and resolving them
 * per iteration would defeat that.
 *
 * @param {RenderContext} ctx
 * @param {Record<string, any>} scope
 * @returns {RenderContext}
 */
export function withScope(ctx, scope) {
  if (ctx.raw || scope === ctx.scope) return ctx
  return { ...ctx, scope, resolve: (text) => interpolate(text ?? '', scope) }
}
