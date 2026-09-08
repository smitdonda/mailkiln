/**
 * The block registry.
 *
 * `defineBlock` is the public extension point, so its errors are part of the
 * API: each assertion below checks the sentence a plugin author would see, not
 * just that something threw.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  allBlocks,
  builtinBlocks,
  clearRegistry,
  defineBlock,
  getBlockDef,
  hasBlock,
  parsableBlocks,
  registerBlock,
  requireBlockDef,
  unregisterBlock,
  validateBlockDef,
} from '../../src/core/index.js'

/** Types this file registers, torn down after each spec so nothing leaks. */
const scratch = new Set()

/**
 * @param {Partial<import('../../src/core/types.js').BlockDef>} [overrides]
 * @returns {any}
 */
function definition(overrides = {}) {
  return {
    type: 'spec-widget',
    label: 'Widget',
    defaultProps: { title: 'Hi' },
    render: { html: () => '<div>widget</div>' },
    ...overrides,
  }
}

/**
 * @param {any} def
 * @returns {import('../../src/core/types.js').BlockDef}
 */
function register(def) {
  scratch.add(def.type)
  return defineBlock(def)
}

afterEach(() => {
  for (const type of scratch) unregisterBlock(type)
  scratch.clear()
  vi.restoreAllMocks()
})

describe('validateBlockDef()', () => {
  it('accepts the minimum viable definition and freezes a copy of it', () => {
    const def = definition()
    const validated = validateBlockDef(def)
    expect(validated).not.toBe(def)
    expect(Object.isFrozen(validated)).toBe(true)
    expect(validated.type).toBe('spec-widget')
  })

  it('names the missing piece, and the block it is missing from', () => {
    expect(() => validateBlockDef(/** @type {any} */ (null))).toThrow(
      /defineBlock\(\) expects a definition object/,
    )
    expect(() => validateBlockDef(definition({ type: '  ' }))).toThrow(
      /requires a non-empty string `type`/,
    )
    expect(() => validateBlockDef(definition({ label: '' }))).toThrow(
      /block "spec-widget" is missing `label`/,
    )
    expect(() => validateBlockDef(definition({ defaultProps: /** @type {any} */ (null) }))).toThrow(
      /is missing `defaultProps`/,
    )
    expect(() => validateBlockDef(definition({ render: /** @type {any} */ (undefined) }))).toThrow(
      /is missing `render`/,
    )
  })

  it('explains why html is the one renderer that cannot be skipped', () => {
    expect(() => validateBlockDef(definition({ render: /** @type {any} */ ({}) }))).toThrow(
      /HTML is the only required target/,
    )
  })

  it('rejects a non-function where a function belongs', () => {
    for (const target of ['jsx', 'mjml', 'text']) {
      const render = { html: () => '', [target]: 'nope' }
      expect(() => validateBlockDef(definition({ render: /** @type {any} */ (render) }))).toThrow(
        new RegExp(`non-function \\\`render.${target}\\\``),
      )
    }
    expect(() => validateBlockDef(definition({ lint: /** @type {any} */ (1) }))).toThrow(
      /non-function `lint`/,
    )
    expect(() => validateBlockDef(definition({ parse: /** @type {any} */ ('x') }))).toThrow(
      /non-function `parse`/,
    )
  })

  it('checks every field of a schema, by index', () => {
    /** @param {any} field */
    const withField = (field) => definition({ schema: [field] })

    expect(() => validateBlockDef(definition({ schema: /** @type {any} */ ({}) }))).toThrow(
      /non-array `schema`/,
    )
    expect(() => validateBlockDef(withField(null))).toThrow(/schema\[0\] is not a field object/)
    expect(() => validateBlockDef(withField({ label: 'A', type: 'text' }))).toThrow(
      /schema\[0\] is missing `key`/,
    )
    expect(() => validateBlockDef(withField({ key: 'title', type: 'text' }))).toThrow(
      /\("title"\) is missing `label`/,
    )
  })

  it('lists the known field types when it meets one it does not know', () => {
    let message = ''
    try {
      const schema = /** @type {any} */ ([{ key: 'title', label: 'T', type: 'slider' }])
      validateBlockDef(definition({ schema }))
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('unknown type "slider"')
    expect(message).toContain('richtext')
    expect(message).toContain('spacing')
  })

  it('requires the extras that a select and a list cannot work without', () => {
    expect(() =>
      validateBlockDef(definition({ schema: [{ key: 'title', label: 'T', type: 'select' }] })),
    ).toThrow(/is a select and needs `options`/)
    expect(() =>
      validateBlockDef(
        definition({
          defaultProps: { items: [] },
          schema: [{ key: 'items', label: 'Items', type: 'list' }],
        }),
      ),
    ).toThrow(/is a list and needs `itemSchema`/)
  })

  it('catches a field that edits a prop the defaults never declared', () => {
    expect(() =>
      validateBlockDef(definition({ schema: [{ key: 'missing', label: 'M', type: 'text' }] })),
    ).toThrow(/`defaultProps.missing` does not exist/)

    // A dotted key is checked at its root, so `padding.top` needs `padding`.
    expect(() =>
      validateBlockDef(
        definition({
          defaultProps: { title: 'Hi', padding: { top: 0 } },
          schema: [{ key: 'padding.top', label: 'Top', type: 'number' }],
        }),
      ),
    ).not.toThrow()
  })

  it('freezes shallowly, so consumers can still map over the schema', () => {
    const validated = validateBlockDef(
      definition({ schema: [{ key: 'title', label: 'Title', type: 'text' }] }),
    )
    expect(Object.isFrozen(validated.schema)).toBe(false)
    expect(validated.schema?.map((field) => field.key)).toEqual(['title'])
  })
})

describe('defineBlock() / registerBlock()', () => {
  it('registers the frozen definition it returns', () => {
    const returned = register(definition())
    expect(hasBlock('spec-widget')).toBe(true)
    expect(getBlockDef('spec-widget')).toBe(returned)
  })

  it('replaces a re-registered type with a warning instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    register(definition({ label: 'First' }))
    register(definition({ label: 'Second' }))

    expect(getBlockDef('spec-widget')?.label).toBe('Second')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toMatch(/already registered — replacing it/)
  })

  it('short-circuits when the exact same object is registered again', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const def = register(definition())
    expect(registerBlock(def)).toBe(def)
    expect(warn).not.toHaveBeenCalled()
  })

  it('unregisters, and says whether anything was there', () => {
    register(definition())
    expect(unregisterBlock('spec-widget')).toBe(true)
    expect(unregisterBlock('spec-widget')).toBe(false)
    expect(hasBlock('spec-widget')).toBe(false)
  })
})

