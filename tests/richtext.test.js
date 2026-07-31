import { describe, expect, it } from 'vitest'
import { RICHTEXT_TAGS, normalizePastedHtml, normalizeRichText } from '../src/core/index.js'
import { parseHtml } from './helpers.js'

/**
 * @param {string} html
 * @returns {string}
 */
const clean = (html) => normalizeRichText(html, { parseHtml })

describe('normalizeRichText', () => {
  it('leaves already-clean markup alone', () => {
    expect(clean('Hello <b>world</b>')).toBe('Hello <b>world</b>')
    expect(clean('a<br />b')).toBe('a<br />b')
    expect(clean('plain text')).toBe('plain text')
    expect(clean('')).toBe('')
  })

  it('is idempotent — it runs on every commit', () => {
    const messy =
      '<div style="mso-x:1"><span style="font-weight:700">Bold</span> and <FONT color="red"><i>italic</i></FONT></div>'
    const once = clean(messy)
    expect(clean(once)).toBe(once)
  })

  it('maps styled spans to semantic tags rather than dropping the formatting', () => {
    expect(clean('<span style="font-weight:bold">hi</span>')).toBe('<b>hi</b>')
    expect(clean('<span style="font-weight:700">hi</span>')).toBe('<b>hi</b>')
    expect(clean('<span style="font-style:italic">hi</span>')).toBe('<i>hi</i>')
    expect(clean('<span style="text-decoration:underline">hi</span>')).toBe('<u>hi</u>')
    expect(clean('<span style="text-decoration:line-through">hi</span>')).toBe('<s>hi</s>')
  })

  it('combines several implied tags', () => {
    expect(clean('<span style="font-weight:bold;font-style:italic">hi</span>')).toBe(
      '<b><i>hi</i></b>',
    )
  })

  it('unwraps unknown elements but keeps their text', () => {
    // The guarantee: editing can never delete the author's words.
    expect(clean('<article><figure>kept</figure></article>')).toContain('kept')
    expect(clean('<table><tr><td>cell</td></tr></table>')).toContain('cell')
    expect(clean('<custom-element>text</custom-element>')).toBe('text')
  })

  it('turns block elements into line breaks instead of running text together', () => {
    expect(clean('<div>one</div><div>two</div>')).toBe('one<br />two')
    expect(clean('<p>one</p><p>two</p>')).toBe('one<br />two')
    expect(clean('<h2>Title</h2>body')).toBe('Title<br />body')
  })

  it('drops script and style outright, content included', () => {
    expect(clean('a<script>alert(1)</script>b')).toBe('ab')
    expect(clean('a<style>.x{color:red}</style>b')).toBe('ab')
  })

  it('strips every attribute except a safe href and whitelisted styles', () => {
    expect(clean('<b class="x" id="y" onclick="evil()">hi</b>')).toBe('<b>hi</b>')
    expect(clean('<span style="color:#ff0000;font-size:40px;position:absolute">hi</span>')).toBe(
      '<span style="color:#ff0000">hi</span>',
    )
  })

  it('keeps link colours, which the templates rely on', () => {
    // A blanket style strip would silently recolour every footer link.
    expect(clean('<a href="https://x.dev" style="color:#5c6779">Unsubscribe</a>')).toBe(
      '<a href="https://x.dev" target="_blank" rel="noopener" style="color:#5c6779">Unsubscribe</a>',
    )
  })

  it('adds target and rel to links', () => {
    expect(clean('<a href="https://x.dev">go</a>')).toContain('target="_blank" rel="noopener"')
  })

  it('accepts the URL schemes email uses, including merge variables', () => {
    for (const href of ['https://x.dev', 'mailto:a@b.co', 'tel:+441234', '{{unsubscribe_url}}']) {
      expect(clean(`<a href="${href}">x</a>`), href).toContain(`href="${href}"`)
    }
  })

  it('removes a javascript: link but keeps its text', () => {
    const out = clean('<a href="javascript:alert(1)">click me</a>')
    expect(out).toBe('click me')
    expect(out).not.toContain('javascript')
  })

  it('keeps lists', () => {
    expect(clean('<ul><li>one</li><li>two</li></ul>')).toBe('<ul><li>one</li><li>two</li></ul>')
    expect(clean('<ol><li>one</li></ol>')).toBe('<ol><li>one</li></ol>')
  })

  it('leaves merge tags untouched', () => {
    expect(clean('Hi <b>{{user.name}}</b>, order {{order.id}}')).toBe(
      'Hi <b>{{user.name}}</b>, order {{order.id}}',
    )
  })

  it('escapes text that would otherwise become markup', () => {
    expect(clean('<div>5 &lt; 6 &amp; 7 &gt; 2</div>')).toBe('5 &lt; 6 &amp; 7 &gt; 2')
  })

  it('drops empty formatting tags left behind by unwrapping', () => {
    expect(clean('<b></b>text<i>  </i>')).toBe('text')
    expect(clean('<b><i></i></b>')).toBe('')
  })

  it('trims and collapses runs of breaks', () => {
    expect(clean('<br /><br />text<br /><br /><br /><br />')).toBe('text')
    expect(clean('a<br /><br /><br /><br />b')).toBe('a<br /><br />b')
  })

  it('survives a realistic Word / Google Docs paste', () => {
    // The actual reason this module exists.
    const word = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office">
      <head><style>p.MsoNormal{margin:0}</style></head>
      <body>
        <p class="MsoNormal" style="mso-margin-top-alt:auto">
          <span style="font-size:12.0pt;font-family:Calibri;font-weight:bold">Quarterly update</span>
        </p>
        <p class="MsoNormal">
          <span style="font-family:Calibri">Revenue was <span style="font-style:italic">up</span>.
          See <a href="https://example.com/report">the report</a>.</span>
        </p>
        <o:p></o:p>
      </body></html>`

    const out = clean(word)
    expect(out).toBe(
      '<b>Quarterly update</b><br />Revenue was <i>up</i>. See ' +
        '<a href="https://example.com/report" target="_blank" rel="noopener">the report</a>.',
    )
    expect(out).not.toMatch(/mso-|MsoNormal|Calibri|font-size|class=/)
  })

  it('exposes the tag whitelist', () => {
    expect(RICHTEXT_TAGS.has('B')).toBe(true)
    expect(RICHTEXT_TAGS.has('DIV')).toBe(false)
    expect(RICHTEXT_TAGS.has('TABLE')).toBe(false)
  })
})

describe('normalizePastedHtml', () => {
  it('prefers the HTML flavour of the clipboard', () => {
    expect(
      normalizePastedHtml({ html: '<b>rich</b>', text: 'rich' }, { parseHtml }),
    ).toBe('<b>rich</b>')
  })

  it('falls back to plain text, preserving line breaks and escaping markup', () => {
    expect(normalizePastedHtml({ text: 'a\nb <c>' }, { parseHtml })).toBe('a<br />b &lt;c&gt;')
  })

  it('returns nothing for an empty clipboard', () => {
    expect(normalizePastedHtml({}, { parseHtml })).toBe('')
    expect(normalizePastedHtml({ html: '   ' }, { parseHtml })).toBe('')
  })
})
