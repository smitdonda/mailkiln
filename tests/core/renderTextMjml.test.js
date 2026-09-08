/**
 * The two secondary targets.
 *
 * The plain-text one is not an afterthought: a missing `text/plain` part is a
 * measurable spam signal, so it has to agree with the HTML about which sections
 * a condition removed. MJML is markup only — this package emits it and never
 * compiles it.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  createBlock,
  createColumn,
  createDocument,
  createRenderContext,
  createRow,
  createSection,
  renderBlockText,
  renderToMjml,
  renderToText,
  resetIds,
  setCondition,
  setRepeat,
  spacing,
  wrap,
} from '../../src/core/index.js'
import { docOf, docOfColumns, firstRowId, sampleVars } from '../support/kit.js'

afterEach(() => resetIds())

describe('renderToText()', () => {
  it('leads with the preheader, then one blank line between blocks', () => {
    const doc = docOf(
      [createBlock('heading', { text: 'Welcome' }), createBlock('text', { text: 'Body copy' })],
      { settings: { preheader: 'Peek' } },
    )
    expect(renderToText(doc)).toBe('Peek\n\nWelcome\n=======\n\nBody copy')
  })

  it('underlines a heading, capped so a long one does not run away', () => {
    const long = 'x'.repeat(90)
    const text = renderToText(docOf([createBlock('heading', { text: long })]), { width: 0 })
    expect(text.split('\n')[1]).toBe('='.repeat(60))
  })

  it('gives each block type a readable text form', () => {
    /** @param {import('../../src/core/types.js').Block} block */
    const render = (block) => renderBlockText(block, createRenderContext(createDocument()))

    expect(render(createBlock('button', { text: 'Go', href: 'https://x.test' }))).toBe(
      'Go: https://x.test',
    )
    expect(render(createBlock('image', { src: 'https://i.test/a.png', alt: 'Kiln' }))).toBe(
      '[Kiln]',
    )
    expect(
      render(createBlock('image', { src: 'https://i.test/a.png', alt: 'Kiln', href: 'https://x' })),
    ).toBe('[Kiln: https://x]')
    expect(render(createBlock('image', { src: '', alt: '' }))).toBe('')
    expect(render(createBlock('divider'))).toBe('—'.repeat(24))
    expect(render(createBlock('spacer'))).toBe('')
    expect(
      render(createBlock('videoThumb', { videoUrl: 'https://v.test', caption: 'Watch' })),
    ).toBe('Watch: https://v.test')
  })

  it('lists social and menu links one per line', () => {
    const ctx = createRenderContext(createDocument())
    const social = renderBlockText(
      createBlock('social', {
        links: [
          { network: 'x', label: 'X', url: 'https://x.test' },
          { network: 'web', label: 'Site', url: 'https://s.test' },
        ],
      }),
      ctx,
    )
    expect(social).toBe('X: https://x.test\nSite: https://s.test')

    const menu = renderBlockText(
      createBlock('menu', { items: [{ label: 'Shop', url: 'https://shop.test' }] }),
      ctx,
    )
    expect(menu).toBe('Shop: https://shop.test')
  })

  it('strips the markup of a block that renders raw HTML', () => {
    const ctx = createRenderContext(createDocument())
    expect(renderBlockText(createBlock('html', { html: '<p>Kept<br>words</p>' }), ctx)).toBe(
      'Kept\nwords',
    )
  })

  it('renders nothing for a block type that is not registered', () => {
    const ctx = createRenderContext(createDocument())
    expect(renderBlockText(createBlock('countdown', {}), ctx)).toBe('')
  })

  it('resolves merge variables against the sample data', () => {
    const doc = docOf([createBlock('text', { text: 'Hi {{user.name}}' })])
    expect(renderToText(doc, { vars: sampleVars() })).toBe('Hi Ada')
  })

  it('agrees with the HTML target about hidden sections', () => {
    let doc = docOf([createBlock('text', { text: 'Members only' })])
    doc = setCondition(doc, doc.sections[0].id, { path: 'user.pro', op: 'falsy' })
    expect(renderToText(doc, { vars: sampleVars() })).toBe('')
  })

  it('repeats a row once per item, like every other target', () => {
    let doc = docOf([createBlock('text', { text: '{{item.title}}' })])
    doc = setRepeat(doc, firstRowId(doc), { path: 'order.items', as: 'item' })
    expect(renderToText(doc, { vars: sampleVars() })).toBe('Kiln\n\nClay')
  })

  it('reads columns left to right within a row', () => {
    const doc = docOfColumns([
      [createBlock('text', { text: 'left' })],
      [createBlock('text', { text: 'right' })],
    ])
    expect(renderToText(doc)).toBe('left\n\nright')
  })
})

