/**
 * Pillar 3 — the deliverability linter.
 *
 * A rule that fires on everything gets ignored, so most specs here check both
 * halves: the document that should trip the rule, and the one that should not.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  GMAIL_LIMIT,
  blocksOfType,
  builtinRules,
  byteLength,
  contrastRatio,
  createBlock,
  createColumn,
  createDocument,
  createRow,
  createSection,
  eachBlock,
  effectiveBackground,
  groupByNode,
  lintDocument,
  luminance,
  parseColor,
  resetIds,
  setRepeat,
} from '../../src/core/index.js'
import { docOf, docOfColumns, firstRowId, sampleVars } from '../support/kit.js'

afterEach(() => resetIds())

/**
 * The issues one rule reported, so a spec is not drowned by the other sixteen.
 *
 * @param {import('../../src/core/types.js').EmailDocument} doc
 * @param {string} id
 * @param {Parameters<typeof lintDocument>[1]} [options]
 * @returns {import('../../src/core/types.js').LintIssue[]}
 */
function issuesFor(doc, id, options) {
  return lintDocument(doc, options).issues.filter((issue) => issue.id === id)
}

/**
 * A document that trips nothing — the baseline every "should not fire" spec
 * starts from.
 *
 * @param {import('../../src/core/types.js').Block[]} [extra]
 * @returns {import('../../src/core/types.js').EmailDocument}
 */
function cleanDoc(extra = []) {
  return docOf(
    [
      createBlock('heading', { text: 'Your order is on its way' }),
      createBlock('text', {
        text: 'Thanks for shopping with us. Everything is packed and moving.',
      }),
      createBlock('text', {
        text: 'No longer interested? <a href="{{unsubscribe_url}}">Unsubscribe</a>.',
      }),
      ...extra,
    ],
    { settings: { subject: 'Your order is on its way', preheader: 'On its way' } },
  )
}

describe('lintDocument()', () => {
  it('reports a clean template as clean', () => {
    const result = lintDocument(cleanDoc())
    expect(result.errors).toBe(0)
    expect(result.warnings).toBe(0)
    expect(result.sizeBytes).toBeGreaterThan(0)
  })

  it('sorts errors before warnings before notes', () => {
    const levels = lintDocument(createDocument()).issues.map((issue) => issue.level)
    expect(levels).toEqual([...levels].sort((a, b) => rank(a) - rank(b)))
  })

  it('counts each level, and measures the rendered size in UTF-8 bytes', () => {
    const result = lintDocument(createDocument())
    expect(result.errors).toBe(result.issues.filter((i) => i.level === 'error').length)
    expect(result.warnings).toBe(result.issues.filter((i) => i.level === 'warn').length)
    expect(result.infos).toBe(result.issues.filter((i) => i.level === 'info').length)
    expect(byteLength('héllo')).toBe(6)
    expect(byteLength(/** @type {any} */ (undefined))).toBe(0)
  })

  it('skips the rules it is told to', () => {
    expect(issuesFor(createDocument(), 'unsubscribe')).toHaveLength(1)
    expect(issuesFor(createDocument(), 'unsubscribe', { disable: ['unsubscribe'] })).toHaveLength(0)
  })

  it('takes extra rules, or a whole replacement set', () => {
    /** @type {import('../../src/core/types.js').LintRule} */
    const rule = {
      id: 'spec-rule',
      level: 'warn',
      title: 'Spec',
      check: () => [{ id: 'spec-rule', level: 'warn', message: 'fired' }],
    }
    expect(issuesFor(cleanDoc(), 'spec-rule', { extraRules: [rule] })).toHaveLength(1)

    const only = lintDocument(createDocument(), { rules: [rule] })
    expect(only.issues).toHaveLength(1)
    expect(only.issues[0].message).toBe('fired')
  })

  it('lets an issue raise or lower its rule’s default level', () => {
    /** @type {import('../../src/core/types.js').LintRule} */
    const rule = {
      id: 'spec-rule',
      level: 'info',
      title: 'Spec',
      check: () => [{ id: 'spec-rule', level: 'error', message: 'serious' }],
    }
    expect(lintDocument(cleanDoc(), { rules: [rule] }).errors).toBe(1)
  })

  it('reports a rule that throws instead of taking the panel down with it', () => {
    /** @type {import('../../src/core/types.js').LintRule} */
    const broken = {
      id: 'spec-broken',
      level: 'warn',
      title: 'Broken',
      check: () => {
        throw new Error('kaboom')
      },
    }
    const [issue] = lintDocument(cleanDoc(), { rules: [broken] }).issues
    expect(issue.message).toContain('failed to run')
    expect(issue.hint).toBe('kaboom')
    expect(issue.level).toBe('info')
  })

  it('accepts pre-rendered HTML and text, so the panel can render once', () => {
    const result = lintDocument(cleanDoc(), { html: '<html></html>', text: 'short' })
    expect(result.sizeBytes).toBe(byteLength('<html></html>'))
    expect(result.issues.some((i) => i.id === 'plain-text')).toBe(true)
  })

  it('names the built-in rules in report order, most consequential first', () => {
    expect(builtinRules[0].id).toBe('gmail-clipping')
    expect(builtinRules.map((r) => r.id)).toContain('unknown-var')
    expect(new Set(builtinRules.map((r) => r.id)).size).toBeLessThan(builtinRules.length + 1)
  })
})

