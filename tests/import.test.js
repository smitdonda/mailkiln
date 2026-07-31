import { describe, expect, it } from 'vitest'
import {
  createBlock,
  createColumn,
  createDocument,
  createRow,
  createSection,
  exportDocument,
  getParser,
  importFromHtml,
  normalize,
  parseStyleAttribute,
  renderToHtml,
  camelize,
  collapsedText,
} from '../src/core/index.js'
import { allBlocksIn, fixture, fixtureNames, kitchenSinkDocument, parseHtml, sampleVars, visibleText } from './helpers.js'

/**
 * @param {string} html
 * @param {Record<string, any>} [options]
 * @returns {import('../src/core/types.js').ImportReport}
 */
const load = (html, options = {}) => importFromHtml(html, { parseHtml, ...options })

/**
 * @param {import('../src/core/types.js').EmailDocument} doc
 * @returns {string[]}
 */
const types = (doc) => allBlocksIn(doc).map((block) => block.type)

describe('parseAdapter', () => {
  it('uses the injected parser when given one', () => {
    expect(getParser({ parseHtml })('<p>hi</p>')).toBeTruthy()
  })

  it('explains exactly what to install when no DOM is available', () => {
    const original = /** @type {any} */ (globalThis).DOMParser
    // @ts-expect-error - deleting an optional global for the test
    delete globalThis.DOMParser
    try {
      expect(() => getParser()).toThrow(/linkedom/)
      expect(() => getParser()).toThrow(/optional peer dependency/)
    } finally {
      if (original) /** @type {any} */ (globalThis).DOMParser = original
    }
  })

  it('parses style attributes into camelCase, ignoring malformed declarations', () => {
    const dom = parseHtml('<div style="background-color: #fff; font-size:16px; broken; :x">x</div>')
    const style = parseStyleAttribute(dom.querySelector('div'))
    expect(style).toEqual({ backgroundColor: '#fff', fontSize: '16px' })
  })

  it('camelizes vendor prefixes', () => {
    expect(camelize('background-color')).toBe('backgroundColor')
    expect(camelize('mso-padding-alt')).toBe('msoPaddingAlt')
    expect(camelize('-webkit-text-size-adjust')).toBe('WebkitTextSizeAdjust')
  })

  it('treats &nbsp; as whitespace so spacer cells read as empty', () => {
    const dom = parseHtml('<td>&nbsp;&nbsp;</td>')
    expect(collapsedText(dom.querySelector('td'))).toBe('')
  })
})