describe('wrap()', () => {
  it('hard-wraps at the column, preserving existing breaks', () => {
    expect(wrap('one two three four', 9)).toBe('one two\nthree\nfour')
    expect(wrap('short\nlines', 20)).toBe('short\nlines')
  })

  it('never breaks a word, so a long URL stays clickable', () => {
    const url = `https://x.test/${'a'.repeat(60)}`
    expect(wrap(url, 40)).toBe(url)
  })

  it('is disabled by a width of zero', () => {
    const doc = docOf([createBlock('text', { text: 'a '.repeat(60) })])
    expect(renderToText(doc, { width: 0 }).includes('\n')).toBe(false)
    expect(renderToText(doc).includes('\n')).toBe(true)
  })
})

/**
 * Sections inside the body only — `mj-attributes` in the head declares one too.
 *
 * @param {string} mjml
 * @returns {number}
 */
function sectionCount(mjml) {
  const body = mjml.slice(mjml.indexOf('<mj-body'))
  return (body.match(/<mj-section/g) ?? []).length
}

describe('renderToMjml()', () => {
  it('emits markup, with the document settings in the head', () => {
    const mjml = renderToMjml(
      createDocument({ settings: { subject: 'Hi & bye', preheader: 'Peek', width: 640 } }),
    )
    expect(mjml.startsWith('<mjml>')).toBe(true)
    expect(mjml).toContain('<mj-title>Hi &amp; bye</mj-title>')
    expect(mjml).toContain('<mj-preview>Peek</mj-preview>')
    expect(mjml).toContain('width="640px"')
    expect(mjml).toContain('<mj-all font-family=')
  })

  it('maps one mailkiln row onto one mj-section of mj-columns', () => {
    const mjml = renderToMjml(docOfColumns([[createBlock('text', { text: 'a' })], []]))
    expect(sectionCount(mjml)).toBe(1)
    expect(mjml.match(/<mj-column/g) ?? []).toHaveLength(2)
    expect(mjml).toContain('width="50%"')
  })

  it('adds a wrapper only when the section has something to carry', () => {
    expect(renderToMjml(docOf())).not.toContain('<mj-wrapper')
    expect(renderToMjml(docOf([], { section: { backgroundColor: '#eee' } }))).toContain(
      '<mj-wrapper padding="0" background-color="#eee">',
    )
    expect(renderToMjml(docOf([], { section: { padding: spacing(20) } }))).toContain('<mj-wrapper')
  })

  it('uses the MJML component each block maps onto', () => {
    const doc = docOf([
      createBlock('button', { text: 'Go', href: 'https://x.test' }),
      createBlock('divider'),
      createBlock('spacer', { height: 32 }),
      createBlock('image', { src: 'https://i.test/a.png', alt: 'a' }),
    ])
    const mjml = renderToMjml(doc)
    expect(mjml).toContain('<mj-button')
    expect(mjml).toContain('<mj-divider')
    expect(mjml).toContain('<mj-spacer height="32px" />')
    expect(mjml).toContain('<mj-image')
  })

  it('wraps a block with no mjml renderer in mj-raw rather than dropping it', () => {
    const doc = createDocument({
      sections: [
        createSection({
          rows: [
            createRow({
              children: [
                createColumn({
                  width: 100,
                  blocks: [createBlock('countdown', { padding: spacing(4) })],
                }),
              ],
            }),
          ],
        }),
      ],
    })
    const mjml = renderToMjml(doc)
    expect(mjml).toContain('<mj-raw><!-- unknown block: countdown --></mj-raw>')
  })

  it('honours conditions and repeats too', () => {
    let hidden = docOf([createBlock('text', { text: 'Members only' })])
    hidden = setCondition(hidden, hidden.sections[0].id, { path: 'user.pro', op: 'falsy' })
    expect(renderToMjml(hidden, { vars: sampleVars() })).not.toContain('Members only')

    let repeated = docOf([createBlock('text', { text: '{{item.title}}' })])
    repeated = setRepeat(repeated, firstRowId(repeated), { path: 'order.items', as: 'item' })
    const mjml = renderToMjml(repeated, { vars: sampleVars() })
    expect(sectionCount(mjml)).toBe(2)
    expect(mjml).toContain('Kiln')
    expect(mjml).toContain('Clay')
  })
})