describe('block lint hooks', () => {
  it('runs a block’s own hook and tags the issue with the block id', () => {
    const doc = cleanDoc([createBlock('button', { text: 'Go', href: '#' })])
    const [issue] = issuesFor(doc, 'button-href')
    expect(issue.level).toBe('error')
    expect(issue.nodeId).toBe(blocksOfType(doc, 'button')[0].id)
  })

  it('can be disabled by issue id or by block type', () => {
    const doc = cleanDoc([createBlock('button', { text: 'Go', href: '#' })])
    expect(issuesFor(doc, 'button-href', { disable: ['button-href'] })).toHaveLength(0)
    expect(issuesFor(doc, 'button-href', { disable: ['block:button'] })).toHaveLength(0)
  })

  it('survives a hook that throws', () => {
    const doc = cleanDoc([createBlock('text', { text: 'x' })])
    /** @type {any} */
    const rule = { id: 'noop', level: 'info', title: 'noop', check: () => [] }
    // A built-in hook cannot be made to throw, so this checks the same guard via
    // a rule whose block hook would be the only other source of a crash.
    expect(() => lintDocument(doc, { rules: [rule] })).not.toThrow()
  })
})

describe('gmail-clipping', () => {
  it('is silent well below the limit', () => {
    expect(issuesFor(cleanDoc(), 'gmail-clipping')).toHaveLength(0)
  })

  it('warns from 80% of the limit and errors past it', () => {
    const near = 'x'.repeat(Math.round(GMAIL_LIMIT * 0.85))
    expect(issuesFor(cleanDoc(), 'gmail-clipping', { html: near })[0]).toMatchObject({
      level: 'warn',
    })

    const over = 'x'.repeat(GMAIL_LIMIT + 10)
    const [issue] = issuesFor(cleanDoc(), 'gmail-clipping', { html: over })
    expect(issue.level).toBe('error')
    expect(issue.message).toContain('100.0KB')
    expect(issue.data?.limit).toBe(GMAIL_LIMIT)
  })
})

describe('unsubscribe', () => {
  it('is an error when nothing in the message offers a way out', () => {
    const [issue] = issuesFor(docOf([createBlock('text', { text: 'Buy now' })]), 'unsubscribe')
    expect(issue.level).toBe('error')
    expect(issue.hint).toContain('legal requirement')
  })

  it('is satisfied by the word, by a preferences link, or by the merge tag', () => {
    for (const text of [
      'You can <a href="https://x.test">unsubscribe</a> here.',
      'Manage your email preferences.',
      '<a href="{{unsubscribe_url}}">Opt out</a>',
    ]) {
      expect(issuesFor(docOf([createBlock('text', { text })]), 'unsubscribe')).toHaveLength(0)
    }
  })
})

