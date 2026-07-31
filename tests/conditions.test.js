import { describe, expect, it } from 'vitest'
import {
  CONDITION_OPS,
  coerceValue,
  conditionExpression,
  conditionSummary,
  createBlock,
  createColumn,
  createDocument,
  createRenderContext,
  createRow,
  createSection,
  documentLocalVars,
  documentVarPaths,
  evaluateCondition,
  exportDocument,
  lintDocument,
  normalize,
  normalizeCondition,
  normalizeRepeat,
  renderBlockHtml,
  renderToHtml,
  renderToJsx,
  renderToMjml,
  renderToText,
  repeatScopes,
  setCondition,
  setRepeat,
  settleDrafts,
} from '../src/core/index.js'
import { defineVars } from '../src/core/index.js'

const vars = defineVars({
  sample: {
    user: { name: 'Smit', isPro: false, plan: 'free', credits: 0 },
    order: {
      total: 42,
      items: [
        { title: 'Keyboard', price: '$99' },
        { title: 'Mouse', price: '$29' },
      ],
      coupons: [],
    },
  },
})

const sample = vars.sample

/**
 * A one-section document whose two rows are addressable by index.
 *
 * @param {string[]} texts
 * @returns {import('../src/core/types.js').EmailDocument}
 */
function docWithRows(texts) {
  return normalize(
    createDocument({
      sections: [
        createSection({
          rows: texts.map((text) =>
            createRow({
              children: [
                createColumn({ width: 100, blocks: [createBlock('text', { text })] }),
              ],
            }),
          ),
        }),
      ],
    }),
  )
}

describe('normalizeCondition', () => {
  it('rejects anything it cannot evaluate', () => {
    // A half-typed condition is normal while someone is writing one, and it must
    // not start hiding sections.
    expect(normalizeCondition(null)).toBeNull()
    expect(normalizeCondition({ op: 'truthy' })).toBeNull()
    expect(normalizeCondition({ path: '  ' })).toBeNull()
    expect(normalizeCondition({ path: 'a', op: 'nonsense' })).toBeNull()
  })

  it('drops the value for operators that take none', () => {
    expect(normalizeCondition({ path: 'a', op: 'truthy', value: 'x' })).toEqual({
      path: 'a',
      op: 'truthy',
    })
  })

  it('coerces the value once, so preview and export agree', () => {
    expect(coerceValue('100')).toBe(100)
    expect(coerceValue('true')).toBe(true)
    expect(coerceValue('false')).toBe(false)
    expect(coerceValue('pro')).toBe('pro')
    expect(coerceValue('')).toBe('')
    expect(normalizeCondition({ path: 'a', op: 'gt', value: '100' })?.value).toBe(100)
  })
})

describe('evaluateCondition', () => {
  it('defaults to showing when there is no usable condition', () => {
    // The safe direction: an unfinished condition must never silently delete a
    // section from an email that is about to go out.
    expect(evaluateCondition(null, sample)).toBe(true)
    expect(evaluateCondition({ path: '', op: 'truthy' }, sample)).toBe(true)
  })

  it('handles every operator', () => {
    /** @type {Array<[any, boolean]>} */
    const cases = [
      [{ path: 'user.name', op: 'truthy' }, true],
      [{ path: 'user.isPro', op: 'truthy' }, false],
      [{ path: 'user.isPro', op: 'falsy' }, true],
      [{ path: 'user.plan', op: 'eq', value: 'free' }, true],
      [{ path: 'user.plan', op: 'ne', value: 'free' }, false],
      [{ path: 'order.total', op: 'gt', value: 40 }, true],
      [{ path: 'order.total', op: 'gt', value: '40' }, true],
      [{ path: 'order.total', op: 'lt', value: 40 }, false],
      [{ path: 'order.items', op: 'notEmpty' }, true],
      [{ path: 'order.coupons', op: 'notEmpty' }, false],
      [{ path: 'order.coupons', op: 'empty' }, true],
      [{ path: 'nothing.here', op: 'truthy' }, false],
    ]
    for (const [condition, expected] of cases) {
      expect(evaluateCondition(condition, sample), JSON.stringify(condition)).toBe(expected)
    }
  })

  it('separates "empty" from "falsy", which is the whole reason it exists', () => {
    // `[]` is truthy in JavaScript, so "show when the cart has items" written as
    // `truthy` would render the section for an empty cart.
    expect(evaluateCondition({ path: 'order.coupons', op: 'truthy' }, sample)).toBe(true)
    expect(evaluateCondition({ path: 'order.coupons', op: 'notEmpty' }, sample)).toBe(false)
  })
})

