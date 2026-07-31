/**
 * PILLAR 3 — the deliverability linter.
 *
 * Renders the document once and hands the same HTML and text to every rule, so
 * running the full set costs one render rather than fourteen. Block-level `lint`
 * hooks run in the same pass, which is how third-party blocks contribute their own
 * warnings.
 *
 * @module mailforge/core/lint
 */

import { findNode } from '../document.js'
import { renderToHtml } from '../render/html.js'
import { renderToText } from '../render/text.js'
import { getBlockDef } from '../registry.js'
import { eachBlock } from './walk.js'
import { byteLength, gmailClippingRule } from './rules/gmailClipping.js'
import { outlookUnsafeCssRule } from './rules/outlookUnsafeCss.js'
import { imageAltRule, imageFormatRule, imageWidthRule } from './rules/images.js'
import { backgroundImageRule } from './rules/backgroundImage.js'
import { contrastRule, darkModeRule } from './rules/contrast.js'
import {
  fontSizeRule,
  plainTextRule,
  preheaderRule,
  spamPhrasesRule,
  unsubscribeRule,
} from './rules/deliverability.js'
import { unknownVarsRule } from './rules/unknownVars.js'
import { linkRule, structureRule } from './rules/structure.js'

/** @typedef {import('../types.js').LintRule} LintRule */
/** @typedef {import('../types.js').LintIssue} LintIssue */
/** @typedef {import('../types.js').LintResult} LintResult */

/**
 * Every built-in rule, in report order (most consequential first).
 *
 * @type {LintRule[]}
 */
export const builtinRules = [
  gmailClippingRule,
  unsubscribeRule,
  unknownVarsRule,
  linkRule,
  outlookUnsafeCssRule,
  contrastRule,
  darkModeRule,
  imageAltRule,
  imageFormatRule,
  imageWidthRule,
  backgroundImageRule,
  plainTextRule,
  preheaderRule,
  fontSizeRule,
  spamPhrasesRule,
  structureRule,
]

const LEVEL_ORDER = { error: 0, warn: 1, info: 2 }

/**
 * Lint a document.
 *
 * @param {import('../types.js').EmailDocument} doc
 * @param {object} [options]
 * @param {import('../types.js').VarsDef | null} [options.vars]
 * @param {LintRule[]} [options.rules] Replace the built-in set entirely.
 * @param {LintRule[]} [options.extraRules] Append to the built-in set.
 * @param {string[]} [options.disable] Rule ids to skip.
 * @param {string} [options.html] Pre-rendered HTML, if you already have it.
 * @param {string} [options.text] Pre-rendered text.
 * @returns {LintResult}
 */
export function lintDocument(doc, options = {}) {
  const vars = options.vars ?? null
  const html = options.html ?? renderToHtml(doc, { vars })
  const text = options.text ?? renderToText(doc, { vars })
  const disabled = new Set(options.disable ?? [])

  /** @type {import('../types.js').LintContext} */
  const ctx = {
    doc,
    vars,
    html,
    text,
    locate: (id) => findNode(doc, id),
  }

  const rules = [...(options.rules ?? builtinRules), ...(options.extraRules ?? [])]

  /** @type {LintIssue[]} */
  const issues = []
  for (const rule of rules) {
    if (disabled.has(rule.id)) continue
    try {
      for (const issue of rule.check(ctx) ?? []) {
        // The rule's `level` is the default; an individual issue may raise or
        // lower it (a contrast miss of 0.1 is a warning, a miss of 2 is an error).
        issues.push({ ...issue, level: issue.level ?? rule.level, id: issue.id ?? rule.id })
      }
    } catch (error) {
      // A broken rule reports itself rather than taking down the panel.
      issues.push({
        id: rule.id,
        level: 'info',
        message: `Lint rule "${rule.id}" failed to run.`,
        hint: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Block-level hooks: this is how a custom block ships its own rules.
  for (const { block } of eachBlock(doc)) {
    const def = getBlockDef(block.type)
    if (!def?.lint || disabled.has(`block:${block.type}`)) continue
    try {
      for (const issue of def.lint(block.props ?? {}, ctx) ?? []) {
        if (disabled.has(issue.id)) continue
        issues.push({ nodeId: block.id, ...issue, level: issue.level ?? 'warn' })
      }
    } catch (error) {
      issues.push({
        id: `block:${block.type}`,
        level: 'info',
        message: `The "${block.type}" block's lint hook threw.`,
        hint: error instanceof Error ? error.message : String(error),
        nodeId: block.id,
      })
    }
  }

  issues.sort((a, b) => (LEVEL_ORDER[a.level] ?? 3) - (LEVEL_ORDER[b.level] ?? 3))

  return {
    issues,
    errors: issues.filter((i) => i.level === 'error').length,
    warnings: issues.filter((i) => i.level === 'warn').length,
    infos: issues.filter((i) => i.level === 'info').length,
    sizeBytes: byteLength(html),
  }
}

/**
 * @param {LintIssue[]} issues
 * @returns {Map<string, LintIssue[]>} issues grouped by node id ('' = document-level)
 */
export function groupByNode(issues) {
  /** @type {Map<string, LintIssue[]>} */
  const map = new Map()
  for (const issue of issues) {
    const key = issue.nodeId ?? ''
    const list = map.get(key)
    if (list) list.push(issue)
    else map.set(key, [issue])
  }
  return map
}

export { byteLength } from './rules/gmailClipping.js'
export { GMAIL_LIMIT } from './rules/gmailClipping.js'
export { contrastRatio, parseColor } from './color.js'
export { eachBlock, effectiveBackground } from './walk.js'
