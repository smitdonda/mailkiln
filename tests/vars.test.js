import { describe, expect, it } from 'vitest'
import {
  defineVars,
  documentVarPaths,
  emitPropsInterface,
  emitPropsJsdoc,
  findVarPaths,
  foreignVarsToMailkiln,
  getPath,
  interpolate,
  kindOf,
  tsTypeForRoot,
  varRoots,
  walkSample,
} from '../src/core/index.js'
import { kitchenSinkDocument, sampleVars } from './helpers.js'

describe('walkSample', () => {
  it('derives every path from the sample — the sample IS the schema', () => {
    const paths = walkSample({ user: { name: 'Smit' }, total: 42, ok: true }).map((p) => p.path)
    expect(paths).toEqual(['user', 'user.name', 'total', 'ok'])
  })

  it('marks only interpolatable values as leaves', () => {
    const paths = walkSample({ user: { name: 'Smit' } })
    expect(paths.find((p) => p.path === 'user')?.leaf).toBe(false)
    expect(paths.find((p) => p.path === 'user.name')?.leaf).toBe(true)
  })

  it('exposes an array as [0] plus length rather than pretending merge tags can loop', () => {
    const paths = walkSample({ items: [{ title: 'Keyboard' }] }).map((p) => p.path)
    expect(paths).toContain('items.length')
    expect(paths).toContain('items[0]')
    expect(paths).toContain('items[0].title')
  })

  it('records each value kind', () => {
    expect(kindOf('a')).toBe('string')
    expect(kindOf(1)).toBe('number')
    expect(kindOf(true)).toBe('boolean')
    expect(kindOf([])).toBe('array')
    expect(kindOf({})).toBe('object')
    expect(kindOf(null)).toBe('unknown')
    expect(kindOf(undefined)).toBe('unknown')
  })
})

describe('defineVars', () => {
  it('rejects a non-object sample', () => {
    expect(() => defineVars({ sample: /** @type {any} */ ([]) })).toThrow(/plain object/)
    expect(() => defineVars({ sample: /** @type {any} */ ('nope') })).toThrow(/plain object/)
  })

  it('answers has() and get()', () => {
    expect(sampleVars.has('user.name')).toBe(true)
    expect(sampleVars.has('user.nmae')).toBe(false)
    expect(sampleVars.get('order.total')).toBe(4200)
  })

  it('defaults to an empty sample', () => {
    expect(defineVars().paths).toEqual([])
  })
})

describe('getPath', () => {
  it('reads dotted and indexed paths', () => {
    const data = { a: { b: [{ c: 1 }] } }
    expect(getPath(data, 'a.b[0].c')).toBe(1)
    expect(getPath(data, 'a.b.0.c')).toBe(1)
  })

  it('returns undefined instead of throwing on a missing branch', () => {
    expect(getPath({}, 'a.b.c')).toBeUndefined()
    expect(getPath(null, 'a')).toBeUndefined()
    expect(getPath({ a: 1 }, '')).toBeUndefined()
  })
})

describe('findVarPaths', () => {
  it('finds each path once, in order', () => {
    expect(findVarPaths('Hi {{user.name}}, {{order.id}} and {{user.name}}')).toEqual([
      'user.name',
      'order.id',
    ])
  })

  it('tolerates whitespace inside the braces', () => {
    expect(findVarPaths('{{  user.name  }}')).toEqual(['user.name'])
  })

  it('ignores non-paths and non-strings', () => {
    expect(findVarPaths('{{ }}')).toEqual([])
    expect(findVarPaths('{{1abc}}')).toEqual([])
    expect(findVarPaths(/** @type {any} */ (null))).toEqual([])
  })
})

describe('interpolate', () => {
  it('substitutes declared paths', () => {
    expect(interpolate('Hi {{user.name}}', sampleVars)).toBe('Hi Smit')
    expect(interpolate('Total {{order.total}}', sampleVars)).toBe('Total 4200')
  })

  it('leaves an unknown path visible rather than rendering an empty string', () => {
    // A silently-blank merge tag is how broken emails reach inboxes; leaving the
    // tag visible means the preview shows the problem and the linter can flag it.
    expect(interpolate('Hi {{user.nmae}}', sampleVars)).toBe('Hi {{user.nmae}}')
  })

  it('leaves object-valued paths alone', () => {
    expect(interpolate('{{user}}', sampleVars)).toBe('{{user}}')
  })

  it('accepts a bare sample object as well as a VarsDef', () => {
    expect(interpolate('Hi {{name}}', { name: 'Ada' })).toBe('Hi Ada')
  })

  it('passes non-templates straight through', () => {
    expect(interpolate('plain', sampleVars)).toBe('plain')
    expect(interpolate(/** @type {any} */ (undefined), sampleVars)).toBe('')
  })
})

