/**
 * Merge variables — pillar 4.
 *
 * The sample object *is* the schema, so most of these specs are about one walk
 * of that object feeding four different consumers: autocomplete, the linter, the
 * preview, and the props of the ejected component.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  FOREIGN_VAR_SYNTAXES,
  VAR_PATTERN,
  createBlock,
  defineVars,
  documentLocalVars,
  documentVarPaths,
  emitPropsInterface,
  emitPropsJsdoc,
  findVarPaths,
  foreignVarsToMailkiln,
  getPath,
  interpolate,
  kindOf,
  optionalChain,
  resetIds,
  setCondition,
  setRepeat,
  tsTypeForRoot,
  varRoots,
  walkSample,
} from '../../src/core/index.js'
import { allBlocksIn, docOf, firstRowId, sampleVars } from '../support/kit.js'

afterEach(() => resetIds())

describe('kindOf()', () => {
  it('names the kinds the walker branches on', () => {
    expect(kindOf('a')).toBe('string')
    expect(kindOf(1)).toBe('number')
    expect(kindOf(false)).toBe('boolean')
    expect(kindOf([])).toBe('array')
    expect(kindOf({})).toBe('object')
    expect(kindOf(null)).toBe('unknown')
    expect(kindOf(undefined)).toBe('unknown')
    expect(kindOf(() => {})).toBe('unknown')
  })
})

describe('walkSample()', () => {
  it('flattens nested objects into dotted paths, marking the interpolatable ones', () => {
    const paths = walkSample({ user: { name: 'Ada', pro: true } })
    const byPath = new Map(paths.map((p) => [p.path, p]))

    expect([...byPath.keys()]).toEqual(['user', 'user.name', 'user.pro'])
    expect(byPath.get('user')?.leaf).toBe(false)
    expect(byPath.get('user.name')).toMatchObject({ kind: 'string', sample: 'Ada', leaf: true })
    expect(byPath.get('user.pro')?.kind).toBe('boolean')
  })

  it('exposes an array as its length plus the shape of one item', () => {
    const paths = walkSample({ items: [{ title: 'Kiln' }] }).map((p) => p.path)
    expect(paths).toContain('items.length')
    expect(paths).toContain('items[0].title')
  })

  it('offers only the length of an empty array', () => {
    const paths = walkSample({ items: [] }).map((p) => p.path)
    expect(paths).toEqual(['items', 'items.length'])
  })

  it('stops descending before a deep object can run away', () => {
    /** @type {any} */
    let deep = { end: 'here' }
    for (let i = 0; i < 10; i += 1) deep = { nest: deep }
    const depths = walkSample(deep).map((p) => p.path.split('.').length)
    expect(Math.max(...depths)).toBeLessThanOrEqual(7)
  })

  it('treats a missing sample as an empty one', () => {
    expect(walkSample(/** @type {any} */ (undefined))).toEqual([])
  })
})

describe('getPath() / optionalChain()', () => {
  it('reads dotted and indexed paths, and stops at the first gap', () => {
    const data = { order: { items: [{ title: 'Kiln' }] } }
    expect(getPath(data, 'order.items[0].title')).toBe('Kiln')
    expect(getPath(data, 'order.items[3].title')).toBeUndefined()
    expect(getPath(data, 'missing.deep.value')).toBeUndefined()
    expect(getPath(data, '')).toBeUndefined()
  })

  it('makes every step after the root optional, so ejected code cannot throw', () => {
    expect(optionalChain('user.name')).toBe('user?.name')
    expect(optionalChain('order.items[0].title')).toBe('order?.items?.[0]?.title')
    expect(optionalChain('user')).toBe('user')
  })
})

describe('defineVars()', () => {
  it('indexes the sample so `has` is a lookup rather than a re-walk', () => {
    const vars = sampleVars()
    expect(vars.has('user.name')).toBe(true)
    expect(vars.has('user.nmae')).toBe(false)
    expect(vars.get('order.items[1].title')).toBe('Clay')
  })

  it('refuses anything but a plain object as the sample', () => {
    expect(() => defineVars({ sample: /** @type {any} */ ([1, 2]) })).toThrow(
      /expects `sample` to be a plain object/,
    )
  })

  it('defaults to an empty sample and empty overrides', () => {
    const vars = defineVars()
    expect(vars.paths).toEqual([])
    expect(vars.types).toEqual({})
  })
})

