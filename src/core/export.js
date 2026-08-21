/**
 * One call that produces every output format.
 *
 * The JSON member matters as much as the code members: the document is plain
 * JSON that mailkiln can always read back, so "export" here never means "the
 * only copy is now in a format we control".
 *
 * @module mailkiln/core/export
 */

import { settleDrafts } from './document.js'
import { renderToHtml } from './render/html.js'
import { documentName, renderToJsx, toComponentName } from './render/jsx.js'
import { renderToMjml } from './render/mjml.js'
import { renderToText } from './render/text.js'

/** @typedef {import('./types.js').ExportBundle} ExportBundle */

/**
 * @param {import('./types.js').EmailDocument} doc
 * @param {object} [options]
 * @param {import('./types.js').VarsDef | null} [options.vars]
 * @param {string} [options.name] Component name for the JSX/TSX output.
 * @returns {ExportBundle}
 */
export function exportDocument(doc, options = {}) {
  const vars = options.vars ?? null
  const name = options.name ?? documentName(doc)
  // A display condition someone started and never finished is legitimate state
  // while editing, and noise in a saved template. Strip it here — this is the
  // artifact that leaves the editor.
  const clean = settleDrafts(doc)
  return {
    jsx: renderToJsx(clean, { vars, name, lang: 'jsx' }),
    tsx: renderToJsx(clean, { vars, name, lang: 'tsx' }),
    html: renderToHtml(clean, { vars }),
    mjml: renderToMjml(clean, { vars }),
    text: renderToText(clean, { vars }),
    json: JSON.stringify(clean, null, 2),
  }
}

/**
 * Suggested filenames for each member of the bundle, so download buttons don't
 * each invent their own.
 *
 * @param {string} componentName A component name, or a raw template name — both
 *   work, since anything that is not already an identifier is converted.
 * @returns {Record<keyof ExportBundle, string>}
 */
export function exportFilenames(componentName) {
  const base = toComponentName(componentName || 'EmailTemplate')
  const kebab = base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
  return {
    jsx: `${base}.jsx`,
    tsx: `${base}.tsx`,
    html: `${kebab}.html`,
    mjml: `${kebab}.mjml`,
    text: `${kebab}.txt`,
    json: `${kebab}.mailkiln.json`,
  }
}
