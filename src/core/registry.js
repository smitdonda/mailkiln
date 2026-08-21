/**
 * Block registry.
 *
 * `defineBlock()` validates at registration time and throws a named, actionable
 * error. In a TypeScript library the compiler would catch a malformed block
 * definition; here we catch it at the moment of registration instead, which
 * plugin authors actually see — and which works the same whether they're on TS,
 * JS or a REPL.
 *
 * Built-in blocks go through this exact function. There is no privileged path.
 *
 * @module mailkiln/core/registry
 */

import { isDev } from './env.js'

/** @typedef {import('./types.js').BlockDef} BlockDef */
/** @typedef {import('./types.js').FieldDef} FieldDef */

const FIELD_TYPES = new Set([
  'text',
  'textarea',
  'richtext',
  'number',
  'color',
  'select',
  'spacing',
  'align',
  'image',
  'toggle',
  'url',
  'font',
  'range',
  'list',
])

/** @type {Map<string, BlockDef>} */
const registry = new Map()

/**
 * @param {string} message
 * @returns {Error}
 */
function err(message) {
  return new Error(`mailkiln: ${message}`)
}

/**
 * Validate a block definition. Exported so tooling (and tests) can check a
 * definition without registering it.
 *
 * @param {BlockDef} def
 * @returns {BlockDef} the same object, frozen
 */
export function validateBlockDef(def) {
  if (!def || typeof def !== 'object') {
    throw err('defineBlock() expects a definition object.')
  }
  const { type } = def
  if (typeof type !== 'string' || type.trim() === '') {
    throw err('defineBlock() requires a non-empty string `type`.')
  }
  const at = `block "${type}"`

  if (typeof def.label !== 'string' || def.label.trim() === '') {
    throw err(`${at} is missing \`label\` (shown in the palette).`)
  }
  if (def.defaultProps == null || typeof def.defaultProps !== 'object') {
    throw err(`${at} is missing \`defaultProps\` (an object, may be empty).`)
  }
  if (!def.render || typeof def.render !== 'object') {
    throw err(`${at} is missing \`render\`.`)
  }
  if (typeof def.render.html !== 'function') {
    throw err(
      `${at} is missing \`render.html\`. HTML is the only required target — jsx, mjml and text all fall back to it.`,
    )
  }
  for (const target of ['jsx', 'mjml', 'text']) {
    const fn = /** @type {any} */ (def.render)[target]
    if (fn != null && typeof fn !== 'function') {
      throw err(`${at} has a non-function \`render.${target}\`.`)
    }
  }
  for (const hook of ['lint', 'parse']) {
    const fn = /** @type {any} */ (def)[hook]
    if (fn != null && typeof fn !== 'function') {
      throw err(`${at} has a non-function \`${hook}\`.`)
    }
  }

  if (def.schema != null) {
    if (!Array.isArray(def.schema)) {
      throw err(`${at} has a non-array \`schema\`.`)
    }
    def.schema.forEach((field, i) => {
      const where = `${at} schema[${i}]`
      if (!field || typeof field !== 'object') {
        throw err(`${where} is not a field object.`)
      }
      if (typeof field.key !== 'string' || field.key === '') {
        throw err(`${where} is missing \`key\`.`)
      }
      if (typeof field.label !== 'string' || field.label === '') {
        throw err(`${where} ("${field.key}") is missing \`label\`.`)
      }
      if (!FIELD_TYPES.has(field.type)) {
        throw err(
          `${where} ("${field.key}") has unknown type "${field.type}". Known types: ${[...FIELD_TYPES].join(', ')}.`,
        )
      }
      if (field.type === 'select' && !Array.isArray(field.options)) {
        throw err(`${where} ("${field.key}") is a select and needs \`options\`.`)
      }
      if (field.type === 'list' && !Array.isArray(field.itemSchema)) {
        throw err(
          `${where} ("${field.key}") is a list and needs \`itemSchema\` (the fields of one item).`,
        )
      }
      // The Inspector reads and writes props[key]; if it isn't in defaultProps
      // the field renders as undefined and silently does nothing.
      const root = field.key.split('.')[0]
      if (!Object.prototype.hasOwnProperty.call(def.defaultProps, root)) {
        throw err(
          `${where} edits "${field.key}" but \`defaultProps.${root}\` does not exist. Add it so the field has a value to edit.`,
        )
      }
    })
  }

  // Shallow freeze only. Deep-freezing `schema` would make it a ReadonlyArray,
  // which every consumer would then have to copy before mapping over it.
  return Object.freeze({ ...def })
}

/**
 * Define and register a block. Returns the frozen definition so you can put it
 * in an array (`blocks={[countdown]}`) as well.
 *
 * @param {BlockDef} def
 * @returns {BlockDef}
 */
export function defineBlock(def) {
  const frozen = validateBlockDef(def)
  const existing = registry.get(frozen.type)

  // Re-registering a type replaces it, with a dev warning. It must not throw:
  // a module that calls `defineBlock` at top level runs again on every Fast
  // Refresh, producing a new (but equivalent) definition object each time, and
  // throwing there would break the consumer's dev server on every save. A
  // genuine collision between two different blocks is still surfaced — loudly
  // enough to notice, quietly enough not to brick the app.
  if (existing && existing !== frozen && isDev()) {
    console.warn(
      `mailkiln: block "${frozen.type}" was already registered — replacing it. If two different blocks share this type, rename one.`,
    )
  }

  registry.set(frozen.type, frozen)
  return frozen
}

/**
 * Register a definition, short-circuiting when that exact object is already
 * registered. Used by the React layer for the `blocks` prop, which re-runs on
 * every remount and would otherwise re-validate on each one.
 *
 * @param {BlockDef} def
 * @returns {BlockDef}
 */
export function registerBlock(def) {
  const existing = registry.get(def && def.type)
  if (existing === def) return def
  return defineBlock(def)
}

/**
 * @param {string} type
 * @returns {boolean} true if a definition was removed
 */
export function unregisterBlock(type) {
  return registry.delete(type)
}

/**
 * @param {string} type
 * @returns {BlockDef | undefined}
 */
export function getBlockDef(type) {
  return registry.get(type)
}

/**
 * Like {@link getBlockDef} but throws — use it where a missing block is a bug
 * rather than a rendering decision.
 *
 * @param {string} type
 * @returns {BlockDef}
 */
export function requireBlockDef(type) {
  const def = registry.get(type)
  if (!def) {
    throw err(
      `unknown block type "${type}". Registered: ${[...registry.keys()].join(', ') || '(none)'}. Pass it via the \`blocks\` prop or import it before use.`,
    )
  }
  return def
}

/**
 * @param {string} type
 * @returns {boolean}
 */
export function hasBlock(type) {
  return registry.has(type)
}

/**
 * @returns {BlockDef[]} every registered definition, in registration order
 */
export function allBlocks() {
  return [...registry.values()]
}

/**
 * Definitions that declared a `parse` hook, highest `importPriority` first.
 * The importer walks this list, so custom blocks join HTML import for free.
 *
 * @returns {BlockDef[]}
 */
export function parsableBlocks() {
  return [...registry.values()]
    .filter((d) => typeof d.parse === 'function')
    .sort((a, b) => (b.importPriority ?? 0) - (a.importPriority ?? 0))
}

/**
 * Test helper: empty the registry.
 *
 * @returns {void}
 */
export function clearRegistry() {
  registry.clear()
}
