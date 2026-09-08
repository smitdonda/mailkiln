/**
 * Display conditions and repeats.
 *
 * The pair that has to agree is `evaluateCondition` (what the preview shows) and
 * `conditionExpression` (what the ejected component compiles to). Several specs
 * below assert them side by side for that reason.
 */

import { describe, expect, it } from 'vitest'
import {
  CONDITION_OPS,
  DEFAULT_PREVIEW_COUNT,
  coerceValue,
  conditionDraft,
  conditionExpression,
  conditionPaths,
  conditionSummary,
  evaluateCondition,
  normalizeCondition,
  normalizeRepeat,
  repeatDraft,
  repeatPaths,
  repeatScopes,
} from '../../src/core/index.js'

const data = {
  user: { pro: true, plan: 'team', trialDays: 0, tags: [] },
  order: { total: 120, items: [{ title: 'Kiln' }, { title: 'Clay' }], note: '' },
}

describe('CONDITION_OPS', () => {
  it('declares which operators take a value', () => {
    expect(Object.keys(CONDITION_OPS)).toEqual([
      'truthy',
      'falsy',
      'notEmpty',
      'empty',
      'eq',
      'ne',
      'gt',
      'lt',
    ])
    expect(CONDITION_OPS.truthy.needsValue).toBe(false)
    expect(CONDITION_OPS.gt.needsValue).toBe(true)
  })
})

describe('coerceValue()', () => {
  it('turns the strings an input produces into comparable values', () => {
    expect(coerceValue('100')).toBe(100)
    expect(coerceValue(' 2.5 ')).toBe(2.5)
    expect(coerceValue('true')).toBe(true)
    expect(coerceValue('false')).toBe(false)
    expect(coerceValue('team')).toBe('team')
  })

  it('leaves real numbers and booleans as they are', () => {
    expect(coerceValue(7)).toBe(7)
    expect(coerceValue(false)).toBe(false)
  })

  it('reads nothing as the empty string', () => {
    expect(coerceValue(null)).toBe('')
    expect(coerceValue(undefined)).toBe('')
  })
})

describe('normalizeCondition()', () => {
  it('accepts a complete condition and coerces its value once', () => {
    expect(normalizeCondition({ path: ' order.total ', op: 'gt', value: '100' })).toEqual({
      path: 'order.total',
      op: 'gt',
      value: 100,
    })
  })

  it('drops the value for operators that take none', () => {
    expect(normalizeCondition({ path: 'user.pro', op: 'truthy', value: 'x' })).toEqual({
      path: 'user.pro',
      op: 'truthy',
    })
  })

  it('rejects anything a reader must not act on', () => {
    expect(normalizeCondition(null)).toBeNull()
    expect(normalizeCondition('user.pro')).toBeNull()
    expect(normalizeCondition({ path: '', op: 'truthy' })).toBeNull()
    expect(normalizeCondition({ path: 'user.pro', op: 'matches' })).toBeNull()
  })

  it('defaults a missing operator to truthy', () => {
    expect(normalizeCondition({ path: 'user.pro' })).toEqual({ path: 'user.pro', op: 'truthy' })
  })
})

describe('conditionDraft()', () => {
  it('keeps an empty path, so the Inspector switch can be flipped before typing', () => {
    expect(conditionDraft({ path: '', op: 'truthy' })).toEqual({ path: '', op: 'truthy' })
    expect(normalizeCondition(conditionDraft({ path: '', op: 'truthy' }))).toBeNull()
  })

  it('falls back to truthy for an unknown operator, and adds the value slot', () => {
    expect(conditionDraft({ path: 'a', op: 'nope' })).toEqual({ path: 'a', op: 'truthy' })
    expect(conditionDraft({ path: 'a', op: 'eq' })).toEqual({ path: 'a', op: 'eq', value: '' })
  })

  it('is null for a non-object', () => {
    expect(conditionDraft(undefined)).toBeNull()
  })
})

