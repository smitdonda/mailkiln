/**
 * The ten built-in blocks.
 *
 * They go through the same `defineBlock` a third-party block does, so what is
 * checked here is what makes each one worth shipping: the client workaround it
 * encodes, and the lint hook it carries.
 */

import { describe, expect, it } from 'vitest'
import {
  ALIGN_FIELD,
  BACKGROUND_FIELD,
  FONT_OPTIONS,
  PADDING_FIELD,
  WEIGHT_OPTIONS,
  builtinBlocks,
  commonProps,
  createBlock,
  createDocument,
  createRenderContext,
  getBlockDef,
  renderBlockContent,
  requireBlockDef,
  stripTags,
} from '../../src/core/index.js'
import { mjCommonAttrs, widthValue } from '../../src/core/blocks/shared.js'
import { spacing } from '../../src/core/schema.js'

const ctx = createRenderContext(createDocument())
const editing = createRenderContext(createDocument(), { options: { editable: true } })

/**
 * @param {string} type
 * @param {Record<string, any>} [props]
 * @param {import('../../src/core/types.js').RenderContext} [context]
 * @returns {string}
 */
function html(type, props = {}, context = ctx) {
  return renderBlockContent(createBlock(type, props), context)
}

/**
 * @param {string} type
 * @param {Record<string, any>} props
 * @returns {import('../../src/core/types.js').LintIssue[]}
 */
function lint(type, props) {
  const def = requireBlockDef(type)
  return def.lint?.({ ...def.defaultProps, ...props }, /** @type {any} */ ({})) ?? []
}

describe('the palette', () => {
  it('ships ten blocks, each with a label, a group and an html renderer', () => {
    expect(builtinBlocks).toHaveLength(10)
    for (const def of builtinBlocks) {
      expect(def.label).toBeTruthy()
      expect(def.group).toBeTruthy()
      expect(typeof def.render.html).toBe('function')
      expect(getBlockDef(def.type)).toBe(def)
    }
  })

  it('declares every schema key in its own defaults', () => {
    for (const def of builtinBlocks) {
      for (const field of def.schema ?? []) {
        expect(def.defaultProps).toHaveProperty(field.key.split('.')[0])
      }
    }
  })
})

describe('shared field helpers', () => {
  it('gives every block the same four wrapper props', () => {
    expect(commonProps()).toEqual({
      padding: spacing(8, 24),
      align: 'left',
      backgroundColor: '',
      hideOnMobile: false,
    })
    expect(commonProps({ align: 'center' }).align).toBe('center')
  })

  it('offers "inherit from the document" as the first font', () => {
    expect(FONT_OPTIONS[0]).toEqual({ value: '', label: 'Document default' })
    expect(WEIGHT_OPTIONS.map((o) => o.value)).toContain('bold')
    expect(PADDING_FIELD.type).toBe('spacing')
    expect(ALIGN_FIELD.type).toBe('align')
    expect(BACKGROUND_FIELD.key).toBe('backgroundColor')
  })

  it('normalizes a width that may be px, percent or a bare number', () => {
    expect(widthValue(480, 600)).toEqual({ css: '480px', attr: '480', isPercent: false })
    expect(widthValue('100%', 600)).toEqual({ css: '100%', attr: undefined, isPercent: true })
    expect(widthValue('320px', 600)).toEqual({ css: '320px', attr: '320', isPercent: false })
    expect(widthValue('320', 600)).toEqual({ css: '320px', attr: '320', isPercent: false })
    expect(widthValue('wide', 600)).toEqual({ css: '600px', attr: '600', isPercent: false })
  })

  it('sends padding, alignment and cell background to MJML as attributes', () => {
    expect(
      mjCommonAttrs({ padding: spacing(4, 8), align: 'center', backgroundColor: '#eee' }),
    ).toBe(' padding="4px 8px 4px 8px" align="center" container-background-color="#eee"')
    expect(mjCommonAttrs({ padding: spacing(0) })).toBe(' padding="0"')
    expect(mjCommonAttrs({ padding: spacing(0), align: 'left' }, { align: false })).toBe(
      ' padding="0"',
    )
  })

  it('strips tags and the entities the renderers emit', () => {
    expect(stripTags('<p>Hello <b>there</b></p><p>again</p>')).toBe('Hello there\nagain')
    expect(stripTags('<p>a</p><br><br><br><p>b</p>')).toBe('a\n\nb')
    expect(stripTags('a<br>b')).toBe('a\nb')
    expect(stripTags('&amp; &lt; &gt; &quot; &#39; &nbsp;x')).toBe('& < > " \' x')
    expect(stripTags(/** @type {any} */ (null))).toBe('')
  })
})

