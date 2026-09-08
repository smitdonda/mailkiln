/**
 * `stripUnsafeHtml` — the pass that makes untrusted block markup safe to hand
 * to `innerHTML`.
 *
 * The threat it answers is specific: `props.text` is inline HTML by design, the
 * document is plain JSON, and the importer keeps whatever a third-party email
 * brought with it. `innerHTML` will not run a `<script>`, but it attaches every
 * `on*` handler it is given — in the host application's origin.
 *
 * Two properties matter as much as the stripping: it never deletes copy, and it
 * leaves ordinary markup byte-identical, because it runs on every block on
 * every render.
 */

import { describe, expect, it } from 'vitest'
import { stripUnsafeHtml } from '../../src/core/index.js'

describe('stripUnsafeHtml()', () => {
  it('leaves markup that does nothing exactly as it was', () => {
    const safe =
      '<p style="margin:0"><b>Bold</b> and <a href="https://x.test" target="_blank">a link</a><br>' +
      '<img src="https://i.test/a.png" alt="A &amp; B" width="100"></p>'
    expect(stripUnsafeHtml(safe)).toBe(safe)
  })

  it('short-circuits on a string with no markup in it at all', () => {
    expect(stripUnsafeHtml('Hi {{user.name}} — 5 > 3')).toBe('Hi {{user.name}} — 5 > 3')
    expect(stripUnsafeHtml('')).toBe('')
  })

  it('removes an event handler however it was quoted', () => {
    expect(stripUnsafeHtml('<img src="x" onerror="steal()">')).toBe('<img src="x">')
    expect(stripUnsafeHtml("<img src='x' onerror='steal()'>")).toBe("<img src='x'>")
    expect(stripUnsafeHtml('<img src=x onerror=steal()>')).toBe('<img src=x>')
    expect(stripUnsafeHtml('<b ONMOUSEOVER="x()">hi</b>')).toBe('<b>hi</b>')
  })

  it('removes every handler on an element, not just the first', () => {
    expect(stripUnsafeHtml('<a href="#" onclick="a()" onmouseover="b()" title="t">x</a>')).toBe(
      '<a href="#" title="t">x</a>',
    )
  })

  it('is not fooled by an attribute value that contains a closing bracket', () => {
    expect(stripUnsafeHtml('<b title="a > b" onclick="x()">hi</b>')).toBe('<b title="a > b">hi</b>')
  })

  it('leaves the word "onclick" alone when it is just text', () => {
    expect(stripUnsafeHtml('<p>Set onclick="x" in your handler</p>')).toBe(
      '<p>Set onclick="x" in your handler</p>',
    )
  })

  it('empties a URL that runs code instead of fetching something', () => {
    expect(stripUnsafeHtml('<a href="javascript:steal()">go</a>')).toBe('<a href="">go</a>')
    expect(stripUnsafeHtml('<a href="VBScript:x">go</a>')).toBe('<a href="">go</a>')
    expect(stripUnsafeHtml('<iframe srcdoc="&lt;script&gt;">')).toBe('')
    expect(stripUnsafeHtml('<img src="data:text/html;base64,PHN2Zz4=">')).toBe('<img src="">')
  })

  it('sees through the spellings a browser still navigates', () => {
    expect(stripUnsafeHtml('<a href="  JaVaScRiPt:x()">go</a>')).toBe('<a href="">go</a>')
    expect(stripUnsafeHtml('<a href="java\tscript:x()">go</a>')).toBe('<a href="">go</a>')
    expect(stripUnsafeHtml('<a href="&#106;avascript:x()">go</a>')).toBe('<a href="">go</a>')
  })

  it('keeps the URLs an email actually uses', () => {
    const links =
      '<a href="https://x.test/a?b=1&amp;c=2">a</a><a href="mailto:hi@x.test">b</a>' +
      '<a href="tel:+15550100">c</a><a href="#anchor">d</a><a href="/relative">e</a>' +
      '<img src="cid:logo"><img src="data:image/png;base64,AAA">'
    expect(stripUnsafeHtml(links)).toBe(links)
  })

  it('drops a script element and its body, rather than pasting code as copy', () => {
    expect(stripUnsafeHtml('Hi <script>window.x=1</script>there')).toBe('Hi there')
    expect(stripUnsafeHtml('Hi <script src="https://evil.test/a.js"></script>there')).toBe(
      'Hi there',
    )
    // Unclosed — a truncated paste, or a deliberate one.
    expect(stripUnsafeHtml('Hi <script>there')).toBe('Hi there')
  })

  it('drops what embeds or loads, and keeps the words around it', () => {
    expect(stripUnsafeHtml('a<iframe src="https://evil.test"></iframe>b')).toBe('ab')
    expect(stripUnsafeHtml('a<object data="x.swf">fallback</object>b')).toBe('afallbackb')
    expect(stripUnsafeHtml('a<form action="https://evil.test">Send</form>b')).toBe('aSendb')
  })

  it('handles the payload that reached the live canvas', () => {
    const payload = 'Hi <img src=x onerror="window.__pwned=1"> <script>window.__pwned2=1</script>'
    expect(stripUnsafeHtml(payload)).toBe('Hi <img src=x> ')
  })

  it('takes the handler off an svg without unwrapping the drawing', () => {
    expect(stripUnsafeHtml('<svg onload="x()"><circle r="1" /></svg>')).toBe(
      '<svg><circle r="1" /></svg>',
    )
  })

  it('unwraps nothing when asked to clean something that is not a string', () => {
    expect(stripUnsafeHtml(/** @type {any} */ (null))).toBe('')
    expect(stripUnsafeHtml(/** @type {any} */ (undefined))).toBe('')
    expect(stripUnsafeHtml(/** @type {any} */ (42))).toBe('')
  })

  it('is idempotent — the editor runs it on every render', () => {
    const dirty = '<a href="javascript:x()" onclick="y()">go</a><script>z()</script>'
    const once = stripUnsafeHtml(dirty)
    expect(stripUnsafeHtml(once)).toBe(once)
  })
})