describe('evaluateCondition()', () => {
  it('shows the node when there is no usable condition — the safe direction', () => {
    expect(evaluateCondition(null, data)).toBe(true)
    expect(evaluateCondition({ path: '', op: 'truthy' }, data)).toBe(true)
  })

  it('handles the value-free operators', () => {
    expect(evaluateCondition({ path: 'user.pro', op: 'truthy' }, data)).toBe(true)
    expect(evaluateCondition({ path: 'user.trialDays', op: 'truthy' }, data)).toBe(false)
    expect(evaluateCondition({ path: 'user.trialDays', op: 'falsy' }, data)).toBe(true)
  })

  it('separates empty from falsy, which is the whole reason both exist', () => {
    // An empty array is truthy in JavaScript; "the cart has items" must not be.
    expect(evaluateCondition({ path: 'user.tags', op: 'truthy' }, data)).toBe(true)
    expect(evaluateCondition({ path: 'user.tags', op: 'notEmpty' }, data)).toBe(false)
    expect(evaluateCondition({ path: 'user.tags', op: 'empty' }, data)).toBe(true)
    expect(evaluateCondition({ path: 'order.items', op: 'notEmpty' }, data)).toBe(true)
    expect(evaluateCondition({ path: 'order.note', op: 'empty' }, data)).toBe(true)
    expect(evaluateCondition({ path: 'missing.thing', op: 'empty' }, data)).toBe(true)
  })

  it('compares equality after coercing both sides the same way', () => {
    expect(evaluateCondition({ path: 'user.plan', op: 'eq', value: 'team' }, data)).toBe(true)
    expect(evaluateCondition({ path: 'order.total', op: 'eq', value: '120' }, data)).toBe(true)
    expect(evaluateCondition({ path: 'user.plan', op: 'ne', value: 'solo' }, data)).toBe(true)
  })

  it('compares numerically for gt and lt', () => {
    expect(evaluateCondition({ path: 'order.total', op: 'gt', value: '100' }, data)).toBe(true)
    expect(evaluateCondition({ path: 'order.total', op: 'lt', value: 100 }, data)).toBe(false)
  })

  it('treats a missing scope as no data rather than throwing', () => {
    expect(evaluateCondition({ path: 'user.pro', op: 'truthy' }, null)).toBe(false)
  })
})

describe('conditionExpression()', () => {
  it('emits the JSX each operator compiles to', () => {
    /** @param {any} condition */
    const expr = (condition) => conditionExpression(condition)
    expect(expr({ path: 'user.pro', op: 'truthy' })).toBe('user?.pro')
    expect(expr({ path: 'user.pro', op: 'falsy' })).toBe('!user?.pro')
    expect(expr({ path: 'order.items', op: 'notEmpty' })).toBe('order?.items?.length > 0')
    expect(expr({ path: 'order.items', op: 'empty' })).toBe('!order?.items?.length')
    expect(expr({ path: 'user.plan', op: 'eq', value: 'team' })).toBe('user?.plan === "team"')
    expect(expr({ path: 'user.plan', op: 'ne', value: 'team' })).toBe('user?.plan !== "team"')
    expect(expr({ path: 'order.total', op: 'gt', value: '100' })).toBe('order?.total > 100')
    expect(expr({ path: 'order.total', op: 'lt', value: 100 })).toBe('order?.total < 100')
  })

  it('emits nothing for a condition a reader would refuse', () => {
    expect(conditionExpression({ path: '', op: 'truthy' })).toBe('')
    expect(conditionExpression(null)).toBe('')
  })

  it('agrees with the preview on absent data', () => {
    const cases = /** @type {const} */ ([
      [{ path: 'a.b', op: 'truthy' }, false],
      [{ path: 'a.b', op: 'falsy' }, true],
      [{ path: 'a.b', op: 'notEmpty' }, false],
      [{ path: 'a.b', op: 'empty' }, true],
    ])
    for (const [condition, expected] of cases) {
      expect(evaluateCondition(condition, {})).toBe(expected)
      // The emitted expression, evaluated the way the ejected component would.
      const run = new Function('a', `return Boolean(${conditionExpression(condition)})`)
      expect(run(undefined)).toBe(expected)
    }
  })
})

