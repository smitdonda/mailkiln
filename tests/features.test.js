/**
 * The controls added after the Apple-template build showed what the editor
 * could not express: link colour on inline anchors, heading weight, borders on
 * rows and columns, an Outlook-shaped rounded button, letter spacing on buttons
 * and menus, paragraph spacing, and a pixel width that can accompany a
 * percentage.
 *
 * @module tests/features
 */

import { describe, expect, it } from 'vitest'
import {
  builtinBlocks,
  createBlock,
  createColumn,
  createDocument,
  createRenderContext,
  createRow,
  createSection,
  lintDocument,
  normalize,
  renderBlockHtml,
  renderToHtml,
  renderToJsx,
  renderToMjml,
} from '../src/core/index.js'
import { kitchenSinkDocument, sampleVars } from './helpers.js'

const ctx = () => createRenderContext(kitchenSinkDocument(), { vars: sampleVars })

describe('link colour', () => {
  it('inlines the document link colour on anchors inside copy', () => {
    const html = renderBlockHtml(
      createBlock('text', { text: 'Read the <a href="https://example.com">notes</a>.' }),
      ctx(),
    )
    expect(html).toContain('<a href="https://example.com" style="color:#2563eb">')
  })

  it('lets a block override the document colour', () => {
    const html = renderBlockHtml(
      createBlock('text', { text: '<a href="https://example.com">notes</a>', linkColor: '#0071e3' }),
      ctx(),
    )
    expect(html).toContain('style="color:#0071e3"')
    expect(html).not.toContain('#2563eb')
  })

  it('leaves an anchor that already has its own colour alone', () => {
    const html = renderBlockHtml(
      createBlock('text', { text: '<a href="#" style="color:#ff0000">x</a>' }),
      ctx(),
    )
    expect(html).toContain('style="color:#ff0000"')
    expect(html).not.toContain('#2563eb')
  })

  it('merges into an existing style attribute without dropping it', () => {
    const html = renderBlockHtml(
      createBlock('text', { text: '<a href="#" style="text-decoration:underline">x</a>' }),
      ctx(),
    )
    expect(html).toContain('style="text-decoration:underline;color:#2563eb"')
  })

  it('colours heading links too, and states the colour in the head stylesheet', () => {
    expect(renderBlockHtml(createBlock('heading', { text: '<a href="#">Sale</a>' }), ctx())).toContain(
      'color:#2563eb',
    )
    expect(renderToHtml(kitchenSinkDocument(), { vars: sampleVars })).toContain(
      'a{color:#2563eb;text-decoration:none}',
    )
  })

  it('reaches the ejected component as well as the HTML', () => {
    const doc = normalize(
      createDocument({
        sections: [
          createSection({
            rows: [
              createRow({
                children: [
                  createColumn({
                    blocks: [createBlock('text', { text: '<a href="https://x/">go</a>' })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    )
    expect(renderToJsx(doc)).toContain('color:#2563eb')
  })
})

describe('paragraph spacing', () => {
  it('is left to the client by default', () => {
    const html = renderBlockHtml(createBlock('text', { text: '<p>One</p><p>Two</p>' }), ctx())
    expect(html).toContain('<p>One</p>')
  })

  it('writes a bottom margin on every paragraph when asked', () => {
    const html = renderBlockHtml(
      createBlock('text', { text: '<p>One</p><p>Two</p>', paragraphSpacing: 12 }),
      ctx(),
    )
    expect(html).toContain('<p style="margin:0 0 12px">One</p>')
    expect(html).toContain('<p style="margin:0 0 12px">Two</p>')
  })

  it('does not fight a margin the author wrote', () => {
    const html = renderBlockHtml(
      createBlock('text', { text: '<p style="margin:4px">One</p>', paragraphSpacing: 12 }),
      ctx(),
    )
    expect(html).toContain('<p style="margin:4px">One</p>')
  })
})

describe('heading weight', () => {
  it('is editable rather than stuck on bold', () => {
    const def = builtinBlocks.find((block) => block.type === 'heading')
    expect(def?.schema?.some((field) => field.key === 'fontWeight')).toBe(true)
    expect(renderBlockHtml(createBlock('heading', { fontWeight: '300' }), ctx())).toContain(
      'font-weight:300',
    )
  })

  it('still defaults to bold, so existing templates do not move', () => {
    expect(renderBlockHtml(createBlock('heading'), ctx())).toContain('font-weight:bold')
  })
})

describe('row and column borders', () => {
  /**
   * @param {Record<string, any>} rowProps
   * @param {Record<string, any>} columnProps
   * @returns {import('../src/core/types.js').EmailDocument}
   */
  const doc = (rowProps, columnProps) =>
    normalize(
      createDocument({
        sections: [
          createSection({
            rows: [
              createRow({
                props: rowProps,
                children: [
                  createColumn({ width: 50, props: columnProps, blocks: [createBlock('text')] }),
                  createColumn({ width: 50, blocks: [createBlock('text')] }),
                ],
              }),
            ],
          }),
        ],
      }),
    )

  it('emits a column border on the cell', () => {
    expect(renderToHtml(doc({}, { borderRight: '5px solid #1d1d1f' }))).toContain(
      'border-right:5px solid #1d1d1f',
    )
  })

  it('emits a row border on the row cell', () => {
    expect(renderToHtml(doc({ borderBottom: '1px solid #eee' }, {}))).toContain(
      'border-bottom:1px solid #eee',
    )
  })

  it('carries them into the ejected component and the MJML', () => {
    expect(renderToJsx(doc({}, { borderRight: '5px solid #1d1d1f' }))).toContain(
      'borderRight: "5px solid #1d1d1f"',
    )
    expect(renderToMjml(doc({ borderTop: '1px solid #eee' }, {}))).toContain(
      'border-top="1px solid #eee"',
    )
  })

  it('keeps the single-column JSX shortcut for a column with no border', () => {
    expect(renderToHtml(doc({}, {}))).not.toContain('border-right')
  })
})

describe('button in Outlook', () => {
  it('ships a VML round-rect twin for a rounded button', () => {
    const html = renderBlockHtml(
      createBlock('button', { text: 'Buy', href: 'https://example.com', borderRadius: 25 }),
      ctx(),
    )
    expect(html).toContain('<!--[if mso]><v:roundrect')
    expect(html).toContain('arcsize=')
    expect(html).toContain('fillcolor="#4f46e5"')
    // …and the HTML button is hidden from Outlook, so the two never both show.
    expect(html).toContain('<!--[if !mso]><!-->')
  })

  it('skips VML where it cannot help: square buttons and full-width ones', () => {
    expect(renderBlockHtml(createBlock('button', { borderRadius: 0 }), ctx())).not.toContain(
      'v:roundrect',
    )
    expect(
      renderBlockHtml(createBlock('button', { borderRadius: 20, fullWidth: true }), ctx()),
    ).not.toContain('v:roundrect')
  })

  it('keeps the anchor markup every other client reads', () => {
    const html = renderBlockHtml(
      createBlock('button', { text: 'Buy', href: 'https://example.com', borderRadius: 25 }),
      ctx(),
    )
    expect(html).toContain('<a href="https://example.com" target="_blank"')
  })
})

describe('letter spacing', () => {
  it('reaches the button label and the menu links', () => {
    expect(renderBlockHtml(createBlock('button', { letterSpacing: '0.04em' }), ctx())).toContain(
      'letter-spacing:0.04em',
    )
    expect(renderBlockHtml(createBlock('menu', { letterSpacing: '0.04em' }), ctx())).toContain(
      'letter-spacing:0.04em',
    )
  })
})

describe('image width for Outlook', () => {
  it('sends a px width attribute alongside a percentage style', () => {
    const html = renderBlockHtml(
      createBlock('image', {
        src: 'https://example.com/hero.png',
        alt: 'Hero',
        width: '100%',
        pxWidth: 670,
      }),
      ctx(),
    )
    expect(html).toContain('width="670"')
    expect(html).toContain('width:100%')
  })

  it('leaves an explicit px width in charge', () => {
    const html = renderBlockHtml(
      createBlock('image', { src: 'https://x/y.png', alt: 'y', width: 480, pxWidth: 670 }),
      ctx(),
    )
    expect(html).toContain('width="480"')
  })

  it('stops the linter asking for what is already there', () => {
    /** @param {Record<string, any>} props */
    const docWith = (props) =>
      normalize(
        createDocument({
          sections: [
            createSection({
              rows: [
                createRow({ children: [createColumn({ blocks: [createBlock('image', props)] })] }),
              ],
            }),
          ],
        }),
      )
    const base = { src: 'https://example.com/hero.png', alt: 'Hero', width: '100%' }
    const before = lintDocument(docWith(base)).issues.filter((i) => i.id === 'image-width')
    const after = lintDocument(docWith({ ...base, pxWidth: 670 })).issues.filter(
      (i) => i.id === 'image-width',
    )
    expect(before).toHaveLength(1)
    expect(after).toHaveLength(0)
  })
})

describe('link contrast', () => {
  /** @param {Record<string, any>} props */
  const docWith = (props) =>
    normalize(
      createDocument({
        settings: { contentBackgroundColor: '#ffffff' },
        sections: [
          createSection({
            props: { backgroundColor: '#ffffff' },
            rows: [
              createRow({ children: [createColumn({ blocks: [createBlock('text', props)] })] }),
            ],
          }),
        ],
      }),
    )

  it('checks the link colour, not only the block colour', () => {
    const issues = lintDocument(
      docWith({ text: 'read <a href="#">this</a>', linkColor: '#f0f0f0' }),
    ).issues.filter((issue) => issue.id === 'contrast')
    expect(issues.some((issue) => issue.message.includes('Link colour'))).toBe(true)
  })

  it('says nothing about a block with no links in it', () => {
    const issues = lintDocument(docWith({ text: 'plain copy', linkColor: '#f0f0f0' })).issues
    expect(issues.some((issue) => issue.message.includes('Link colour'))).toBe(false)
  })
})

describe('lint suppression', () => {
  it('drops a rule the template has deliberately accepted', () => {
    const doc = normalize(
      createDocument({
        settings: { width: 700 },
        sections: [
          createSection({
            rows: [createRow({ children: [createColumn({ blocks: [createBlock('text')] })] })],
          }),
        ],
      }),
    )
    const all = lintDocument(doc).issues.map((issue) => issue.id)
    expect(all).toContain('structure')
    const filtered = lintDocument(doc, { disable: ['structure'] }).issues.map((issue) => issue.id)
    expect(filtered).not.toContain('structure')
  })
})
