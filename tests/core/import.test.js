/**
 * Pillar 2 — importing arbitrary email HTML.
 *
 * The guarantee under test is narrow and absolute: import may degrade in
 * *editability*, never in *content*. Every "we could not classify this" spec
 * therefore checks that the original markup is still in the document.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  camelize,
  collapsedText,
  createBlock,
  createColumn,
  createDocument,
  createRow,
  createSection,
  defineBlock,
  getParser,
  importFromHtml,
  parseStyleAttribute,
  renderToHtml,
  resetIds,
  unregisterBlock,
} from '../../src/core/index.js'
import { allBlocksIn, parseHtml } from '../support/kit.js'
import { divBased, mailchimpish, nestedLayout, unstructured } from '../support/emails.js'

afterEach(() => resetIds())

/**
 * @param {string} html
 * @param {Record<string, any>} [options]
 * @returns {import('../../src/core/types.js').ImportReport}
 */
function importHtml(html, options = {}) {
  return importFromHtml(html, { parseHtml, ...options })
}

/**
 * @param {import('../../src/core/types.js').ImportReport} report
 * @returns {string[]}
 */
function typesIn(report) {
  return allBlocksIn(report.document).map((block) => block.type)
}

describe('the parser adapter', () => {
  it('says exactly what to install when there is no DOM', () => {
    let message = ''
    try {
      getParser()
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('no DOM parser available')
    expect(message).toContain("import { parseHTML } from 'linkedom'")
  })

  it('uses the injected parser when one is given', () => {
    expect(getParser({ parseHtml })('<p>x</p>')).toBeTruthy()
  })

  it('reads a style attribute itself, so every DOM behaves the same', () => {
    /** @type {any} */
    const element = {
      getAttribute: () =>
        'background-color: red; -webkit-text-size-adjust:100%; mso-hide:all; junk',
    }
    expect(parseStyleAttribute(element)).toEqual({
      backgroundColor: 'red',
      WebkitTextSizeAdjust: '100%',
      msoHide: 'all',
    })
    expect(parseStyleAttribute(null)).toEqual({})
  })

  it('camel-cases the vendor prefixes the way the renderer expects them back', () => {
    expect(camelize('background-color')).toBe('backgroundColor')
    expect(camelize('-webkit-font-smoothing')).toBe('WebkitFontSmoothing')
    expect(camelize('-ms-text-size-adjust')).toBe('msTextSizeAdjust')
  })

  it('counts a non-breaking space as whitespace, not as content', () => {
    expect(collapsedText(/** @type {any} */ ({ textContent: ' a   b \n c ' }))).toBe('a b c')
    expect(collapsedText(null)).toBe('')
  })
})

describe('importFromHtml()', () => {
  it('refuses an empty string with a message naming the argument', () => {
    expect(() => importHtml('')).toThrow(/importFromHtml\(html\) needs a non-empty HTML string/)
    expect(() => importHtml(/** @type {any} */ (null))).toThrow(/non-empty HTML string/)
  })

  it('round-trips this package’s own output with every block recognised', () => {
    const doc = createDocument({
      settings: { subject: 'Welcome', preheader: 'Peek here' },
      sections: [
        createSection({
          rows: [
            createRow({
              children: [
                createColumn({
                  width: 100,
                  blocks: [
                    createBlock('heading', { text: 'Hello' }),
                    createBlock('text', { text: 'Body copy long enough to be worth keeping.' }),
                    createBlock('button', { text: 'Go', href: 'https://x.test' }),
                    createBlock('divider'),
                    createBlock('image', {
                      src: 'https://i.test/a.png',
                      alt: 'Kiln',
                      width: '552',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })

    const report = importHtml(renderToHtml(doc))
    expect(typesIn(report)).toEqual(['heading', 'text', 'button', 'divider', 'image'])
    expect(report.confidence).toBe(1)
    expect(report.unrecognized).toEqual([])
    expect(report.document.settings.subject).toBe('Welcome')
    expect(report.document.settings.preheader).toBe('Peek here')
  })

  it('recognises the shapes another ESP emits', () => {
    const report = importHtml(mailchimpish)
    expect(typesIn(report)).toEqual(['heading', 'text', 'text', 'text', 'button'])
    // The two-up row keeps both columns.
    expect(report.document.sections[0].rows.map((row) => row.columns.length)).toEqual([1, 1, 2, 1])
  })

  it('rewrites foreign merge tags and reports what it found', () => {
    const report = importHtml(mailchimpish)
    expect(report.detectedVars).toEqual(['fname', 'merge.city'])
    const heading = allBlocksIn(report.document)[0]
    expect(heading.props.text).toContain('{{fname}}')
  })

  it('leaves an opt-in syntax alone unless it is asked for', () => {
    const html = '<html><body><table width="600"><tr><td>Hi -name-</td></tr></table></body></html>'
    expect(importHtml(html).detectedVars).toEqual([])
    expect(importHtml(html, { varSyntaxes: ['sendgrid'] }).detectedVars).toEqual(['name'])
  })

  it('pulls document settings out of the source', () => {
    const settings = importHtml(mailchimpish).document.settings
    expect(settings.subject).toBe('Sale time')
    expect(settings.preheader).toBe('Preview line here')
    expect(settings.backgroundColor).toBe('#f0f0f0')
    expect(settings.fontFamily).toBe('Georgia, serif')
    expect(settings.textColor).toBe('#222222')
    expect(settings.width).toBe(600)
    expect(settings.language).toBe('en')
  })

  it('lets the caller override the settings it inferred', () => {
    const report = importHtml(mailchimpish, { settings: { width: 640, subject: 'Mine' } })
    expect(report.document.settings.width).toBe(640)
    expect(report.document.settings.subject).toBe('Mine')
  })

  it('walks the body directly when there are no layout tables', () => {
    const report = importHtml(divBased)
    expect(typesIn(report)).toEqual(['text', 'image'])
    expect(report.warnings.map((w) => w.code)).toContain('no-layout-tables')
  })

  it('keeps a nested layout table as raw HTML rather than scrambling it', () => {
    const report = importHtml(nestedLayout)
    expect(typesIn(report)).toEqual(['html', 'text'])

    const raw = allBlocksIn(report.document)[0]
    expect(raw.props.imported).toBe(true)
    expect(raw.props.html).toContain('<td>A</td>')
    expect(raw.props.html).toContain('<td>B</td>')
    expect(report.unrecognized).toEqual([raw.id])
    expect(report.confidence).toBe(0.5)
  })

  it('falls back to one raw block when it can infer no structure at all', () => {
    const report = importHtml(unstructured)
    expect(typesIn(report)).toEqual(['html'])
    expect(report.confidence).toBe(0)
    expect(report.warnings.map((w) => w.code)).toContain('unstructured')
  })

  it('reports what it knowingly did not carry over', () => {
    const codes = importHtml(mailchimpish).warnings.map((w) => w.code)
    expect(codes).toContain('style-block-dropped')
    expect(codes).toContain('no-unsubscribe')

    expect(importHtml(divBased).warnings.map((w) => w.code)).toContain('relative-image-src')

    const mso = `<html><body><!--[if mso]><table><tr><td>x</td></tr></table><![endif]--><table width="600"><tr><td>Hi there</td></tr></table></body></html>`
    expect(importHtml(mso).warnings.map((w) => w.code)).toContain('mso-conditionals-dropped')
  })

  it('does not report a missing unsubscribe link when the source has one', () => {
    const html = `<html><body><table width="600"><tr><td><a href="https://x.test">Unsubscribe</a></td></tr></table></body></html>`
    expect(importHtml(html).warnings.map((w) => w.code)).not.toContain('no-unsubscribe')
  })

  it('normalizes the document it returns', () => {
    const report = importHtml(mailchimpish)
    const widths = report.document.sections[0].rows[2].columns.map((c) => c.props.width)
    expect(widths.reduce((a, b) => a + b, 0)).toBe(100)
    expect(report.document.version).toBe(1)
  })
})

describe('custom blocks join the import', () => {
  afterEach(() => unregisterBlock('spec-callout'))

  it('are tried in priority order, like the built-ins', () => {
    defineBlock({
      type: 'spec-callout',
      label: 'Callout',
      defaultProps: { text: '' },
      render: { html: (p) => `<div>${p.text}</div>` },
      importPriority: 95,
      parse: (element, ctx) =>
        element.getAttribute?.('data-callout') != null ? { text: ctx.text(element) } : null,
    })

    const html = `<html><body><table width="600" align="center"><tr><td><table width="100%"><tr><td><div data-callout>Heads up</div></td></tr></table></td></tr></table></body></html>`
    const report = importHtml(html)
    expect(typesIn(report)).toEqual(['spec-callout'])
    expect(allBlocksIn(report.document)[0].props.text).toBe('Heads up')
  })

  it('cannot abort the import by throwing', () => {
    defineBlock({
      type: 'spec-callout',
      label: 'Callout',
      defaultProps: { text: '' },
      render: { html: () => '' },
      importPriority: 99,
      parse: () => {
        throw new Error('third-party bug')
      },
    })

    expect(() => importHtml(mailchimpish)).not.toThrow()
    expect(typesIn(importHtml(mailchimpish))).not.toContain('spec-callout')
  })
})