describe('text and heading', () => {
  it('writes typography inline, with the Outlook line-height rule', () => {
    const out = html('text', { text: 'Hi', fontSize: 18, lineHeight: 1.4 })
    expect(out).toContain('font-size:18px')
    expect(out).toContain('line-height:1.4')
    expect(out).toContain('mso-line-height-rule:exactly')
  })

  it('inlines the link colour, since a stylesheet does not reach an anchor', () => {
    const out = html('text', { text: 'see <a href="#">this</a>', linkColor: '#ff0000' })
    expect(out).toContain('<a href="#" style="color:#ff0000">')
  })

  it('applies paragraph spacing only when the field is set', () => {
    expect(html('text', { text: '<p>a</p>', paragraphSpacing: 12 })).toContain('margin:0 0 12px')
    expect(html('text', { text: '<p>a</p>' })).toContain('<p>a</p>')
  })

  it('emits a real heading tag, clamped to h1–h6', () => {
    expect(html('heading', { text: 'Hi', level: 3 })).toContain('<h3')
    expect(html('heading', { text: 'Hi', level: 9 })).toContain('<h6')
    expect(html('heading', { text: 'Hi', level: 0 })).toContain('<h1')
    expect(html('heading', { text: 'Hi', level: 'x' })).toContain('<h2')
  })

  it('marks the inline-editable prop for the canvas only', () => {
    expect(html('text', { text: 'Hi' }, editing)).toContain('data-mk-edit="text"')
    expect(html('heading', { text: 'Hi' }, editing)).toContain('data-mk-edit="text"')
    expect(html('text', { text: 'Hi' })).not.toContain('data-mk-edit')
  })
})

describe('button', () => {
  it('puts the padding on the cell, because Outlook ignores it on an anchor', () => {
    const out = html('button', { text: 'Go', href: 'https://x.test' })
    expect(out).toContain('padding:14px 28px')
    expect(out).toContain('mso-padding-alt:0')
    expect(out).toContain('bgcolor="#4f46e5"')
  })

  it('writes a VML twin for a rounded button, and hides the table from Outlook', () => {
    const out = html('button', { text: 'Go', href: 'https://x.test', borderRadius: 6 })
    expect(out).toContain('<v:roundrect')
    expect(out).toContain('arcsize=')
    expect(out).toContain('<!--[if !mso]><!-->')
  })

  it('skips the VML when there is nothing to round or no width to give it', () => {
    expect(html('button', { text: 'Go', borderRadius: 0 })).not.toContain('v:roundrect')
    expect(html('button', { text: 'Go', borderRadius: 6, fullWidth: true })).not.toContain(
      'v:roundrect',
    )
  })

  it('escapes the destination into the href', () => {
    expect(html('button', { text: 'Go', href: 'https://x.test/?a=1&b=2' })).toContain(
      'href="https://x.test/?a=1&amp;b=2"',
    )
  })

  it('calls out a dead link, and a relative one', () => {
    expect(lint('button', { href: '#' })[0]).toMatchObject({
      id: 'button-href',
      level: 'error',
    })
    expect(lint('button', { href: '/signup' })[0]).toMatchObject({ level: 'warn' })
    expect(lint('button', { href: 'https://x.test' })).toEqual([])
    expect(lint('button', { href: '{{cta_url}}' })).toEqual([])
    expect(lint('button', { href: 'mailto:a@b.test' })).toEqual([])
  })
})

describe('image', () => {
  it('renders nothing without a source, and a placeholder only on the canvas', () => {
    expect(html('image', { src: '' })).toBe('')
    expect(html('image', { src: '' }, editing)).toContain('No image selected')
  })

  it('blocks the descender gap that seams stacked images', () => {
    expect(html('image', { src: 'https://i.test/a.png', alt: 'a' })).toContain('display:block')
  })

  it('sends a pixel width to Outlook even when the CSS width is fluid', () => {
    const out = html('image', {
      src: 'https://i.test/a.png',
      alt: 'a',
      width: '100%',
      pxWidth: 552,
    })
    expect(out).toContain('width="552"')
    expect(out).toContain('width:100%')
  })

  it('wraps the image in an anchor when it links somewhere', () => {
    const out = html('image', { src: 'https://i.test/a.png', alt: 'a', href: 'https://x.test' })
    expect(out.startsWith('<a href="https://x.test"')).toBe(true)
  })

  it('warns about a missing alt only once there is an image to describe', () => {
    expect(lint('image', { src: 'https://i.test/a.png', alt: '' })[0]?.id).toBe('image-alt')
    expect(lint('image', { src: '', alt: '' })).toEqual([])
  })
})