describe('varRoots and documentVarPaths', () => {
  it('extracts sorted, de-duplicated roots', () => {
    expect(varRoots(['user.name', 'order.id', 'user.email', 'items[0].title'])).toEqual([
      'items',
      'order',
      'user',
    ])
  })

  it('finds paths in block props, subject and preheader', () => {
    const paths = documentVarPaths(kitchenSinkDocument())
    expect(paths).toContain('order.eta')
    expect(paths).toContain('user.name')
    expect(paths).toContain('order.id')
    expect(paths).toContain('unsubscribe_url')
  })
})

describe('TypeScript emission', () => {
  it('builds an interface from the sample shape', () => {
    const emitted = emitPropsInterface('WelcomeProps', sampleVars, ['user', 'order'])
    expect(emitted).toContain('export interface WelcomeProps {')
    expect(emitted).toContain('user: { name: string; email: string }')
    expect(emitted).toContain('total: number')
    expect(emitted).toContain('items: Array<{ title: string }>')
  })

  it('emits nothing when a template uses no variables', () => {
    expect(emitPropsInterface('P', sampleVars, [])).toBe('')
    expect(emitPropsJsdoc(sampleVars, [])).toBe('')
  })

  it('emits a JSDoc param block for the plain-JSX export', () => {
    const emitted = emitPropsJsdoc(sampleVars, ['user'])
    expect(emitted).toContain('@param {{ user: { name: string; email: string } }} props')
  })

  it('honours an explicit type override', () => {
    const vars = defineVars({
      sample: { order: { total: 4200, currency: 'GBP' } },
      types: { 'order.currency': "'GBP' | 'USD'" },
    })
    expect(tsTypeForRoot(vars, 'order')).toBe("{ total: number; currency: 'GBP' | 'USD' }")
  })

  it('honours a root-level override', () => {
    const vars = defineVars({ sample: { order: {} }, types: { order: 'Order' } })
    expect(tsTypeForRoot(vars, 'order')).toBe('Order')
  })

  it('falls back to unknown for null and empty values', () => {
    const vars = defineVars({ sample: { a: null, b: {}, c: [] } })
    expect(tsTypeForRoot(vars, 'a')).toBe('unknown')
    expect(tsTypeForRoot(vars, 'b')).toBe('Record<string, unknown>')
    expect(tsTypeForRoot(vars, 'c')).toBe('Array<unknown>')
  })
})

describe('foreign merge syntaxes', () => {
  it('converts Mailchimp tags', () => {
    const { text, found } = foreignVarsToMailkiln('Hi *|FNAME|*, spend *|USER:SPEND|*')
    expect(text).toBe('Hi {{fname}}, spend {{user.spend}}')
    expect(found).toEqual(['fname', 'user.spend'])
  })

  it('converts Mailgun recipient variables', () => {
    expect(foreignVarsToMailkiln('Hi %recipient:name%').text).toBe('Hi {{name}}')
    expect(foreignVarsToMailkiln('Hi %recipient.first_name%').text).toBe('Hi {{first_name}}')
  })

  it('converts generic %%NAME%% tags', () => {
    expect(foreignVarsToMailkiln('Hi %%FIRST_NAME%%').text).toBe('Hi {{first_name}}')
  })

  it('leaves hyphenated prose alone by keeping the SendGrid syntax opt-in', () => {
    // `-name-` is too ambiguous to run unasked: it would rewrite "cutting-edge".
    expect(foreignVarsToMailkiln('a cutting-edge design').text).toBe('a cutting-edge design')
    expect(foreignVarsToMailkiln('hi -name- there', { only: ['sendgrid'] }).text).toBe(
      'hi {{name}} there',
    )
  })

  it('passes through text with no merge tags', () => {
    expect(foreignVarsToMailkiln('nothing here')).toEqual({ text: 'nothing here', found: [] })
    expect(foreignVarsToMailkiln(/** @type {any} */ (null)).text).toBe('')
  })
})
