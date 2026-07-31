/**
 * Plain-text renderer.
 *
 * Not an afterthought: a missing `text/plain` alternative is a measurable spam
 * signal, which is why the linter has a rule for it and why every block has a
 * text target (falling back to stripped HTML when it doesn't).
 *
 * @module mailforge/core/render/text
 */

import { getBlockDef } from '../registry.js'
import { stripTags } from '../blocks/shared.js'
import { createRenderContext, withScope } from './context.js'
import { evaluateCondition, repeatScopes } from '../conditions.js'

/** @typedef {import('../types.js').EmailDocument} EmailDocument */
/** @typedef {import('../types.js').RenderContext} RenderContext */

/**
 * @param {import('../types.js').Block} block
 * @param {RenderContext} ctx
 * @returns {string}
 */
export function renderBlockText(block, ctx) {
  const def = getBlockDef(block.type)
  const props = block.props ?? {}
  if (!def) return ''
  if (def.render.text) return (def.render.text(props, ctx) ?? '').trim()
  return stripTags(def.render.html(props, ctx) ?? '')
}

/**
 * @param {EmailDocument} doc
 * @param {object} [options]
 * @param {import('../types.js').VarsDef | null} [options.vars]
 * @param {number} [options.width] Wrap column. 0 disables wrapping.
 * @returns {string}
 */
export function renderToText(doc, options = {}) {
  const ctx = createRenderContext(doc, { vars: options.vars, target: 'text' })
  const width = options.width ?? 78

  /** @type {string[]} */
  const parts = []
  const preheader = ctx.resolve(doc?.settings?.preheader ?? '')
  if (preheader) parts.push(preheader)

  // The plain-text alternative has to agree with the HTML one, or a recipient
  // whose client prefers text reads a different email — including sections the
  // condition was meant to hide.
  for (const section of doc?.sections ?? []) {
    if (!evaluateCondition(section.showIf, ctx.scope)) continue
    /** @type {string[]} */
    const sectionParts = []
    for (const row of section.rows ?? []) {
      if (!evaluateCondition(row.showIf, ctx.scope)) continue
      for (const scope of repeatScopes(row.repeat, ctx.scope)) {
        const rowCtx = withScope(ctx, scope)
        for (const column of row.columns ?? []) {
          for (const block of column.blocks ?? []) {
            if (!evaluateCondition(block.showIf, scope)) continue
            const text = renderBlockText(block, rowCtx)
            if (text) sectionParts.push(text)
          }
        }
      }
    }
    if (sectionParts.length) parts.push(sectionParts.join('\n\n'))
  }

  const body = parts.join('\n\n')
  return width > 0 ? wrap(body, width) : body
}

/**
 * Hard-wrap at `width`, preserving existing line breaks and never breaking a
 * URL across lines (which would make it unclickable).
 *
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
export function wrap(text, width) {
  return text
    .split('\n')
    .map((line) => {
      if (line.length <= width) return line
      /** @type {string[]} */
      const out = []
      let current = ''
      for (const word of line.split(' ')) {
        if (current && current.length + 1 + word.length > width) {
          out.push(current)
          current = word
        } else {
          current = current ? `${current} ${word}` : word
        }
      }
      if (current) out.push(current)
      return out.join('\n')
    })
    .join('\n')
}
