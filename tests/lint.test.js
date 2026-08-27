import { describe, expect, it } from 'vitest'
import {
  builtinRules,
  contrastRatio,
  createBlock,
  createColumn,
  createDocument,
  createRow,
  createSection,
  defineVars,
  groupByNode,
  isSpecialLink,
  lintDocument,
  luminance,
  normalize,
  parseColor,
  spacing,
  SPECIAL_LINKS,
} from '../src/core/index.js'
import { GMAIL_LIMIT } from '../src/core/lint/index.js'
import { kitchenSinkDocument, sampleVars } from './helpers.js'

/**
 * Build a document from a list of blocks.
 *
 * @param {import('../src/core/types.js').Block[]} blocks
 * @param {Partial<import('../src/core/types.js').DocumentSettings>} [settings]
 * @returns {import('../src/core/types.js').EmailDocument}
 */
function docWith(blocks, settings = {}) {
  return normalize(
    createDocument({
      settings,
      sections: [
        createSection({ rows: [createRow({ children: [createColumn({ width: 100, blocks })] })] }),
      ],
    }),
  )
}

/**
 * @param {import('../src/core/types.js').LintResult} result
 * @param {string} id
 * @returns {import('../src/core/types.js').LintIssue[]}
 */
function issuesFor(result, id) {
  return result.issues.filter((issue) => issue.id === id)
}

describe('colour maths', () => {
  it('parses the formats email templates actually use', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('rgb(255, 0, 0)')).toMatchObject({ r: 255, g: 0, b: 0 })
    expect(parseColor('rgba(0,0,0,0.5)')).toMatchObject({ a: 0.5 })
    expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('transparent')).toBeNull()
    expect(parseColor('nonsense')).toBeNull()
    expect(parseColor(undefined)).toBeNull()
  })

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThan(4.5)
    expect(contrastRatio('bogus', '#fff')).toBeNull()
  })

  it('computes luminance at the extremes', () => {
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0)
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5)
  })
})

