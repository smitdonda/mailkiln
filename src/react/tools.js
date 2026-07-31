/**
 * Per-tool configuration: which blocks the palette offers, in what order, and
 * how many times each may be used.
 *
 * The shape deliberately mirrors react-email-editor's `tools` option, so someone
 * migrating from it can paste their config across and have it work:
 *
 *     <MailForge tools={{ image: { enabled: false }, button: { position: 1, usageLimit: 1 } }} />
 *
 * This is a **UI policy**, so it lives in `react/` and not in core. Core stays
 * policy-free: `insertBlock` will always insert, `registerBlock` will always
 * register, and a headless script is never bound by a palette rule someone set
 * for their editor. Nothing here can corrupt a document either — the worst a bad
 * config does is hide a tile.
 *
 * @module mailforge/react/tools
 */

/**
 * @typedef {object} ToolConfig
 * @property {boolean} [enabled] `false` removes the tool from the palette entirely.
 * @property {number} [position] Index in the palette. Unpositioned tools keep their order.
 * @property {number} [usageLimit] Maximum instances allowed in one document.
 */

/**
 * Filter and order the palette.
 *
 * `position` is an index, not a sort key: a tool that asks for position 1 lands
 * second, and everything without a position keeps its declared order around it.
 * Sorting by `position ?? Infinity` gets that, and `Array.prototype.sort` is
 * stable in every engine we support, so ties never reshuffle.
 *
 * @param {import('../core/types.js').BlockDef[]} blocks
 * @param {Record<string, ToolConfig>} [tools]
 * @returns {import('../core/types.js').BlockDef[]}
 */
export function applyTools(blocks, tools) {
  if (!tools) return blocks
  const enabled = blocks.filter((def) => tools[def.type]?.enabled !== false)
  const positioned = enabled.some((def) => typeof tools[def.type]?.position === 'number')
  if (!positioned) return enabled
  return [...enabled].sort((a, b) => {
    const pa = tools[a.type]?.position
    const pb = tools[b.type]?.position
    return (typeof pa === 'number' ? pa : Infinity) - (typeof pb === 'number' ? pb : Infinity)
  })
}

/**
 * How many blocks of a type the document already holds.
 *
 * @param {import('../core/types.js').EmailDocument} doc
 * @param {string} type
 * @returns {number}
 */
export function countBlocks(doc, type) {
  let total = 0
  for (const section of doc?.sections ?? []) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const block of column.blocks ?? []) {
          if (block.type === type) total += 1
        }
      }
    }
  }
  return total
}

/**
 * The set of tool types that have hit their `usageLimit`.
 *
 * Returned as a set rather than checked per tile so the document is walked once
 * per render instead of once per tile.
 *
 * @param {import('../core/types.js').EmailDocument} doc
 * @param {Record<string, ToolConfig>} [tools]
 * @returns {Set<string>}
 */
export function exhaustedTools(doc, tools) {
  /** @type {Set<string>} */
  const out = new Set()
  if (!tools) return out
  for (const [type, config] of Object.entries(tools)) {
    const limit = config?.usageLimit
    if (typeof limit !== 'number' || limit < 0) continue
    if (countBlocks(doc, type) >= limit) out.add(type)
  }
  return out
}
