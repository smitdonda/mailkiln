import { describe, expect, it, vi } from 'vitest'
import {
  allBlocks,
  builtinBlocks,
  defineBlock,
  getBlockDef,
  hasBlock,
  parsableBlocks,
  registerBlock,
  requireBlockDef,
  unregisterBlock,
  validateBlockDef,
} from '../src/core/index.js'

/**
 * A minimal valid definition, so each test can break exactly one thing.
 *
 * @param {Record<string, any>} [overrides]
 * @returns {any}
 */
function validDef(overrides = {}) {
  return {
    type: 'test-block',
    label: 'Test',
    defaultProps: { text: 'hi' },
    render: { html: () => '<p>hi</p>' },
    ...overrides,
  }
}

describe('validateBlockDef', () => {
  it('accepts a minimal definition', () => {
    expect(() => validateBlockDef(validDef())).not.toThrow()
  })

  it('names the block and the fix in every message', () => {
    // This is the whole point of registration-time validation in a JS library:
    // the error has to say what to do, because there is no compiler to point at
    // the line.
    expect(() => validateBlockDef(validDef({ type: '' }))).toThrow(/non-empty string `type`/)
    expect(() => validateBlockDef(validDef({ label: undefined }))).toThrow(
      /block "test-block" is missing `label`/,
    )
    expect(() => validateBlockDef(validDef({ defaultProps: undefined }))).toThrow(
      /missing `defaultProps`/,
    )
    expect(() => validateBlockDef(validDef({ render: undefined }))).toThrow(/missing `render`/)
    expect(() => validateBlockDef(validDef({ render: {} }))).toThrow(/missing `render.html`/)
  })

  it('rejects non-function renderers and hooks', () => {
    expect(() => validateBlockDef(validDef({ render: { html: () => '', jsx: 'nope' } }))).toThrow(
      /non-function `render.jsx`/,
    )
    expect(() => validateBlockDef(validDef({ lint: 'nope' }))).toThrow(/non-function `lint`/)
    expect(() => validateBlockDef(validDef({ parse: 42 }))).toThrow(/non-function `parse`/)
  })

  it('rejects a schema field whose key is missing from defaultProps', () => {
    expect(() =>
      validateBlockDef(
        validDef({ schema: [{ key: 'nope', type: 'text', label: 'Nope' }] }),
      ),
    ).toThrow(/`defaultProps.nope` does not exist/)
  })

  it('accepts a dotted schema key when its root exists', () => {
    expect(() =>
      validateBlockDef(
        validDef({
          defaultProps: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
          schema: [{ key: 'padding.top', type: 'number', label: 'Top' }],
        }),
      ),
    ).not.toThrow()
  })

  it('rejects unknown field types, and lists the known ones', () => {
    expect(() =>
      validateBlockDef(validDef({ schema: [{ key: 'text', type: 'wat', label: 'Text' }] })),
    ).toThrow(/unknown type "wat". Known types: text, textarea/)
  })

  it('requires options on a select and itemSchema on a list', () => {
    expect(() =>
      validateBlockDef(validDef({ schema: [{ key: 'text', type: 'select', label: 'T' }] })),
    ).toThrow(/needs `options`/)
    expect(() =>
      validateBlockDef(validDef({ schema: [{ key: 'text', type: 'list', label: 'T' }] })),
    ).toThrow(/needs `itemSchema`/)
  })

  it('requires a label on each field', () => {
    expect(() => validateBlockDef(validDef({ schema: [{ key: 'text', type: 'text' }] }))).toThrow(
      /is missing `label`/,
    )
  })

  it('freezes the definition it returns', () => {
    const def = validateBlockDef(validDef())
    expect(Object.isFrozen(def)).toBe(true)
  })

  it('leaves schema mutable so consumers can map over it without copying', () => {
    const def = validateBlockDef(
      validDef({ schema: [{ key: 'text', type: 'text', label: 'Text' }] }),
    )
    expect(Array.isArray(def.schema)).toBe(true)
    expect(() => def.schema?.map((f) => f.key)).not.toThrow()
  })
})

describe('registry', () => {
  it('registers and looks up a block', () => {
    const def = defineBlock(validDef({ type: 'registry-probe' }))
    expect(hasBlock('registry-probe')).toBe(true)
    expect(getBlockDef('registry-probe')).toBe(def)
    expect(allBlocks()).toContain(def)
    expect(unregisterBlock('registry-probe')).toBe(true)
    expect(hasBlock('registry-probe')).toBe(false)
  })

  it('replaces a duplicate type with a warning instead of throwing', () => {
    // Throwing here would break Fast Refresh: a module calling defineBlock at
    // top level re-runs on every save and produces a new definition object.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    defineBlock(validDef({ type: 'dupe-probe', label: 'First' }))
    const second = defineBlock(validDef({ type: 'dupe-probe', label: 'Second' }))

    expect(getBlockDef('dupe-probe')).toBe(second)
    expect(getBlockDef('dupe-probe')?.label).toBe('Second')
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/already registered — replacing it/))
    warn.mockRestore()
    unregisterBlock('dupe-probe')
  })

  it('does not warn when the identical object is registered again', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const def = defineBlock(validDef({ type: 'same-object' }))
    expect(registerBlock(def)).toBe(def)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
    unregisterBlock('same-object')
  })

  it('lists the registered types when asked for an unknown one', () => {
    expect(() => requireBlockDef('ghost')).toThrow(/unknown block type "ghost". Registered: text/)
  })

  it('registers all ten built-ins through the public API', () => {
    expect(builtinBlocks).toHaveLength(10)
    for (const def of builtinBlocks) {
      expect(getBlockDef(def.type)).toBe(def)
    }
  })

  it('orders parsable blocks by descending import priority', () => {
    const priorities = parsableBlocks().map((def) => def.importPriority ?? 0)
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a))
    // Text is the catch-all and must come last, or it swallows every element.
    expect(parsableBlocks().at(-1)?.type).toBe('text')
  })

  it('gives every built-in a schema whose keys all exist in defaultProps', () => {
    for (const def of builtinBlocks) {
      for (const field of def.schema ?? []) {
        expect(def.defaultProps).toHaveProperty(field.key.split('.')[0])
      }
    }
  })
})