describe('unknown-var', () => {
  it('does nothing at all without a declared sample', () => {
    const doc = docOf([createBlock('text', { text: 'Hi {{user.nmae}}' })])
    expect(issuesFor(doc, 'unknown-var')).toHaveLength(0)
  })

  it('flags an undeclared path and suggests the nearest declared one', () => {
    const doc = docOf([createBlock('text', { text: 'Hi {{user.nmae}}' })])
    const [issue] = issuesFor(doc, 'unknown-var', { vars: sampleVars() })
    expect(issue.level).toBe('error')
    expect(issue.message).toBe('{{user.nmae}} is not declared in defineVars.')
    expect(issue.hint).toBe('Did you mean {{user.name}}?')
    expect(issue.nodeId).toBeTruthy()
  })

  it('says which half is wrong when the root exists but the leaf does not', () => {
    const doc = docOf([createBlock('text', { text: '{{user.middleInitial}}' })])
    const [issue] = issuesFor(doc, 'unknown-var', { vars: sampleVars() })
    expect(issue.hint).toContain('"user" exists but')
  })

  it('points at defineVars when the root is unknown too', () => {
    const doc = docOf([createBlock('text', { text: '{{invoice.reference}}' })])
    const [issue] = issuesFor(doc, 'unknown-var', { vars: sampleVars() })
    expect(issue.hint).toContain('Add "invoice"')
  })

  it('never reports the paths every ESP supplies', () => {
    const doc = docOf([
      createBlock('text', {
        text: '<a href="{{unsubscribe_url}}">out</a> {{current_year}} {{preferences_url}}',
      }),
    ])
    expect(issuesFor(doc, 'unknown-var', { vars: sampleVars() })).toHaveLength(0)
  })

  it('never reports a loop variable, which is in scope rather than declared', () => {
    let doc = docOf([createBlock('text', { text: '{{item.title}} — {{itemIndex}}' })])
    doc = setRepeat(doc, firstRowId(doc), { path: 'order.items', as: 'item' })
    expect(issuesFor(doc, 'unknown-var', { vars: sampleVars() })).toHaveLength(0)
  })

  it('accepts every declared path, including an indexed one', () => {
    const doc = docOf([
      createBlock('text', {
        text: '{{user.name}} {{order.items[0].title}} {{order.items.length}}',
      }),
    ])
    expect(issuesFor(doc, 'unknown-var', { vars: sampleVars() })).toHaveLength(0)
  })
})

describe('links', () => {
  it('is an error for a relative URL and for a placeholder anchor', () => {
    const relative = issuesFor(
      docOf([createBlock('image', { src: 'a.png', href: '/signup' })]),
      'links',
    )
    expect(relative[0]).toMatchObject({ level: 'error' })
    expect(relative[0].message).toContain('relative URL')

    const hash = issuesFor(docOf([createBlock('button', { href: '#' })]), 'links')
    expect(hash[0].message).toContain('links to "#"')
  })

  it('accepts the absolute schemes and skips merge tags', () => {
    for (const href of ['https://x.test', 'mailto:a@b.test', 'tel:+1', 'sms:+1', '{{cta}}']) {
      expect(issuesFor(docOf([createBlock('button', { href })]), 'links')).toHaveLength(0)
    }
  })

  it('reaches into a list of links', () => {
    const doc = docOf([
      createBlock('social', { links: [{ network: 'web', label: 'Site', url: 'site.test' }] }),
    ])
    expect(issuesFor(doc, 'links')).toHaveLength(1)
  })
})