describe('conditionExpression', () => {
  it('emits real JavaScript, not template syntax', () => {
    expect(conditionExpression({ path: 'user.isPro', op: 'truthy' })).toBe('user.isPro')
    expect(conditionExpression({ path: 'user.isPro', op: 'falsy' })).toBe('!user.isPro')
    expect(conditionExpression({ path: 'user.plan', op: 'eq', value: 'pro' })).toBe(
      'user.plan === "pro"',
    )
    expect(conditionExpression({ path: 'order.total', op: 'gt', value: '100' })).toBe(
      'order.total > 100',
    )
    expect(conditionExpression({ path: 'order.items', op: 'notEmpty' })).toBe(
      'order.items.length > 0',
    )
    expect(conditionExpression(null)).toBe('')
  })

  it('summarises a condition for the canvas badge', () => {
    expect(conditionSummary({ path: 'user.isPro', op: 'truthy' })).toBe('user.isPro is set')
    expect(conditionSummary({ path: 'order.total', op: 'gt', value: 100 })).toBe(
      'order.total is greater than 100',
    )
    expect(conditionSummary(null)).toBe('')
    // Every operator has a label; a missing one would render "undefined".
    for (const op of Object.keys(CONDITION_OPS)) {
      expect(conditionSummary({ path: 'a', op, value: 1 })).not.toContain('undefined')
    }
  })
})

describe('setCondition', () => {
  it('sets, replaces and clears on any node kind', () => {
    let doc = docWithRows(['A'])
    const section = doc.sections[0]
    const row = section.rows[0]
    const block = row.columns[0].blocks[0]

    for (const id of [section.id, row.id, block.id]) {
      doc = setCondition(doc, id, { path: 'user.isPro', op: 'truthy' })
    }
    expect(doc.sections[0].showIf).toEqual({ path: 'user.isPro', op: 'truthy' })
    expect(doc.sections[0].rows[0].showIf?.path).toBe('user.isPro')
    expect(doc.sections[0].rows[0].columns[0].blocks[0].showIf?.path).toBe('user.isPro')

    doc = setCondition(doc, section.id, null)
    expect('showIf' in doc.sections[0]).toBe(false)
  })

  it('returns the same document when nothing changes', () => {
    // Identity matters: the canvas memoizes on it.
    const doc = setCondition(docWithRows(['A']), 'nope', { path: 'a', op: 'truthy' })
    const withCond = setCondition(doc, doc.sections[0].id, { path: 'a', op: 'truthy' })
    expect(setCondition(withCond, withCond.sections[0].id, { path: 'a', op: 'truthy' })).toBe(
      withCond,
    )
    expect(setCondition(doc, doc.sections[0].rows[0].id, null)).toBe(doc)
  })

  it('keeps an incomplete draft through normalize, and strips it on export', () => {
    // The Inspector stores a condition the moment you flip the switch, before
    // you have typed a path. `normalize()` runs on every change of the
    // controlled `value`, so dropping the draft there made the switch impossible
    // to keep on. Readers ignore it; `exportDocument` is where it stops.
    const doc = docWithRows(['A'])
    const drafted = setCondition(doc, doc.sections[0].id, /** @type {any} */ ({ path: '' }))
    expect(drafted.sections[0].showIf).toEqual({ path: '', op: 'truthy' })
    expect(normalize(drafted).sections[0].showIf).toEqual({ path: '', op: 'truthy' })

    // Inert everywhere that matters.
    expect(renderToHtml(drafted, { vars })).toContain('A')
    expect(renderToJsx(drafted, { vars })).not.toContain('&& (')

    expect('showIf' in settleDrafts(drafted).sections[0]).toBe(false)
    expect(JSON.parse(exportDocument(drafted, { vars }).json).sections[0].showIf).toBeUndefined()
  })

  it('strips an unfinished repeat on export too', () => {
    const doc = docWithRows(['A'])
    const drafted = setRepeat(doc, doc.sections[0].rows[0].id, /** @type {any} */ ({ as: 'item' }))
    expect(drafted.sections[0].rows[0].repeat).toBeTruthy()
    expect('repeat' in settleDrafts(drafted).sections[0].rows[0]).toBe(false)
  })
})