describe('importFromHtml', () => {
  it('rejects empty input', () => {
    expect(() => load('')).toThrow(/non-empty HTML string/)
    expect(() => load(/** @type {any} */ (null))).toThrow(/non-empty HTML string/)
  })

  it('recognises the output mailforge produced itself', () => {
    const html = renderToHtml(kitchenSinkDocument(), { vars: sampleVars })
    const report = load(html)
    expect(report.confidence).toBe(1)
    expect(report.unrecognized).toEqual([])
  })

  it('recovers the document settings', () => {
    const report = load(renderToHtml(kitchenSinkDocument(), { vars: sampleVars }))
    expect(report.document.settings.subject).toBe('Your order is on its way')
    expect(report.document.settings.preheader).toMatch(/^Arriving Thursday/)
    expect(report.document.settings.width).toBe(600)
    expect(report.document.settings.backgroundColor).toBe('#f4f5f7')
  })

  it('identifies each block signature', () => {
    const html = renderToHtml(kitchenSinkDocument(), { vars: sampleVars })
    const found = types(load(html).document)
    expect(found).toContain('heading')
    expect(found).toContain('button')
    expect(found).toContain('image')
    expect(found).toContain('divider')
    expect(found).toContain('text')
  })

  it('keeps a spacer cell rather than discarding it as empty', () => {
    const doc = normalize(
      createDocument({
        sections: [
          createSection({
            rows: [
              createRow({
                children: [createColumn({ blocks: [createBlock('spacer', { height: 48 })] })],
              }),
            ],
          }),
        ],
      }),
    )
    const report = load(renderToHtml(doc))
    expect(report.blockCount).toBe(1)
    expect(types(report.document)).toEqual(['spacer'])
    expect(allBlocksIn(report.document)[0].props.height).toBe(48)
  })

  it('imports a two-column row as two columns with their declared widths', () => {
    const doc = normalize(
      createDocument({
        sections: [
          createSection({
            rows: [
              createRow({
                children: [
                  createColumn({ width: 70, blocks: [createBlock('text', { text: 'wide' })] }),
                  createColumn({ width: 30, blocks: [createBlock('text', { text: 'narrow' })] }),
                ],
              }),
            ],
          }),
        ],
      }),
    )
    const imported = load(renderToHtml(doc)).document
    const row = imported.sections[0].rows.find((r) => r.columns.length === 2)
    expect(row).toBeTruthy()
    expect(row?.columns.map((c) => c.props.width)).toEqual([70, 30])
  })

  it('detects foreign merge tags and rewrites them', () => {
    const report = load(fixture('mailchimp-export.html'))
    expect(report.detectedVars).toContain('fname')
    const text = allBlocksIn(report.document)
      .map((b) => JSON.stringify(b.props))
      .join(' ')
    expect(text).toContain('{{fname}}')
    expect(text).not.toContain('*|FNAME|*')
  })

  it('reports what it deliberately did not carry over', () => {
    const codes = load(fixture('mailchimp-export.html')).warnings.map((w) => w.code)
    expect(codes).toContain('style-block-dropped')
  })

  it('warns about relative image sources', () => {
    const report = load('<html><body><table><tr><td><img src="/logo.png" alt="x"></td></tr></table></body></html>')
    expect(report.warnings.map((w) => w.code)).toContain('relative-image-src')
  })

  it('falls back to a single column for a div-based email', () => {
    const report = load(
      '<html><body><div><h1>Title</h1><p>Body copy here</p></div></body></html>',
    )
    expect(report.warnings.map((w) => w.code)).toContain('no-layout-tables')
    expect(types(report.document)).toEqual(['heading', 'text'])
  })

  it('never loses content: unrecognised markup becomes a raw html block', () => {
    const exotic =
      '<html><body><table><tr><td><table><tr><td>left</td><td>right</td></tr></table></td></tr></table></body></html>'
    const report = load(exotic)
    const html = allBlocksIn(report.document)
      .map((b) => (b.type === 'html' ? b.props.html : JSON.stringify(b.props)))
      .join(' ')
    expect(html).toMatch(/left/)
    expect(html).toMatch(/right/)
  })

  it('marks raw blocks as imported so the linter can note them', () => {
    const report = load('<html><body><p>only a paragraph</p></body></html>')
    const raw = allBlocksIn(report.document).filter((b) => b.type === 'html')
    for (const block of raw) expect(block.props.imported).toBe(true)
  })

  it('reports a confidence figure the UI can quote', () => {
    const report = load(fixture('unlayer-export.html'))
    expect(report.blockCount).toBeGreaterThan(0)
    expect(report.recognized + report.unrecognized.length).toBe(report.blockCount)
    expect(report.confidence).toBeGreaterThan(0)
    expect(report.confidence).toBeLessThanOrEqual(1)
  })

  it('produces a document that passes validation', () => {
    for (const name of fixtureNames()) {
      const report = load(fixture(name))
      expect(() => normalize(report.document)).not.toThrow()
      expect(report.document.version).toBe(1)
    }
  })
})