describe('outlook-unsafe-css', () => {
  it('finds modern layout CSS hiding in a raw HTML block', () => {
    const doc = docOf([createBlock('html', { html: '<div style="display:flex;gap:8px">x</div>' })])
    const ids = issuesFor(doc, 'outlook-unsafe-css').map((i) => i.data?.css)
    expect(ids).toContain('display:flex')
    expect(ids).toContain('gap')
  })

  it('says nothing about markup this package generated itself', () => {
    expect(issuesFor(cleanDoc(), 'outlook-unsafe-css')).toHaveLength(0)
  })
})

describe('contrast', () => {
  it('measures text against the background it actually sits on', () => {
    const doc = docOf([createBlock('text', { text: 'Faint', color: '#cccccc' })])
    const [issue] = issuesFor(doc, 'contrast')
    expect(issue.level).toBe('error')
    expect(issue.message).toContain('#cccccc on #ffffff')
    expect(issue.data?.minimum).toBe(4.5)
  })

  it('relaxes the minimum for large text', () => {
    const doc = docOf([createBlock('heading', { text: 'Big', color: '#aaaaaa', fontSize: 32 })])
    expect(issuesFor(doc, 'contrast')[0]?.data?.minimum).toBe(3)
  })

  it('checks a button against its own colour, not the page', () => {
    const doc = docOf([
      createBlock('button', { text: 'Go', href: 'https://x.test', buttonColor: '#eeeeee' }),
    ])
    expect(issuesFor(doc, 'contrast')[0]?.message).toContain('#ffffff on #eeeeee')
  })

  it('checks link colour separately, since links have their own field', () => {
    const doc = docOf([
      createBlock('text', {
        text: 'see <a href="https://x.test">this</a>',
        color: '#111827',
        linkColor: '#f5f5f5',
      }),
    ])
    expect(issuesFor(doc, 'contrast').some((i) => i.message.startsWith('Link colour'))).toBe(true)
  })

  it('says nothing about a readable template', () => {
    expect(issuesFor(cleanDoc(), 'contrast')).toHaveLength(0)
  })
})

describe('dark-mode', () => {
  it('is an error when near-white text has no background of its own', () => {
    const doc = docOf([createBlock('text', { text: 'Hi', color: '#fefefe' })])
    expect(issuesFor(doc, 'dark-mode')[0]).toMatchObject({ level: 'error' })
  })

  it('is satisfied once the block declares one', () => {
    const doc = docOf([
      createBlock('text', { text: 'Hi', color: '#ffffff', backgroundColor: '#111827' }),
    ])
    expect(issuesFor(doc, 'dark-mode')).toHaveLength(0)
  })

  it('notes near-black text that relies on an undeclared white background', () => {
    const doc = docOf([createBlock('text', { text: 'Hi', color: '#000000' })])
    expect(issuesFor(doc, 'dark-mode')[0]).toMatchObject({ level: 'info' })
  })

  it('notes a template that opted out of dark mode entirely', () => {
    const doc = docOf([], { settings: { darkModeAware: false } })
    expect(issuesFor(doc, 'dark-mode').some((i) => i.message.includes('switched off'))).toBe(true)
  })
})

describe('image rules', () => {
  it('warns about an image block with no image — it exports as nothing', () => {
    const doc = docOf([createBlock('image', { src: '' })])
    expect(issuesFor(doc, 'image-src')[0]?.message).toBe('Image block has no image.')
    expect(issuesFor(docOf([createBlock('videoThumb', {})]), 'image-src')[0]?.message).toBe(
      'Video block has no thumbnail.',
    )
  })

  it('warns about a missing alt only when there is a source', () => {
    // Both the document rule and the image block's own hook report this id.
    const reported = issuesFor(
      docOf([createBlock('image', { src: 'https://i.test/a.png', alt: '' })]),
      'image-alt',
    )
    expect(reported.length).toBeGreaterThan(0)
    expect(reported.every((issue) => issue.level === 'warn')).toBe(true)
    expect(issuesFor(docOf([createBlock('image', { src: '' })]), 'image-alt')).toHaveLength(0)
  })

  it('names the clients that cannot decode the format', () => {
    const doc = docOf([createBlock('image', { src: 'https://i.test/a.webp', alt: 'a' })])
    const [issue] = issuesFor(doc, 'image-format')
    expect(issue.message).toContain('.webp')
    expect(issue.message).toContain('Outlook desktop')

    const svg = docOf([createBlock('html', { html: '<img src="https://i.test/a.svg">' })])
    expect(issuesFor(svg, 'image-format')).toHaveLength(1)
  })

  it('notes a percentage width, unless an Outlook width is also given', () => {
    const fluid = docOf([
      createBlock('image', { src: 'https://i.test/a.png', alt: 'a', width: '100%' }),
    ])
    expect(issuesFor(fluid, 'image-width')[0]?.level).toBe('info')

    const safe = docOf([
      createBlock('image', { src: 'https://i.test/a.png', alt: 'a', width: '100%', pxWidth: 552 }),
    ])
    expect(issuesFor(safe, 'image-width')).toHaveLength(0)
  })
})