describe('lintDocument', () => {
  it('counts issues by level and reports the rendered size', () => {
    const result = lintDocument(kitchenSinkDocument(), { vars: sampleVars })
    expect(result.errors + result.warnings + result.infos).toBe(result.issues.length)
    expect(result.sizeBytes).toBeGreaterThan(1000)
  })

  it('sorts errors before warnings before notes', () => {
    const levels = lintDocument(kitchenSinkDocument()).issues.map((i) => i.level)
    const rank = { error: 0, warn: 1, info: 2 }
    expect(levels.map((l) => rank[l])).toEqual([...levels.map((l) => rank[l])].sort())
  })

  it('can disable rules', () => {
    const doc = docWith([createBlock('text', { text: 'hi' })])
    expect(issuesFor(lintDocument(doc), 'unsubscribe')).toHaveLength(1)
    expect(issuesFor(lintDocument(doc, { disable: ['unsubscribe'] }), 'unsubscribe')).toHaveLength(0)
  })

  it('flags an image block with no source', () => {
    // The canvas shows a placeholder, the export shows nothing at all — without
    // this rule an unfinished image is a silent hole in the sent email.
    const doc = docWith([
      createBlock('image', { src: '', alt: 'Hero' }),
      createBlock('videoThumb', { thumbnailUrl: '' }),
      createBlock('image', { src: 'https://example.com/a.png', alt: 'Fine' }),
    ])
    const issues = issuesFor(lintDocument(doc), 'image-src')
    expect(issues).toHaveLength(2)
    expect(issues[0].message).toBe('Image block has no image.')
    expect(issues[1].message).toBe('Video block has no thumbnail.')
    expect(issues[0].nodeId).toBeTruthy()
  })

  it('flags a menu item with no link and one with no label', () => {
    const doc = docWith([
      createBlock('menu', {
        items: [
          { label: 'Shop', url: 'https://example.com/shop' },
          { label: 'Careers', url: '' },
          { label: '', url: 'https://example.com/jobs' },
        ],
      }),
    ])
    const result = lintDocument(doc)
    expect(issuesFor(result, 'menu-url')).toHaveLength(1)
    expect(issuesFor(result, 'menu-url')[0].message).toMatch(/Careers/)
    expect(issuesFor(result, 'menu-label')).toHaveLength(1)
  })

  it('accepts extra rules and reports a rule that throws instead of crashing', () => {
    const doc = docWith([createBlock('text', { text: 'hi' })])
    const result = lintDocument(doc, {
      extraRules: [
        { id: 'custom', level: 'warn', title: 'Custom', check: () => [{ id: 'custom', level: 'warn', message: 'from a custom rule' }] },
        {
          id: 'broken',
          level: 'warn',
          title: 'Broken',
          check: () => {
            throw new Error('boom')
          },
        },
      ],
    })
    expect(issuesFor(result, 'custom')).toHaveLength(1)
    expect(issuesFor(result, 'broken')[0].hint).toBe('boom')
  })

  it('runs block-level lint hooks, so custom blocks ship their own rules', () => {
    const doc = docWith([createBlock('button', { href: '' })])
    const issue = issuesFor(lintDocument(doc), 'button-href')[0]
    expect(issue.level).toBe('error')
    expect(issue.nodeId).toBe(doc.sections[0].rows[0].columns[0].blocks[0].id)
  })

  it('groups issues by node for the canvas', () => {
    const result = lintDocument(kitchenSinkDocument())
    const grouped = groupByNode(result.issues)
    expect(grouped.size).toBeGreaterThan(0)
  })

  it('exposes every built-in rule with a unique id', () => {
    const ids = builtinRules.map((rule) => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(builtinRules.length).toBeGreaterThanOrEqual(16)
  })
})

describe('gmail-clipping', () => {
  it('errors past 102KB', () => {
    const filler = createBlock('text', { text: 'x'.repeat(120_000) })
    const result = lintDocument(docWith([filler]))
    const issue = issuesFor(result, 'gmail-clipping')[0]
    expect(issue.level).toBe('error')
    expect(issue.message).toMatch(/Gmail clips at 100\.0KB/)
    expect(issue.data?.limit).toBe(GMAIL_LIMIT)
  })

  it('warns from 80% of the limit', () => {
    const filler = createBlock('text', { text: 'x'.repeat(85_000) })
    expect(issuesFor(lintDocument(docWith([filler])), 'gmail-clipping')[0].level).toBe('warn')
  })

  it('says nothing about a small email', () => {
    expect(issuesFor(lintDocument(docWith([createBlock('text')])), 'gmail-clipping')).toHaveLength(0)
  })
})

describe('unsubscribe', () => {
  it('errors when no unsubscribe link exists', () => {
    const issue = issuesFor(lintDocument(docWith([createBlock('text', { text: 'hi' })])), 'unsubscribe')[0]
    expect(issue.level).toBe('error')
    expect(issue.hint).toMatch(/legal requirement/)
  })

  it('accepts a link, a preference-centre link, or a merge variable', () => {
    for (const text of [
      '<a href="https://x/u">Unsubscribe</a>',
      '<a href="https://x/p">Manage your email preferences</a>',
      '<a href="{{unsubscribe_url}}">Opt out</a>',
    ]) {
      expect(issuesFor(lintDocument(docWith([createBlock('text', { text })])), 'unsubscribe')).toHaveLength(0)
    }
  })
})

describe('unknown-var', () => {
  it('errors on an undeclared path and suggests the nearest declared one', () => {
    const doc = docWith([createBlock('text', { text: 'Hi {{user.nmae}}' })])
    const issue = issuesFor(lintDocument(doc, { vars: sampleVars }), 'unknown-var')[0]
    expect(issue.level).toBe('error')
    expect(issue.message).toBe('{{user.nmae}} is not declared in defineVars.')
    expect(issue.hint).toBe('Did you mean {{user.name}}?')
    expect(issue.nodeId).toBe(doc.sections[0].rows[0].columns[0].blocks[0].id)
  })

  it('says which root exists when only the leaf is wrong', () => {
    const doc = docWith([createBlock('text', { text: '{{user.telephone_number}}' })])
    expect(issuesFor(lintDocument(doc, { vars: sampleVars }), 'unknown-var')[0].hint).toMatch(
      /"user" exists but/,
    )
  })

  it('accepts declared paths and the implicit ESP variables', () => {
    const doc = docWith([
      createBlock('text', { text: '{{user.name}} {{order.total}} {{unsubscribe_url}} {{current_year}}' }),
    ])
    expect(issuesFor(lintDocument(doc, { vars: sampleVars }), 'unknown-var')).toHaveLength(0)
  })

  it('stays quiet when no vars are declared at all', () => {
    const doc = docWith([createBlock('text', { text: '{{anything.at.all}}' })])
    expect(issuesFor(lintDocument(doc), 'unknown-var')).toHaveLength(0)
  })

  it('checks the preheader too', () => {
    const doc = docWith([createBlock('text', { text: 'hi' })], { preheader: '{{nope}}' })
    expect(issuesFor(lintDocument(doc, { vars: sampleVars }), 'unknown-var')).toHaveLength(1)
  })

  it('never reports a link the editor itself offers', () => {
    // The editor's link picker and this rule read the same list, so inserting
    // one from the UI cannot produce an error.
    const doc = docWith([
      createBlock('text', {
        text: SPECIAL_LINKS.map((link) => `<a href="${link}">x</a>`).join(' '),
      }),
    ])
    expect(issuesFor(lintDocument(doc, { vars: sampleVars }), 'unknown-var')).toHaveLength(0)
    expect(SPECIAL_LINKS.every(isSpecialLink)).toBe(true)
    expect(isSpecialLink('https://example.com')).toBe(false)
  })
})

describe('links', () => {
  it('errors on a relative URL', () => {
    const doc = docWith([createBlock('image', { src: 'https://x/y.png', alt: 'y', href: '/relative' })])
    expect(issuesFor(lintDocument(doc), 'links')[0].message).toMatch(/relative URL/)
  })

  it('errors on a placeholder "#" link', () => {
    const doc = docWith([createBlock('image', { src: 'https://x/y.png', alt: 'y', href: '#' })])
    expect(issuesFor(lintDocument(doc), 'links')[0].message).toMatch(/links to "#"/)
  })

  it('accepts absolute, mailto, tel and merge-variable links', () => {
    for (const href of ['https://x/y', 'mailto:a@b.c', 'tel:+441234', '{{link}}']) {
      const doc = docWith([createBlock('button', { href })])
      expect(issuesFor(lintDocument(doc), 'links')).toHaveLength(0)
    }
  })
})

describe('outlook-unsafe-css', () => {
  it('flags each unsupported declaration found in raw HTML', () => {
    const doc = docWith([
      createBlock('html', { html: '<div style="display:flex;position:absolute;gap:8px">x</div>' }),
    ])
    const messages = issuesFor(lintDocument(doc), 'outlook-unsafe-css').map((i) => i.message)
    expect(messages.join(' ')).toMatch(/display:flex/)
    expect(messages.join(' ')).toMatch(/position/)
    expect(messages.join(' ')).toMatch(/gap/)
  })

  it('says nothing about the table output mailkiln produces itself', () => {
    expect(issuesFor(lintDocument(kitchenSinkDocument()), 'outlook-unsafe-css')).toHaveLength(0)
  })
})

describe('contrast and dark mode', () => {
  it('flags low-contrast body text', () => {
    const doc = docWith([createBlock('text', { text: 'faint', color: '#dddddd' })])
    const issue = issuesFor(lintDocument(doc), 'contrast')[0]
    expect(issue.message).toMatch(/below the 4.5:1 minimum/)
    expect(issue.data?.ratio).toBeLessThan(4.5)
  })

  it('holds large text to the 3:1 threshold instead', () => {
    const passes = docWith([createBlock('heading', { text: 'big', color: '#767676', fontSize: 30 })])
    expect(issuesFor(lintDocument(passes), 'contrast')).toHaveLength(0)
  })

  it('escalates to an error when the miss is large', () => {
    const doc = docWith([createBlock('text', { text: 'invisible', color: '#fdfdfd' })])
    expect(issuesFor(lintDocument(doc), 'contrast')[0].level).toBe('error')
  })

  it('checks a button against its own fill, not the page', () => {
    const doc = docWith([createBlock('button', { buttonColor: '#ffffff', color: '#ffffff' })])
    expect(issuesFor(lintDocument(doc), 'contrast')[0].data?.background).toBe('#ffffff')
  })

  it('passes the default palette — our own defaults must not trip our own linter', () => {
    const doc = docWith([
      createBlock('heading'),
      createBlock('text'),
      createBlock('button'),
    ])
    expect(issuesFor(lintDocument(doc), 'contrast')).toHaveLength(0)
  })

  it('errors on near-white text with no declared background', () => {
    const doc = docWith([createBlock('text', { text: 'invisible', color: '#fefefe' })])
    expect(issuesFor(lintDocument(doc), 'dark-mode')[0].level).toBe('error')
  })

  it('notes near-black text relying on an undeclared white background', () => {
    const doc = docWith([createBlock('text', { text: 'dark', color: '#000000' })])
    expect(issuesFor(lintDocument(doc), 'dark-mode')[0].level).toBe('info')
  })

  it('notes when dark mode support is switched off', () => {
    const doc = docWith([createBlock('text')], { darkModeAware: false })
    expect(issuesFor(lintDocument(doc), 'dark-mode').some((i) => /switched off/.test(i.message))).toBe(
      true,
    )
  })
})

describe('image rules', () => {
  it('warns about a missing alt', () => {
    const doc = docWith([createBlock('image', { src: 'https://x/y.png', alt: '' })])
    expect(issuesFor(lintDocument(doc), 'image-alt').length).toBeGreaterThan(0)
  })

  it('notes a percentage width, which Outlook cannot compute', () => {
    const doc = docWith([createBlock('image', { src: 'https://x/y.png', alt: 'y', width: '100%' })])
    expect(issuesFor(lintDocument(doc), 'image-width')[0].hint).toMatch(/Set a px width/)
  })

  it('accepts an explicit px width', () => {
    const doc = docWith([createBlock('image', { src: 'https://x/y.png', alt: 'y', width: 552 })])
    expect(issuesFor(lintDocument(doc), 'image-width')).toHaveLength(0)
  })

  it('warns about webp, avif and svg', () => {
    for (const ext of ['webp', 'avif', 'svg']) {
      const doc = docWith([createBlock('image', { src: `https://x/y.${ext}`, alt: 'y', width: 100 })])
      expect(issuesFor(lintDocument(doc), 'image-format')[0].message).toContain(`.${ext}`)
    }
  })

  it('finds risky formats inside raw HTML too', () => {
    const doc = docWith([createBlock('html', { html: '<img src="https://x/y.webp">' })])
    expect(issuesFor(lintDocument(doc), 'image-format').length).toBeGreaterThan(0)
  })
})

describe('background-image', () => {
  it('warns when a section background image has no fallback colour', () => {
    const doc = kitchenSinkDocument()
    doc.sections[0].props.backgroundImage = 'https://x/bg.jpg'
    doc.sections[0].props.backgroundColor = ''
    expect(issuesFor(lintDocument(doc), 'background-image')[0].message).toMatch(
      /no background colour/,
    )
  })

  it('warns when text over the fallback colour would be unreadable', () => {
    const doc = kitchenSinkDocument()
    doc.sections[0].props.backgroundImage = 'https://x/bg.jpg'
    doc.sections[0].props.backgroundColor = '#333333'
    expect(
      issuesFor(lintDocument(doc), 'background-image').some((i) => /contrast/.test(i.message)),
    ).toBe(true)
  })

  it('warns about a raw-HTML background image with no VML', () => {
    const doc = docWith([
      createBlock('html', { html: '<div style="background:url(https://x/bg.jpg)">x</div>' }),
    ])
    expect(issuesFor(lintDocument(doc), 'background-image')[0].hint).toMatch(/v:rect/)
  })

  it('accepts raw HTML that already has a VML fallback', () => {
    const doc = docWith([
      createBlock('html', {
        html: '<!--[if gte mso 9]><v:rect><v:fill src="x" /></v:rect><![endif]--><div style="background:url(https://x/bg.jpg)">x</div>',
      }),
    ])
    expect(issuesFor(lintDocument(doc), 'background-image')).toHaveLength(0)
  })
})

describe('deliverability rules', () => {
  it('warns when the plain-text version is thin', () => {
    const doc = docWith([createBlock('image', { src: 'https://x/y.png', alt: '' })])
    expect(issuesFor(lintDocument(doc), 'plain-text')[0].message).toMatch(/no plain text|only \d+/)
  })

  it('warns about a missing preheader and notes an over-long one', () => {
    expect(issuesFor(lintDocument(docWith([createBlock('text')])), 'preheader')[0].level).toBe('warn')
    const long = docWith([createBlock('text')], { preheader: 'x'.repeat(200) })
    expect(issuesFor(lintDocument(long), 'preheader')[0].level).toBe('info')
  })

  it('warns on font sizes below 12px, which iOS auto-zooms', () => {
    const doc = docWith([createBlock('text', { fontSize: 10 })])
    expect(issuesFor(lintDocument(doc), 'font-size')[0].data?.size).toBe(10)
  })

  it('accepts 12px and above', () => {
    expect(issuesFor(lintDocument(docWith([createBlock('text', { fontSize: 12 })])), 'font-size')).toHaveLength(0)
  })

  it('flags spam phrases, all caps and multiple exclamation marks in the subject', () => {
    const doc = docWith([createBlock('text')], { subject: 'ACT NOW - RISK FREE!!' })
    const messages = issuesFor(lintDocument(doc), 'spam-phrases').map((i) => i.message)
    expect(messages.join(' ')).toMatch(/act now/)
    expect(messages.join(' ')).toMatch(/risk free/)
    expect(messages.join(' ')).toMatch(/all caps/)
    expect(messages.join(' ')).toMatch(/exclamation marks/)
  })

  it('leaves an ordinary subject alone', () => {
    const doc = docWith([createBlock('text')], { subject: 'Your order is on its way' })
    expect(issuesFor(lintDocument(doc), 'spam-phrases')).toHaveLength(0)
  })
})

describe('structure', () => {
  it('warns about an over-wide template', () => {
    const doc = docWith([createBlock('text')], { width: 800 })
    expect(issuesFor(lintDocument(doc), 'structure').some((i) => /800px/.test(i.message))).toBe(true)
  })

  it('warns about too many columns and about not stacking them', () => {
    const doc = normalize(
      createDocument({
        sections: [
          createSection({
            rows: [createRow({ columns: 5, props: { stackOnMobile: false, padding: spacing(0) } })],
          }),
        ],
      }),
    )
    const messages = issuesFor(lintDocument(doc), 'structure').map((i) => i.message)
    expect(messages.join(' ')).toMatch(/5 columns/)
    expect(messages.join(' ')).toMatch(/not to stack/)
  })

  it('notes an empty row and an empty template', () => {
    const doc = createDocument()
    const messages = issuesFor(lintDocument(doc), 'structure').map((i) => i.message)
    expect(messages.join(' ')).toMatch(/no content in any column/)
    expect(messages.join(' ')).toMatch(/template is empty/)
  })

  it('notes a missing subject', () => {
    expect(
      issuesFor(lintDocument(docWith([createBlock('text')])), 'structure').some((i) =>
        /No subject line/.test(i.message),
      ),
    ).toBe(true)
  })
})

describe('a deliberately bad email', () => {
  it('fires every severity, with node links where applicable', () => {
    const doc = docWith(
      [
        createBlock('text', { text: 'x'.repeat(110_000), fontSize: 9, color: '#eeeeee' }),
        createBlock('image', { src: 'https://x/hero.webp', alt: '', width: '100%' }),
        createBlock('button', { href: '#' }),
        createBlock('html', { html: '<div style="display:flex"><script>x()</script></div>' }),
      ],
      { subject: 'FREE GIFT - ACT NOW!!', preheader: '', darkModeAware: false, width: 900 },
    )
    const result = lintDocument(doc, { vars: defineVars({ sample: {} }) })

    for (const id of [
      'gmail-clipping',
      'unsubscribe',
      'links',
      'outlook-unsafe-css',
      'contrast',
      'dark-mode',
      'image-alt',
      'image-format',
      'image-width',
      // Not `plain-text`: the 110KB text block gives this email plenty of plain
      // text, so that rule correctly stays quiet. It is covered on its own above.
      'preheader',
      'font-size',
      'spam-phrases',
      'structure',
      'html-script',
    ]) {
      expect(issuesFor(result, id).length, `expected rule "${id}" to fire`).toBeGreaterThan(0)
    }

    expect(result.errors).toBeGreaterThan(0)
    expect(result.warnings).toBeGreaterThan(0)
    expect(result.issues.filter((i) => i.nodeId).length).toBeGreaterThan(0)
  })
})