describe('lookups', () => {
  it('requireBlockDef names the registered types when it fails', () => {
    expect(getBlockDef('nope')).toBeUndefined()
    let message = ''
    try {
      requireBlockDef('nope')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('unknown block type "nope"')
    expect(message).toContain('Registered: text, heading')
  })

  it('returns the definition when there is one', () => {
    expect(requireBlockDef('text').label).toBe('Text')
  })

  it('lists the built-ins in registration order', () => {
    const types = allBlocks().map((def) => def.type)
    expect(types.slice(0, 10)).toEqual([
      'text',
      'heading',
      'image',
      'button',
      'divider',
      'spacer',
      'social',
      'menu',
      'html',
      'videoThumb',
    ])
  })
})

describe('parsableBlocks()', () => {
  it('keeps only definitions with a parse hook, most specific first', () => {
    const types = parsableBlocks().map((def) => def.type)
    expect(types).not.toContain('html')
    expect(types).toEqual([
      'image',
      'videoThumb',
      'button',
      'menu',
      'social',
      'divider',
      'spacer',
      'heading',
      'text',
    ])
  })

  it('slots a custom parser in by its declared priority', () => {
    register(definition({ importPriority: 95, parse: () => ({ title: 'x' }) }))
    expect(parsableBlocks()[0].type).toBe('spec-widget')
  })

  it('puts a parser with no declared priority last', () => {
    register(definition({ parse: () => null }))
    const types = parsableBlocks().map((def) => def.type)
    expect(types[types.length - 1]).toBe('spec-widget')
  })
})

// Last in the file on purpose: emptying the registry would strand every spec
// that runs after it.
describe('clearRegistry()', () => {
  it('empties the registry, and the built-ins can be put back', () => {
    clearRegistry()
    expect(allBlocks()).toEqual([])
    expect(hasBlock('text')).toBe(false)

    for (const def of builtinBlocks) registerBlock(def)
    expect(allBlocks()).toHaveLength(builtinBlocks.length)
  })
})