describe('divider and spacer', () => {
  it('paints a solid rule as a coloured cell, not an hr', () => {
    const out = html('divider', { color: '#cccccc', height: 2 })
    expect(out).toContain('background-color:#cccccc')
    expect(out).toContain('height="2"')
    expect(out).not.toContain('<hr')
  })

  it('switches to a border for a dashed or dotted rule', () => {
    const out = html('divider', { style: 'dashed', color: '#e5e7eb' })
    expect(out).toContain('border-top:1px dashed #e5e7eb')
    expect(out).not.toContain('height=')
  })

  it('gives a spacer both the attribute and the style, because Outlook uses the attribute', () => {
    const out = html('spacer', { height: 32 })
    expect(out).toContain('height="32"')
    expect(out).toContain('height:32px')
    expect(out).toContain('&nbsp;')
  })
})

describe('menu', () => {
  it('ships a table for Outlook and inline anchors for everyone else', () => {
    const out = html('menu', {
      items: [
        { label: 'Shop', url: 'https://s.test' },
        { label: 'About', url: 'https://a.test' },
      ],
    })
    expect(out).toContain('<!--[if mso]><table')
    expect(out).toContain('<!--[if !mso]><!-->')
    expect(out.match(/Shop/g) ?? []).toHaveLength(2)
  })

  it('draws the separator between items and not after the last', () => {
    const out = html('menu', {
      separator: '|',
      items: [
        { label: 'A', url: 'https://a.test' },
        { label: 'B', url: 'https://b.test' },
      ],
    })
    expect((out.match(/>\|</g) ?? []).length).toBe(2)
  })

  it('stacks a vertical menu and drops the Outlook table', () => {
    const out = html('menu', { layout: 'vertical' })
    expect(out).toContain('display:block')
    expect(out).not.toContain('[if mso]')
  })

  it('renders nothing when it has no items', () => {
    expect(html('menu', { items: [] })).toBe('')
  })
})

describe('social', () => {
  it('falls back to styled text links when no icon URL is given', () => {
    const out = html('social', {
      links: [{ network: 'twitter', label: 'Twitter', url: 'https://t.test', iconUrl: '' }],
    })
    expect(out).toContain('text-decoration:underline')
    expect(out).toContain('>Twitter</a>')
    expect(out).not.toContain('<img')
  })

  it('uses the icon, sized and labelled, when there is one', () => {
    const out = html('social', {
      links: [{ network: 'x', label: 'X', url: 'https://x.test', iconUrl: 'https://i.test/x.png' }],
      iconSize: 24,
    })
    expect(out).toContain('<img src="https://i.test/x.png" alt="X" width="24" height="24"')
  })

  it('renders nothing for an empty list, and drops links with no destination', () => {
    expect(html('social', { links: [] })).toBe('')
    expect(html('social', { links: [{ network: 'web', label: 'x', url: '', iconUrl: '' }] })).toBe(
      '<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse"><tr></tr></table>',
    )
  })

  it('warns about an icon with nothing to use as alt text', () => {
    expect(
      lint('social', { links: [{ iconUrl: 'https://i.test/x.png', label: '', network: '' }] }),
    ).toHaveLength(1)
  })
})

describe('video thumbnail', () => {
  it('is a linked still with a caption, since no client plays video', () => {
    const out = html('videoThumb', {
      videoUrl: 'https://youtu.be/a',
      thumbnailUrl: 'https://i.test/t.png',
      caption: 'Watch',
    })
    expect(out).toContain('href="https://youtu.be/a"')
    expect(out).toContain('<img src="https://i.test/t.png"')
    expect(out).toContain('>Watch</a>')
    expect(out).not.toContain('<video')
  })

  it('emits nothing rather than a clickable void', () => {
    expect(
      html('videoThumb', { videoUrl: 'https://youtu.be/a', thumbnailUrl: '', caption: '' }),
    ).toBe('')
  })

  it('insists on a URL and refuses an embedded player', () => {
    expect(lint('videoThumb', { videoUrl: '' })[0]?.id).toBe('video-href')
    const embed = lint('videoThumb', {
      videoUrl: 'https://youtu.be/a',
      caption: '<iframe src="x"></iframe>',
    })
    expect(embed[0]?.id).toBe('video-embed')
  })
})

describe('raw HTML', () => {
  it('is emitted verbatim, which is the lossless half of import', () => {
    expect(html('html', { html: '<table><tr><td>kept</td></tr></table>' })).toBe(
      '<table><tr><td>kept</td></tr></table>',
    )
  })

  it('reports scripts, modern layout CSS, and its own imported status', () => {
    expect(lint('html', { html: '<script>x()</script>' })[0]).toMatchObject({
      id: 'html-script',
      level: 'error',
    })
    expect(lint('html', { html: '<div style="display:flex">x</div>' })[0]?.id).toBe(
      'html-modern-css',
    )
    expect(lint('html', { html: '<p>x</p>', imported: true })[0]).toMatchObject({
      id: 'html-imported',
      level: 'info',
    })
    expect(lint('html', { html: '<p>x</p>' })).toEqual([])
  })
})
