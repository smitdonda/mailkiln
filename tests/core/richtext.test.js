/**
 * contentEditable and clipboard sanitisation.
 *
 * The two rules the module promises — unwrap rather than drop, and map
 * formatting before discarding it — are what most of these specs check. Both
 * exist so that editing a block can never delete the author's words.
 */

import { describe, expect, it } from 'vitest'
import { RICHTEXT_TAGS, normalizePastedHtml, normalizeRichText } from '../../src/core/index.js'
import { parseHtml } from '../support/kit.js'

/**
 * @param {string} html
 * @returns {string}
 */
const clean = (html) => normalizeRichText(html, { parseHtml })

describe('normalizeRichText()', () => {
  it('keeps the inline tags email can actually render', () => {
    expect(clean('Hello <b>world</b>')).toBe('Hello <b>world</b>')
    expect(clean('<ul><li>one</li><li>two</li></ul>')).toBe('<ul><li>one</li><li>two</li></ul>')
    expect(RICHTEXT_TAGS.has('A')).toBe(true)
    expect(RICHTEXT_TAGS.has('DIV')).toBe(false)
  })

  it('unwraps a block element but leaves a break where it was', () => {
    expect(clean('<div>a</div><div>b</div>')).toBe('a<br />b')
    expect(clean('<p>one</p><p>two</p>')).toBe('one<br />two')
  })

  it('keeps the words of a container it cannot keep', () => {
    expect(clean('<table><tr><td>cell</td></tr></table>')).toBe('cell')
    expect(clean('<section><article>deep</article></section>')).toContain('deep')
  })

  it('maps styled formatting onto the semantic tag it means', () => {
    expect(clean('<span style="font-weight:700">bold</span>')).toBe('<b>bold</b>')
    expect(clean('<span style="font-weight:bold">bold</span>')).toBe('<b>bold</b>')
    expect(clean('<font style="font-style:italic">it</font>')).toBe('<i>it</i>')
    expect(clean('<span style="text-decoration:underline line-through">u</span>')).toBe(
      '<u><s>u</s></u>',
    )
  })

  it('does not apply the same formatting twice', () => {
    // The underline became a <u>, so it must not also survive in the style.
    expect(clean('<span style="text-decoration:underline">u</span>')).toBe('<u>u</u>')
  })

  it('keeps only the three CSS properties a mail client can be trusted with', () => {
    expect(clean('<span style="color:#f00;font-size:40px">c</span>')).toBe(
      '<span style="color:#f00">c</span>',
    )
  })

  it('adds target and rel to a safe anchor and keeps its colour', () => {
    expect(clean('<a href="https://x.test" style="color:#5c6779">link</a>')).toBe(
      '<a href="https://x.test" target="_blank" rel="noopener" style="color:#5c6779">link</a>',
    )
  })

  it('accepts the schemes email uses, including a merge tag', () => {
    for (const href of ['mailto:a@b.test', 'tel:+1', '#anchor', '/path', '{{unsubscribe_url}}']) {
      expect(clean(`<a href="${href}">x</a>`)).toContain(`href="${href}"`)
    }
  })

  it('drops the link but keeps the words when the scheme is not safe', () => {
    expect(clean('<a href="javascript:alert(1)">bad</a>')).toBe('bad')
    expect(clean('<a>no href</a>')).toBe('no href')
  })

  it('removes script and style content entirely — it is not readable copy', () => {
    expect(clean('<script>evil()</script>keep')).toBe('keep')
    expect(clean('<style>.x{color:red}</style>keep')).toBe('keep')
  })

  it('escapes text that would otherwise become markup', () => {
    expect(clean('a &amp; b < c')).toBe('a &amp; b &lt; c')
  })

  it('tidies the leftovers of an unwrap', () => {
    expect(clean('<b></b><i> </i>x')).toBe('x')
    expect(clean('<br><br><br><br>x<br>')).toBe('x')
    expect(clean('  spaced   out  ')).toBe('spaced out')
  })

  it('keeps a non-breaking space, which is spacing the author asked for', () => {
    expect(clean('<div>a  b</div>')).toBe('a  b')
  })

  it('is idempotent, because it runs on every commit', () => {
    const messy =
      '<div><span style="font-weight:700">Hi</span> <a href="https://x.test">there</a></div><p>again</p>'
    const once = clean(messy)
    expect(clean(once)).toBe(once)
  })

  it('short-circuits plain text without needing a parser at all', () => {
    expect(normalizeRichText('  just   words  ')).toBe('just words')
    expect(normalizeRichText('')).toBe('')
    expect(normalizeRichText(/** @type {any} */ (null))).toBe('')
  })

  it('says what to do when there is markup and no DOM', () => {
    expect(() => normalizeRichText('<b>x</b>')).toThrow(/no DOM parser available/)
    expect(() => normalizeRichText('<b>x</b>')).toThrow(/linkedom/)
  })
})

describe('normalizePastedHtml()', () => {
  it('prefers the HTML flavour of the clipboard', () => {
    expect(normalizePastedHtml({ html: '<b>x</b>', text: 'x' }, { parseHtml })).toBe('<b>x</b>')
  })

  it('falls back to plain text, keeping the line breaks', () => {
    expect(normalizePastedHtml({ text: 'a\nb' }, { parseHtml })).toBe('a<br />b')
    expect(normalizePastedHtml({ text: 'a\r\nb' }, { parseHtml })).toBe('a<br />b')
  })

  it('escapes the plain-text flavour rather than trusting it', () => {
    expect(normalizePastedHtml({ text: '<b>not bold</b>' }, { parseHtml })).toBe(
      '&lt;b&gt;not bold&lt;/b&gt;',
    )
  })

  it('is empty when the clipboard is', () => {
    expect(normalizePastedHtml({}, { parseHtml })).toBe('')
    expect(normalizePastedHtml({ html: '   ' }, { parseHtml })).toBe('')
  })
})