describe('conditionSummary() / conditionPaths()', () => {
  it('reads as a sentence, with the value only where there is one', () => {
    expect(conditionSummary({ path: 'user.pro', op: 'truthy' })).toBe('user.pro is set')
    expect(conditionSummary({ path: 'order.total', op: 'gt', value: '100' })).toBe(
      'order.total is greater than 100',
    )
    expect(conditionSummary({ path: '', op: 'truthy' })).toBe('')
  })

  it('reports the one path a condition depends on', () => {
    expect(conditionPaths({ path: 'user.pro', op: 'truthy' })).toEqual(['user.pro'])
    expect(conditionPaths(null)).toEqual([])
  })
})

describe('normalizeRepeat() / repeatDraft()', () => {
  it('fills in the preview count and trims the binding', () => {
    expect(repeatDraft({ path: ' order.items ', as: ' item ' })).toEqual({
      path: 'order.items',
      as: 'item',
      previewCount: DEFAULT_PREVIEW_COUNT,
    })
  })

  it('clamps the preview count to something a canvas can draw', () => {
    expect(repeatDraft({ path: 'a', as: 'i', previewCount: 99 })?.previewCount).toBe(20)
    expect(repeatDraft({ path: 'a', as: 'i', previewCount: 0 })?.previewCount).toBe(
      DEFAULT_PREVIEW_COUNT,
    )
    expect(repeatDraft({ path: 'a', as: 'i', previewCount: 2.4 })?.previewCount).toBe(2)
  })

  it('refuses a loop variable that could not become an identifier', () => {
    expect(normalizeRepeat({ path: 'order.items', as: '2items' })).toBeNull()
    expect(normalizeRepeat({ path: 'order.items', as: 'my item' })).toBeNull()
    expect(normalizeRepeat({ path: '', as: 'item' })).toBeNull()
    expect(normalizeRepeat(null)).toBeNull()
    expect(normalizeRepeat({ path: 'order.items', as: 'item' })).not.toBeNull()
  })
})

describe('repeatScopes()', () => {
  it('returns the outer scope untouched when there is no repeat', () => {
    const scope = { user: { name: 'Ada' } }
    expect(repeatScopes(null, scope)).toEqual([scope])
    expect(repeatScopes({ path: '', as: 'item' }, scope)[0]).toBe(scope)
  })

  it('layers the loop variable over the outer scope, with its index', () => {
    const scopes = repeatScopes({ path: 'order.items', as: 'item' }, data)
    expect(scopes).toHaveLength(2)
    expect(scopes[0].item).toEqual({ title: 'Kiln' })
    expect(scopes[0].itemIndex).toBe(0)
    // The outer data is still reachable from inside the loop.
    expect(scopes[1].user).toBe(data.user)
    expect(scopes[1].itemIndex).toBe(1)
  })

  it('honours a smaller preview count', () => {
    const scopes = repeatScopes({ path: 'order.items', as: 'item', previewCount: 1 }, data)
    expect(scopes).toHaveLength(1)
  })

  it('still yields one iteration when the array is empty or the path is wrong', () => {
    const empty = repeatScopes({ path: 'user.tags', as: 'tag' }, data)
    expect(empty).toHaveLength(1)
    expect(empty[0].tag).toBeUndefined()

    expect(repeatScopes({ path: 'nope.here', as: 'x' }, data)).toHaveLength(1)
  })

  it('reports the path a repeat depends on', () => {
    expect(repeatPaths({ path: 'order.items', as: 'item' })).toEqual(['order.items'])
    expect(repeatPaths({ path: 'order.items', as: '' })).toEqual([])
  })
})