describe('findVarPaths()', () => {
  it('finds each path once, in order, and tolerates whitespace', () => {
    expect(findVarPaths('Hi {{ user.name }}, order {{order.id}} — {{user.name}}')).toEqual([
      'user.name',
      'order.id',
    ])
  })

  it('returns nothing for text with no tags at all', () => {
    expect(findVarPaths('plain copy')).toEqual([])
    expect(findVarPaths(/** @type {any} */ (null))).toEqual([])
  })

  it('ignores a tag that is not a valid path', () => {
    expect(findVarPaths('{{ 9lives }} {{ user-name }}')).toEqual([])
  })

  it('exposes a pattern that is safe to reuse, despite the global flag', () => {
    expect(VAR_PATTERN.global).toBe(true)
    expect(findVarPaths('{{a}}')).toEqual(['a'])
    expect(findVarPaths('{{a}}')).toEqual(['a'])
  })
})

describe('interpolate()', () => {
  it('substitutes leaf values, coercing numbers and booleans', () => {
    const vars = sampleVars()
    expect(interpolate('Hi {{user.name}} — {{user.visits}} visits', vars)).toBe(
      'Hi Ada — 12 visits',
    )
    expect(interpolate('{{user.pro}}', vars)).toBe('true')
  })

  it('leaves an unknown tag visible rather than rendering an empty string', () => {
    expect(interpolate('Hi {{user.nmae}}', sampleVars())).toBe('Hi {{user.nmae}}')
  })

  it('leaves a tag that resolves to an object or an array alone', () => {
    expect(interpolate('{{order.items}} {{user}}', sampleVars())).toBe('{{order.items}} {{user}}')
  })

  it('accepts a bare data object as well as a VarsDef', () => {
    expect(interpolate('{{a.b}}', { a: { b: 'c' } })).toBe('c')
    expect(interpolate('{{a}}', null)).toBe('{{a}}')
  })

  it('passes non-strings and tag-free strings straight through', () => {
    expect(interpolate('nothing here', sampleVars())).toBe('nothing here')
    expect(interpolate(/** @type {any} */ (undefined), sampleVars())).toBe('')
  })
})

describe('varRoots()', () => {
  it('reduces paths to the identifiers the component destructures', () => {
    expect(varRoots(['user.name', 'user.email', 'order.items[0].title'])).toEqual(['order', 'user'])
  })

  it('is sorted, so the exported signature is stable', () => {
    expect(varRoots(['z.a', 'a.z'])).toEqual(['a', 'z'])
  })
})

describe('documentVarPaths()', () => {
  it('collects tags from settings and from every string prop of every block', () => {
    const doc = docOf(
      [
        createBlock('text', { text: 'Hi {{user.name}}' }),
        createBlock('button', { href: '{{order.url}}', text: 'View' }),
      ],
      { settings: { preheader: 'Your {{order.id}} shipped', subject: '{{user.name}}, thanks' } },
    )
    expect(documentVarPaths(doc).sort()).toEqual(['order.id', 'order.url', 'user.name'])
  })

  it('includes paths that appear only in a condition or a repeat', () => {
    let doc = docOf([createBlock('divider')])
    doc = setCondition(doc, doc.sections[0].id, { path: 'user.pro', op: 'truthy' })
    doc = setRepeat(doc, firstRowId(doc), { path: 'order.items', as: 'item' })

    expect(documentVarPaths(doc)).toContain('user.pro')
    expect(documentVarPaths(doc)).toContain('order.items')
  })

  it('drops loop variables, which are in scope rather than declared', () => {
    let doc = docOf([createBlock('text', { text: '{{item.title}} for {{user.name}}' })])
    doc = setRepeat(doc, firstRowId(doc), { path: 'order.items', as: 'item' })

    const paths = documentVarPaths(doc)
    expect(paths).toContain('user.name')
    expect(paths).toContain('order.items')
    expect(paths).not.toContain('item.title')
  })

  it('survives an empty document', () => {
    expect(documentVarPaths(/** @type {any} */ (null))).toEqual([])
  })
})

describe('documentLocalVars()', () => {
  it('reports the loop variable and its index companion', () => {
    let doc = docOf([createBlock('text')])
    doc = setRepeat(doc, firstRowId(doc), { path: 'order.items', as: 'item' })
    expect([...documentLocalVars(doc)].sort()).toEqual(['item', 'itemIndex'])
  })

  it('is empty when nothing repeats', () => {
    expect(documentLocalVars(docOf()).size).toBe(0)
  })
})

