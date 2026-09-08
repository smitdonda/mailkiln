/**
 * The HTML renderer.
 *
 * Every assertion here corresponds to a client workaround the module documents:
 * the Outlook ghost table, the VML background, the stacking class, the hidden
 * preheader. They are checked as *markup*, because that is what gets sent.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  createBlock,
  createColumn,
  createDocument,
  createRenderContext,
  createRow,
  createSection,
  renderBlockContent,
  renderBlockHtml,
  renderSectionsHtml,
  renderToHtml,
  resetIds,
  setCondition,
  setRepeat,
  spacing,
} from '../../src/core/index.js'
import { docOf, docOfColumns, firstRowId, sampleVars } from '../support/kit.js'

afterEach(() => resetIds())

describe('document chrome', () => {
  it('opens with the XHTML doctype and the namespaces Outlook needs', () => {
    const html = renderToHtml(createDocument())
    expect(html.startsWith('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"')).toBe(
      true,
    )
    expect(html).toContain('xmlns:v="urn:schemas-microsoft-com:vml"')
    expect(html).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"')
  })

  it('carries the document language onto the html element', () => {
    expect(renderToHtml(createDocument({ settings: { language: 'hi' } }))).toContain(
      '<html lang="hi"',
    )
  })

  it('escapes the subject into the title and interpolates it first', () => {
    const html = renderToHtml(docOf([], { settings: { subject: 'Hi {{user.name}} & co' } }), {
      vars: sampleVars(),
    })
    expect(html).toContain('<title>Hi Ada &amp; co</title>')
  })

  it('declares the colour schemes only when the template is dark-mode aware', () => {
    expect(renderToHtml(createDocument())).toContain('content="light dark"')
    const plain = renderToHtml(createDocument({ settings: { darkModeAware: false } }))
    expect(plain).toContain('content="light only"')
    expect(plain).not.toContain('prefers-color-scheme:dark')
  })

  it('hides the preheader and pads it so no body copy leaks into the preview line', () => {
    const html = renderToHtml(createDocument({ settings: { preheader: 'Peek at this' } }))
    expect(html).toContain('mso-hide:all')
    expect(html).toContain('Peek at this')
    expect(html).toContain('&zwnj;')
    expect(renderToHtml(createDocument())).not.toContain('mso-hide:all')
  })
})

describe('the stylesheet', () => {
  it('breaks one pixel below the content width, not at it', () => {
    expect(renderToHtml(createDocument({ settings: { width: 600 } }))).toContain(
      '@media only screen and (max-width:599px)',
    )
    expect(renderToHtml(createDocument({ settings: { width: 480 } }))).toContain(
      '@media only screen and (max-width:479px)',
    )
  })

  it('ships the stacking, container and hide rules', () => {
    const html = renderToHtml(createDocument())
    expect(html).toContain('.mk-stack{display:block !important')
    expect(html).toContain('.mk-container{width:100% !important}')
    expect(html).toContain('.mk-hide-sm{display:none !important}')
  })

  it('writes the document link colour into the head as a backstop', () => {
    expect(renderToHtml(createDocument({ settings: { linkColor: '#ff0000' } }))).toContain(
      'a{color:#ff0000;text-decoration:none}',
    )
  })

  it('emits one scoped rule per block that sets a mobile font size', () => {
    const doc = docOf([createBlock('text', { mobileFontSize: 14 })])
    const blockId = doc.sections[0].rows[0].columns[0].blocks[0].id
    const html = renderToHtml(doc)
    expect(html).toContain(`.mk-b-${blockId} td,.mk-b-${blockId} td *{font-size:14px !important}`)
    expect(html).toContain(`class="mk-b-${blockId}"`)
  })
})

describe('sections, rows and columns', () => {
  it('pins the container width for Outlook and keeps it fluid for everyone else', () => {
    const html = renderToHtml(createDocument({ settings: { width: 640 } }))
    expect(html).toContain('<!--[if mso | IE]><table role="presentation"')
    expect(html).toContain('width="640"')
    expect(html).toContain('max-width:640px')
  })

  it("lets a section's own background beat the document content colour", () => {
    const doc = docOf([], { section: { backgroundColor: '#102030' } })
    const html = renderSectionsHtml(doc)
    expect(html).toContain('background-color:#102030')
    expect(html).not.toContain('background-color:#ffffff')
  })

  it('drops the container background entirely for a full-width section', () => {
    const doc = docOf([], { section: { backgroundColor: '#102030', fullWidth: true } })
    const html = renderSectionsHtml(doc)
    expect(html).toContain('class="mk-container"')
    expect(html.match(/background-color:#102030/g) ?? []).toHaveLength(1)
  })

  it('writes a VML twin for a section background image', () => {
    const doc = docOf([], {
      section: { backgroundImage: 'https://img.test/a.png', backgroundColor: '#123456' },
    })
    const html = renderSectionsHtml(doc)
    expect(html).toContain('<!--[if gte mso 9]><v:rect')
    expect(html).toContain('src="https://img.test/a.png"')
    expect(html).toContain('color="#123456"')
    expect(html).toContain("background-image:url('https://img.test/a.png')")
  })

  it('gives every column the stacking class unless the row opts out', () => {
    expect(renderSectionsHtml(docOfColumns([[], []]))).toContain('class="mk-stack"')
    const doc = docOfColumns([[], []])
    doc.sections[0].rows[0].props.stackOnMobile = false
    expect(renderSectionsHtml(doc)).not.toContain('class="mk-stack"')
  })

  it('sizes columns in percent for CSS and in pixels for Outlook', () => {
    const doc = createDocument({
      sections: [
        createSection({
          rows: [
            createRow({ children: [createColumn({ width: 25 }), createColumn({ width: 75 })] }),
          ],
        }),
      ],
    })
    const html = renderSectionsHtml(doc)
    expect(html).toContain('width="150"')
    expect(html).toContain('width:25%')
    expect(html).toContain('width="450"')
    expect(html).toContain('width:75%')
  })

  it('subtracts row padding before splitting the pixel widths', () => {
    const doc = docOfColumns([[], []])
    doc.sections[0].rows[0].props.padding = spacing(0, 20)
    // 600 - 40 = 560, halved.
    expect(renderSectionsHtml(doc)).toContain('width="280"')
  })

  it('halves the row gap into the inner edges only', () => {
    const doc = docOfColumns([[], [], []])
    doc.sections[0].rows[0].props.gap = 20
    const cells = renderSectionsHtml(doc).match(/<td class="mk-stack"[^>]*>/g) ?? []
    expect(cells[0]).toContain('padding-right:10px')
    expect(cells[0]).not.toContain('padding-left:10px')
    expect(cells[1]).toContain('padding-left:10px')
    expect(cells[1]).toContain('padding-right:10px')
    expect(cells[2]).not.toContain('padding-right:10px')
  })

  it('fills an empty column so it cannot collapse', () => {
    expect(renderSectionsHtml(docOf())).toContain('>&nbsp;</td>')
  })
})

describe('block wrappers', () => {
  it('wraps every block in the same padding, alignment and background cell', () => {
    const doc = docOf([
      createBlock('text', {
        padding: spacing(4, 8),
        align: 'right',
        backgroundColor: '#eeeeee',
      }),
    ])
    const html = renderSectionsHtml(doc)
    expect(html).toContain('<td align="right"')
    expect(html).toContain('padding:4px 8px 4px 8px')
    expect(html).toContain('background-color:#eeeeee')
    // Word adds its own cell spacing without these.
    expect(html).toContain('mso-table-lspace:0pt')
  })

  it('marks a hidden-on-mobile block with the class the media query targets', () => {
    const doc = docOf([createBlock('text', { hideOnMobile: true })])
    expect(renderSectionsHtml(doc)).toContain('class="mk-hide-sm"')
  })

  it('emits a visible placeholder for a block type nobody registered', () => {
    const doc = docOf([createBlock('countdown', {})])
    const html = renderSectionsHtml(doc)
    expect(html).toContain('Unknown block type "countdown"')
    expect(html).toContain('1px dashed #dc2626')
  })

  it('emits nothing at all for a block whose content is empty', () => {
    const ctx = createRenderContext(createDocument())
    const empty = createBlock('image', { src: '' })
    expect(renderBlockContent(empty, ctx)).toBe('')
    expect(renderBlockHtml(empty, ctx)).toBe('')
  })

  it('marks the inline-editable element only when the canvas asks', () => {
    const doc = createDocument()
    const block = createBlock('text', { text: 'Hi' })
    expect(renderBlockContent(block, createRenderContext(doc))).not.toContain('data-mk-edit')
    expect(
      renderBlockContent(block, createRenderContext(doc, { options: { editable: true } })),
    ).toContain('data-mk-edit="text"')
  })
})

describe('conditions and repeats', () => {
  it('removes a section, row or block whose condition is false', () => {
    let doc = docOf([createBlock('text', { text: 'Members only' })])
    const blockId = doc.sections[0].rows[0].columns[0].blocks[0].id
    doc = setCondition(doc, blockId, { path: 'user.pro', op: 'falsy' })

    expect(renderSectionsHtml(doc, { vars: sampleVars() })).not.toContain('Members only')
  })

  it('keeps a conditional node on the canvas, where it still has to be selectable', () => {
    let doc = docOf([createBlock('text', { text: 'Members only' })])
    const blockId = doc.sections[0].rows[0].columns[0].blocks[0].id
    doc = setCondition(doc, blockId, { path: 'user.pro', op: 'falsy' })

    const ctx = createRenderContext(doc, { vars: sampleVars(), options: { editable: true } })
    expect(renderBlockHtml(doc.sections[0].rows[0].columns[0].blocks[0], ctx)).toContain(
      'Members only',
    )
  })

  it('renders a repeated row once per item, each against its own scope', () => {
    let doc = docOf([createBlock('text', { text: '{{item.title}}' })])
    doc = setRepeat(doc, firstRowId(doc), { path: 'order.items', as: 'item' })

    const html = renderSectionsHtml(doc, { vars: sampleVars() })
    expect(html).toContain('Kiln')
    expect(html).toContain('Clay')
  })

  it('honours the preview count when the array is longer than it', () => {
    let doc = docOf([createBlock('text', { text: '{{item.title}}' })])
    doc = setRepeat(doc, firstRowId(doc), {
      path: 'order.items',
      as: 'item',
      previewCount: 1,
    })
    const html = renderSectionsHtml(doc, { vars: sampleVars() })
    expect(html).toContain('Kiln')
    expect(html).not.toContain('Clay')
  })
})

describe('renderSectionsHtml()', () => {
  it('is the body content with none of the document chrome', () => {
    const doc = docOf([createBlock('text', { text: 'Body' })])
    const fragment = renderSectionsHtml(doc)
    expect(fragment).toContain('Body')
    expect(fragment).not.toContain('<!DOCTYPE')
    expect(fragment).not.toContain('<style')
  })
})