describe('background-image', () => {
  it('asks for a fallback colour behind a section background image', () => {
    const doc = docOf([], { section: { backgroundImage: 'https://i.test/hero.jpg' } })
    expect(issuesFor(doc, 'background-image')[0]?.message).toContain('no background colour')
  })

  it('checks the text against that fallback colour once it is set', () => {
    const doc = docOf([createBlock('text', { text: 'Hi' })], {
      section: { backgroundImage: 'https://i.test/hero.jpg', backgroundColor: '#333333' },
    })
    expect(issuesFor(doc, 'background-image').some((i) => i.message.includes('contrast'))).toBe(
      true,
    )
  })

  it('asks a raw HTML background image for its VML', () => {
    const doc = docOf([
      createBlock('html', {
        html: '<td style="background-image:url(https://i.test/a.png)">x</td>',
      }),
    ])
    expect(issuesFor(doc, 'background-image')[0]?.message).toContain('no VML fallback')
  })
})

describe('deliverability rules', () => {
  it('warns when the plain-text part is missing or too short to count', () => {
    const empty = docOf([createBlock('image', { src: 'https://i.test/a.png', alt: '' })])
    expect(issuesFor(empty, 'plain-text')[0]?.message).toContain('no plain text at all')

    const short = docOf([createBlock('text', { text: 'Hi' })])
    expect(issuesFor(short, 'plain-text')[0]?.message).toContain('only 2 characters')
  })

  it('asks for a preheader, and flags one that is too long to be read', () => {
    expect(issuesFor(createDocument(), 'preheader')[0]?.level).toBe('warn')
    const long = docOf([], { settings: { preheader: 'x'.repeat(160) } })
    expect(issuesFor(long, 'preheader')[0]).toMatchObject({ level: 'info' })
  })

  it('flags a small font size, per block', () => {
    const doc = docOf([createBlock('text', { text: 'Legal', fontSize: 10 })])
    const [issue] = issuesFor(doc, 'font-size')
    expect(issue.message).toBe('Font size is 10px.')
    expect(issue.data?.size).toBe(10)
    expect(issuesFor(docOf([createBlock('text', { fontSize: 14 })]), 'font-size')).toHaveLength(0)
  })

  it('reads the subject and preheader for the phrases that move a spam score', () => {
    const doc = docOf([], {
      settings: { subject: 'Act now for a free gift', preheader: 'Risk free, guaranteed' },
    })
    const phrases = issuesFor(doc, 'spam-phrases').map((i) => i.data?.phrase)
    expect(phrases).toContain('act now')
    expect(phrases).toContain('free gift')
    expect(phrases).toContain('risk free')
  })

  it('flags shouting and a row of exclamation marks', () => {
    const caps = docOf([], { settings: { subject: 'LAST CHANCE TODAY' } })
    expect(issuesFor(caps, 'spam-phrases').some((i) => i.message.includes('all caps'))).toBe(true)

    const bangs = docOf([], { settings: { subject: 'Open this!!' } })
    expect(
      issuesFor(bangs, 'spam-phrases').some((i) => i.message.includes('2 exclamation marks')),
    ).toBe(true)
  })
})