describe('rendering a display condition', () => {
  /** @returns {import('../src/core/types.js').EmailDocument} */
  const proDoc = () => {
    const doc = docWithRows(['Pro only', 'Everyone'])
    return setCondition(doc, doc.sections[0].rows[0].id, { path: 'user.isPro', op: 'truthy' })
  }

  it('drops the branch from every send target', () => {
    const doc = proDoc()
    expect(renderToHtml(doc, { vars })).not.toContain('Pro only')
    expect(renderToHtml(doc, { vars })).toContain('Everyone')
    expect(renderToText(doc, { vars })).not.toContain('Pro only')
    expect(renderToMjml(doc, { vars })).not.toContain('Pro only')
  })

  it('keeps the branch when the data says so', () => {
    const proVars = defineVars({ sample: { user: { ...sample.user, isPro: true } } })
    expect(renderToHtml(proDoc(), { vars: proVars })).toContain('Pro only')
  })

  it('keeps a hidden block on the canvas, marked rather than dropped', () => {
    // Hiding it for real would make it unselectable, so the condition could
    // never be removed again. `editable` is only ever set by the canvas.
    const doc = proDoc()
    const block = doc.sections[0].rows[0].columns[0].blocks[0]
    const conditioned = setCondition(doc, block.id, { path: 'user.isPro', op: 'truthy' })
    const target = conditioned.sections[0].rows[0].columns[0].blocks[0]

    const editing = createRenderContext(conditioned, { vars, options: { editable: true } })
    const sending = createRenderContext(conditioned, { vars })
    expect(renderBlockHtml(target, editing)).toContain('Pro only')
    expect(renderBlockHtml(target, sending)).toBe('')
  })

  it('emits a JSX conditional rather than ESP template syntax', () => {
    const jsx = renderToJsx(proDoc(), { vars })
    expect(jsx).toContain('{user.isPro && (')
    expect(jsx).toContain('Pro only')
    // No `{% if %}`, and no unresolved merge tags left behind.
    expect(jsx).not.toContain('{%')
    expect(jsx).not.toContain('{{user')
  })

  it('counts a condition-only path as a real prop', () => {
    // Otherwise `showIf` is silently untyped in the export and unchecked by lint.
    const doc = setCondition(docWithRows(['Hi']), docWithRows(['Hi']).sections[0].id, null)
    const conditioned = setCondition(doc, doc.sections[0].id, {
      path: 'user.isPro',
      op: 'truthy',
    })
    expect(documentVarPaths(conditioned)).toContain('user.isPro')
    expect(renderToJsx(conditioned, { vars })).toContain('({ user })')
  })

  it('reports an undeclared path used only in a condition', () => {
    const doc = setCondition(docWithRows(['Hi']), docWithRows(['Hi']).sections[0].id, null)
    const bad = setCondition(doc, doc.sections[0].id, { path: 'user.nope', op: 'truthy' })
    const issues = lintDocument(bad, { vars }).issues.filter((i) => i.id === 'unknown-var')
    expect(issues.map((i) => i.message)).toContain('{{user.nope}} is not declared in defineVars.')
  })
})