describe('type emission', () => {
  it('derives a TypeScript type from the sample value', () => {
    const vars = sampleVars()
    expect(tsTypeForRoot(vars, 'user')).toBe('{ name: string; pro: boolean; visits: number }')
    expect(tsTypeForRoot(vars, 'order')).toContain('items: Array<{ title: string; price: number }>')
  })

  it('honours a whole-root override', () => {
    const vars = defineVars({ sample: { order: { total: 0 } }, types: { order: 'Order' } })
    expect(tsTypeForRoot(vars, 'order')).toBe('Order')
  })

  it('rebuilds the object so a nested override lands in the right place', () => {
    const vars = defineVars({
      sample: { order: { id: 'A-1', total: 0 } },
      types: { 'order.total': 'number | null' },
    })
    expect(tsTypeForRoot(vars, 'order')).toBe('{ id: string; total: number | null }')
  })

  it('describes empty containers and unknown values honestly', () => {
    const vars = defineVars({ sample: { a: {}, b: [], c: null } })
    expect(tsTypeForRoot(vars, 'a')).toBe('Record<string, unknown>')
    expect(tsTypeForRoot(vars, 'b')).toBe('Array<unknown>')
    expect(tsTypeForRoot(vars, 'c')).toBe('unknown')
  })

  it('quotes a key that is not a valid identifier', () => {
    const vars = defineVars({ sample: { data: { 'first-name': 'Ada' } } })
    expect(tsTypeForRoot(vars, 'data')).toBe('{ "first-name": string }')
  })

  it('emits an interface for the roots a template uses, and nothing when it uses none', () => {
    const vars = sampleVars()
    expect(emitPropsInterface('WelcomeProps', vars, ['user'])).toBe(
      'export interface WelcomeProps {\n  user: { name: string; pro: boolean; visits: number }\n}',
    )
    expect(emitPropsInterface('WelcomeProps', vars, [])).toBe('')
    expect(emitPropsInterface('WelcomeProps', null, ['user'])).toContain('user: unknown')
  })

  it('emits the JSDoc equivalent for the plain-JSX export', () => {
    const doc = emitPropsJsdoc(sampleVars(), ['user'])
    expect(doc.startsWith('/**')).toBe(true)
    expect(doc).toContain('@param {{ user: { name: string; pro: boolean; visits: number } }} props')
    expect(emitPropsJsdoc(sampleVars(), [])).toBe('')
  })
})

describe('foreignVarsToMailkiln()', () => {
  it('rewrites the syntaxes it runs by default and reports what it found', () => {
    const mailchimp = foreignVarsToMailkiln('Hi *|FNAME|*, see *|MERGE:CITY|*')
    expect(mailchimp.text).toBe('Hi {{fname}}, see {{merge.city}}')
    expect(mailchimp.found).toEqual(['fname', 'merge.city'])

    expect(foreignVarsToMailkiln('%recipient:name%').text).toBe('{{name}}')
    expect(foreignVarsToMailkiln('%%ORDER_ID%%').text).toBe('{{order_id}}')
  })

  it('leaves the ambiguous SendGrid syntax alone unless it is asked for', () => {
    expect(foreignVarsToMailkiln('our cutting-edge-tools').text).toBe('our cutting-edge-tools')
    expect(foreignVarsToMailkiln('Hi -name-', { only: ['sendgrid'] }).text).toBe('Hi {{name}}')
  })

  it('runs exactly the syntaxes named in `only`', () => {
    expect(foreignVarsToMailkiln('*|FNAME|* %%X%%', { only: ['percent'] }).text).toBe(
      '*|FNAME|* {{x}}',
    )
  })

  it('passes through text with nothing to rewrite', () => {
    expect(foreignVarsToMailkiln('plain')).toEqual({ text: 'plain', found: [] })
    expect(foreignVarsToMailkiln(/** @type {any} */ (null))).toEqual({ text: '', found: [] })
  })

  it('declares which syntaxes are safe to run unasked', () => {
    const optIn = FOREIGN_VAR_SYNTAXES.filter((s) => !s.enabledByDefault).map((s) => s.id)
    expect(optIn).toEqual(['sendgrid'])
  })
})

describe('the loop closes', () => {
  it('a path used in a block becomes a declared-or-not answer from the same vars', () => {
    const doc = docOf([createBlock('text', { text: 'Hi {{user.name}} and {{user.nmae}}' })])
    const vars = sampleVars()
    const used = documentVarPaths(doc)
    const undeclared = used.filter((path) => !vars.has(path))

    expect(used).toHaveLength(2)
    expect(undeclared).toEqual(['user.nmae'])
    expect(allBlocksIn(doc)).toHaveLength(1)
  })
})