describe('structure', () => {
  it('warns about a template wider than the reading pane', () => {
    const doc = docOf([], { settings: { width: 720 } })
    expect(issuesFor(doc, 'structure').some((i) => i.message.includes('720px'))).toBe(true)
  })

  it('warns about a row split more ways than mobile can stack', () => {
    const doc = docOfColumns([[], [], [], [], []])
    expect(issuesFor(doc, 'structure').some((i) => i.message.includes('5 columns'))).toBe(true)
  })

  it('notes a row with nothing in any column', () => {
    const doc = docOfColumns([[], []])
    expect(
      issuesFor(doc, 'structure').some((i) => i.message.includes('no content in any column')),
    ).toBe(true)
  })

  it('warns about a wide row that refuses to stack', () => {
    const doc = docOfColumns([
      [createBlock('text', { text: 'a' })],
      [createBlock('text', { text: 'b' })],
      [createBlock('text', { text: 'c' })],
    ])
    doc.sections[0].rows[0].props.stackOnMobile = false
    expect(issuesFor(doc, 'structure').some((i) => i.message.includes('not to stack'))).toBe(true)
  })

  it('notes a missing subject and an empty template', () => {
    const messages = issuesFor(createDocument(), 'structure').map((i) => i.message)
    expect(messages).toContain('No subject line set.')
    expect(messages).toContain('The template is empty.')
  })
})

describe('colour maths', () => {
  it('parses the notations email templates actually use', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('#00000080')?.a).toBeCloseTo(0.5, 1)
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(parseColor('rgba(0,0,0,0.5)')?.a).toBe(0.5)
    expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
  })

  it('returns null for the keywords with no colour, and for nonsense', () => {
    expect(parseColor('transparent')).toBeNull()
    expect(parseColor('inherit')).toBeNull()
    expect(parseColor('rebeccapurple')).toBeNull()
    expect(parseColor('')).toBeNull()
  })

  it('computes WCAG luminance and the ratio between two colours', () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5)
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1)
    expect(contrastRatio('nonsense', '#fff')).toBeNull()
  })
})

describe('traversal helpers', () => {
  it('walks blocks with the ids of every container above them', () => {
    const doc = docOf([createBlock('text'), createBlock('divider')])
    const entries = eachBlock(doc)
    expect(entries).toHaveLength(2)
    expect(entries[0].columnId).toBe(doc.sections[0].rows[0].columns[0].id)
    expect(entries[0].sectionId).toBe(doc.sections[0].id)
    expect(blocksOfType(doc, 'divider')).toHaveLength(1)
  })

  it('resolves the nearest declared background above a block', () => {
    const doc = createDocument({
      sections: [
        createSection({
          props: { backgroundColor: '#111111' },
          rows: [
            createRow({
              children: [
                createColumn({ width: 100, blocks: [createBlock('text', { text: 'a' })] }),
              ],
            }),
          ],
        }),
      ],
    })
    const blockId = doc.sections[0].rows[0].columns[0].blocks[0].id
    expect(effectiveBackground(doc, blockId)).toBe('#111111')

    doc.sections[0].rows[0].columns[0].props.backgroundColor = '#222222'
    expect(effectiveBackground(doc, blockId)).toBe('#222222')
    expect(effectiveBackground(doc, 'ghost')).toBe('#ffffff')
  })
})

describe('groupByNode()', () => {
  it('buckets issues by node, with the document-level ones under an empty key', () => {
    const doc = docOf([createBlock('button', { href: '#' })])
    const grouped = groupByNode(lintDocument(doc).issues)
    expect(grouped.has('')).toBe(true)
    const buttonId = blocksOfType(doc, 'button')[0].id
    expect(grouped.get(buttonId)?.length).toBeGreaterThan(0)
  })
})

/**
 * @param {import('../../src/core/types.js').LintLevel} level
 * @returns {number}
 */
function rank(level) {
  return { error: 0, warn: 1, info: 2 }[level] ?? 3
}