describe('repeat', () => {
  it('needs a path and a valid identifier', () => {
    expect(normalizeRepeat(null)).toBeNull()
    expect(normalizeRepeat({ path: 'order.items' })).toBeNull()
    expect(normalizeRepeat({ path: 'order.items', as: '2bad' })).toBeNull()
    expect(normalizeRepeat({ path: 'order.items', as: 'my item' })).toBeNull()
    expect(normalizeRepeat({ path: 'order.items', as: 'item' })).toEqual({
      path: 'order.items',
      as: 'item',
      previewCount: 3,
    })
  })

  it('layers the loop variable over the outer scope', () => {
    const scopes = repeatScopes({ path: 'order.items', as: 'item' }, sample)
    expect(scopes).toHaveLength(2)
    expect(scopes[0].item.title).toBe('Keyboard')
    expect(scopes[1].itemIndex).toBe(1)
    // The outer data is still reachable — `{{user.name}}` works inside the row.
    expect(scopes[0].user.name).toBe('Smit')
  })

  it('still yields one iteration when the array is missing or empty', () => {
    // Showing nothing would make a repeated row look broken in the editor while
    // being perfectly correct in the export.
    expect(repeatScopes({ path: 'order.coupons', as: 'c' }, sample)).toHaveLength(1)
    expect(repeatScopes({ path: 'nope.nope', as: 'c' }, sample)).toHaveLength(1)
  })

  it('caps the preview at previewCount', () => {
    const many = { items: Array.from({ length: 30 }, (_v, i) => ({ n: i })) }
    expect(repeatScopes({ path: 'items', as: 'i' }, many)).toHaveLength(3)
    expect(repeatScopes({ path: 'items', as: 'i', previewCount: 5 }, many)).toHaveLength(5)
    // And clamps an absurd request rather than rendering 10,000 rows.
    expect(repeatScopes({ path: 'items', as: 'i', previewCount: 900 }, many)).toHaveLength(20)
  })

  /** @returns {import('../src/core/types.js').EmailDocument} */
  const itemsDoc = () => {
    const doc = docWithRows(['{{item.title}} — {{item.price}}'])
    return setRepeat(doc, doc.sections[0].rows[0].id, { path: 'order.items', as: 'item' })
  }

  it('expands once per item, resolving the loop variable', () => {
    const html = renderToHtml(itemsDoc(), { vars })
    expect(html).toContain('Keyboard')
    expect(html).toContain('Mouse')
    expect(html).not.toContain('{{item.title}}')

    const text = renderToText(itemsDoc(), { vars })
    expect(text).toContain('Keyboard')
    expect(text).toContain('Mouse')
  })

  it('emits a .map() with a key', () => {
    const jsx = renderToJsx(itemsDoc(), { vars })
    expect(jsx).toContain('{order.items.map((item, itemIndex) => (')
    expect(jsx).toContain('key={itemIndex}')
    expect(jsx).toContain('{item.title}')
    // `item` is a loop variable, not a prop.
    expect(jsx).toContain('({ order })')
    expect(jsx).not.toContain('({ item')
  })

  it('does not report the loop variable as undeclared', () => {
    // The rule must not punish the feature it is supposed to support.
    const issues = lintDocument(itemsDoc(), { vars }).issues.filter((i) => i.id === 'unknown-var')
    expect(issues).toHaveLength(0)
    expect(documentLocalVars(itemsDoc()).has('item')).toBe(true)
    expect(documentVarPaths(itemsDoc())).not.toContain('item.title')
  })

  it('combines with a condition on the same row', () => {
    let doc = itemsDoc()
    doc = setCondition(doc, doc.sections[0].rows[0].id, { path: 'order.items', op: 'notEmpty' })
    const jsx = renderToJsx(doc, { vars })
    expect(jsx).toContain('{order.items.length > 0 && (')
    expect(jsx).toContain('{order.items.map((item, itemIndex) => (')
  })

  it('clears cleanly', () => {
    const doc = setRepeat(itemsDoc(), itemsDoc().sections[0].rows[0].id, null)
    expect(doc.sections[0].rows[0].repeat).toBeDefined()
    const same = itemsDoc()
    const cleared = setRepeat(same, same.sections[0].rows[0].id, null)
    expect('repeat' in cleared.sections[0].rows[0]).toBe(false)
  })

  it('ignores a repeat on anything that is not a row', () => {
    const doc = docWithRows(['A'])
    expect(setRepeat(doc, doc.sections[0].id, { path: 'order.items', as: 'item' })).toBe(doc)
  })
})
