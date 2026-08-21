/**
 * Merge variables used in the template that `defineVars` doesn't declare.
 *
 * This is the rule that closes the loop between pillars 3 and 4. A typo in
 * `{{user.firstname}}` is invisible in the editor, renders as literal text in the
 * recipient's inbox, and is the single most embarrassing email bug there is. One
 * declared sample object makes it a lint error instead.
 *
 * @module mailkiln/core/lint/rules/unknownVars
 */

import { SPECIAL_LINK_PATHS } from '../../links.js'
import { documentLocalVars, documentVarPaths, findVarPaths, varRoots } from '../../vars.js'
import { eachBlock } from '../walk.js'

/**
 * Paths every ESP provides, so they are never "unknown". The link ones come from
 * `core/links.js` — the same list the editor's link field offers, so a path you
 * can insert from the UI can never be reported as undeclared.
 */
export const IMPLICIT_PATHS = new Set([
  ...SPECIAL_LINK_PATHS,
  'unsubscribeUrl',
  'list_address',
  'current_year',
])

/** @type {import('../../types.js').LintRule} */
export const unknownVarsRule = {
  id: 'unknown-var',
  level: 'error',
  title: 'Undeclared merge variables',
  docs: 'Every {{path}} should exist in the declared sample data.',
  check(ctx) {
    if (!ctx.vars) return []

    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    const declaredRoots = new Set(varRoots(ctx.vars.paths.map((p) => p.path)))
    // `{{item.title}}` inside a row that repeats over `order.items` is in scope,
    // not undeclared. Without this the rule would punish the feature it is
    // supposed to support.
    const locals = documentLocalVars(ctx.doc)

    /** @type {Map<string, string | undefined>} */
    const locations = new Map()
    for (const { block } of eachBlock(ctx.doc)) {
      for (const path of collectPaths(block.props)) {
        if (!locations.has(path)) locations.set(path, block.id)
      }
    }
    for (const path of documentVarPaths(ctx.doc)) {
      if (!locations.has(path)) locations.set(path, undefined)
    }

    for (const [path, nodeId] of locations) {
      if (IMPLICIT_PATHS.has(path)) continue
      if (ctx.vars.has(path)) continue

      const root = path.split(/[.[]/)[0]
      if (locals.has(root)) continue
      const known = declaredRoots.has(root)
      const suggestion = closest(
        path,
        ctx.vars.paths.filter((p) => p.leaf).map((p) => p.path),
      )

      issues.push({
        id: 'unknown-var',
        level: 'error',
        message: `{{${path}}} is not declared in defineVars.`,
        hint: suggestion
          ? `Did you mean {{${suggestion}}}?`
          : known
            ? `"${root}" exists but "${path}" does not. Add it to the sample data.`
            : `Add "${root}" to the sample object you pass to defineVars — unresolved tags render as literal text in the inbox.`,
        nodeId,
        data: { path, suggestion },
      })
    }

    return issues
  },
}

/**
 * @param {Record<string, any>} props
 * @returns {string[]}
 */
function collectPaths(props) {
  /** @type {string[]} */
  const out = []
  /** @param {any} value */
  const scan = (value) => {
    if (typeof value === 'string') {
      for (const path of findVarPaths(value)) if (!out.includes(path)) out.push(path)
    } else if (Array.isArray(value)) {
      value.forEach(scan)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(scan)
    }
  }
  scan(props ?? {})
  return out
}

/**
 * Nearest declared path by edit distance, when it is close enough to be a typo
 * rather than a different variable entirely.
 *
 * @param {string} needle
 * @param {string[]} candidates
 * @returns {string | null}
 */
export function closest(needle, candidates) {
  let best = null
  let bestScore = Infinity
  for (const candidate of candidates) {
    const score = editDistance(needle.toLowerCase(), candidate.toLowerCase())
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  const threshold = Math.max(2, Math.floor(needle.length / 3))
  return best && bestScore <= threshold ? best : null
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  const rows = a.length + 1
  const cols = b.length + 1
  let previous = Array.from({ length: cols }, (_, i) => i)
  for (let i = 1; i < rows; i += 1) {
    const current = [i]
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[cols - 1]
}