describe('real-world fixtures', () => {
  it.each(fixtureNames())('imports %s with recognisable structure', (name) => {
    const report = load(fixture(name))
    expect(report.blockCount).toBeGreaterThan(2)
    expect(report.confidence).toBeGreaterThan(0.5)
  })

  it('imports the Mailchimp export as editable blocks', () => {
    const report = load(fixture('mailchimp-export.html'))
    const found = types(report.document)
    expect(found).toContain('heading')
    expect(found).toContain('button')
    expect(found).toContain('image')
    expect(found).toContain('text')
    expect(report.document.settings.preheader).toMatch(/April statement/)
  })

  it('keeps the Mailchimp two-column footer as two columns', () => {
    const report = load(fixture('mailchimp-export.html'))
    const multi = report.document.sections.flatMap((s) => s.rows).filter((r) => r.columns.length > 1)
    expect(multi.length).toBeGreaterThan(0)
  })

  it('imports the Unlayer export, including its two-column row', () => {
    const report = load(fixture('unlayer-export.html'))
    expect(types(report.document)).toContain('heading')
    expect(types(report.document)).toContain('image')
    const multi = report.document.sections.flatMap((s) => s.rows).filter((r) => r.columns.length > 1)
    expect(multi.length).toBeGreaterThan(0)
  })

  it('imports the hand-written email, including its Outlook button', () => {
    const report = load(fixture('handwritten.html'))
    expect(types(report.document)).toContain('button')
    const button = allBlocksIn(report.document).find((b) => b.type === 'button')
    expect(button?.props.href).toBe('https://example.com/receipt/8842')
    expect(button?.props.buttonColor).toBe('#111111')
  })

  it('converts the Mailgun variable in the hand-written email', () => {
    const report = load(fixture('handwritten.html'))
    expect(report.detectedVars).toContain('name')
  })

  it('reads a non-600px content width from the source', () => {
    expect(load(fixture('handwritten.html')).document.settings.width).toBe(640)
  })

  it.each(fixtureNames())('loses no visible text from %s', (name) => {
    // The core guarantee: editability may degrade, content may not.
    const source = fixture(name)
    const report = load(source)
    const before = visibleText(source)
    const after = visibleText(renderToHtml(report.document))

    const words = before
      .split(' ')
      .filter((word) => word.length > 4 && /^[A-Za-z£$][\w'£$.,-]*$/.test(word))
    const missing = words.filter((word) => !after.includes(word.replace(/[.,]$/, '')))
    expect(missing, `missing words from ${name}`).toEqual([])
  })
})

describe('round trip', () => {
  it.each(fixtureNames())('is idempotent for %s', (name) => {
    // html -> import -> export -> import must be stable. If the second pass
    // finds a different structure, the importer and the renderer disagree, and
    // any edit-and-save cycle would slowly rewrite the user's template.
    const first = load(fixture(name))
    const second = load(exportDocument(first.document).html)
    const third = load(exportDocument(second.document).html)

    expect(second.blockCount).toBe(third.blockCount)
    expect(types(second.document)).toEqual(types(third.document))
    expect(structure(second.document)).toEqual(structure(third.document))
  })

  it('is stable across an edit', () => {
    const first = load(fixture('handwritten.html'))
    const edited = normalize({
      ...first.document,
      settings: { ...first.document.settings, subject: 'Edited subject' },
    })
    const second = load(exportDocument(edited).html)
    expect(second.document.settings.subject).toBe('Edited subject')
    expect(types(second.document)).toEqual(types(load(exportDocument(second.document).html).document))
  })

  it('round-trips a document built in the editor with no loss of block types', () => {
    const doc = kitchenSinkDocument()
    const once = load(exportDocument(doc, { vars: sampleVars }).html).document
    const twice = load(exportDocument(once, { vars: sampleVars }).html).document
    expect(types(once)).toEqual(types(twice))
  })
})

/**
 * A comparable shape summary: sections, rows per section, columns per row.
 *
 * @param {import('../src/core/types.js').EmailDocument} doc
 * @returns {number[][]}
 */
function structure(doc) {
  return doc.sections.map((section) => section.rows.map((row) => row.columns.length))
}
