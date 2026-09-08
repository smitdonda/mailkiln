/**
 * The serialization primitives, and the tiny JSX AST.
 *
 * These are the reason this package has no `juice` dependency and no
 * `prettier` dependency: styles are written inline at emit time, and the JSX
 * printer is ninety lines. Both are small enough to be checked exactly.
 */

import { describe, expect, it } from 'vitest'
import {
  TABLE_CLOSE,
  attrs,
  el,
  escapeAttr,
  escapeHtml,
  guard,
  isElement,
  isGuard,
  isLoop,
  isRaw,
  loop,
  mergeStyles,
  mso,
  needsInnerHtml,
  px,
  raw,
  spacingToCss,
  styleAttr,
  styleToString,
  tableOpen,
  varsToAttr,
  varsToChildren,
  varsToTemplate,
} from '../../src/core/index.js'
import { withLinkColor, withParagraphSpacing } from '../../src/core/render/inline.js'
import { spacing } from '../../src/core/schema.js'

describe('px()', () => {
  it('adds the unit to a number and trusts a string', () => {
    expect(px(24)).toBe('24px')
    expect(px('2em')).toBe('2em')
    expect(px('')).toBe('')
    expect(px(null)).toBe('')
  })
})

describe('styleToString()', () => {
  it('kebab-cases properties and adds px to the ones that take it', () => {
    expect(styleToString({ backgroundColor: '#fff', paddingTop: 12 })).toBe(
      'background-color:#fff;padding-top:12px',
    )
  })

  it('leaves the unitless properties alone', () => {
    expect(styleToString({ fontWeight: 700, lineHeight: 1.6, opacity: 0.5 })).toBe(
      'font-weight:700;line-height:1.6;opacity:0.5',
    )
  })

  it('gets the vendor prefixes right, which is the bug nobody sees', () => {
    // `mso--padding-alt` is silently ignored by Outlook, and looks fine
    // everywhere you can easily test.
    expect(styleToString({ msoPaddingAlt: '0' })).toBe('mso-padding-alt:0')
    expect(styleToString({ msoLineHeightRule: 'exactly' })).toBe('mso-line-height-rule:exactly')
    expect(styleToString({ WebkitTextSizeAdjust: '100%' })).toBe('-webkit-text-size-adjust:100%')
  })

  it('skips empty values and preserves the order it was given', () => {
    expect(styleToString({ color: '', margin: 0, padding: undefined, zIndex: 2 })).toBe(
      'margin:0px;z-index:2',
    )
    expect(styleToString(/** @type {any} */ (null))).toBe('')
  })
})

describe('styleAttr()', () => {
  it('is an attribute, or nothing at all', () => {
    expect(styleAttr({ color: '#000' })).toBe(' style="color:#000"')
    expect(styleAttr({})).toBe('')
  })

  it('escapes a value that would close the attribute early', () => {
    expect(styleAttr({ fontFamily: '"Comic Sans"' })).toContain('&quot;Comic Sans&quot;')
  })
})

describe('mergeStyles()', () => {
  it('lets a later value win but never lets an empty one clobber', () => {
    expect(mergeStyles({ color: 'red', margin: 0 }, { color: 'blue' })).toEqual({
      color: 'blue',
      margin: 0,
    })
    expect(mergeStyles({ color: 'red' }, { color: '' })).toEqual({ color: 'red' })
    expect(mergeStyles(null, false, undefined, { a: 1 })).toEqual({ a: 1 })
  })
})

describe('spacingToCss()', () => {
  it('writes the four-value shorthand, and nothing when every side is zero', () => {
    expect(spacingToCss(spacing(4, 8))).toBe('4px 8px 4px 8px')
    expect(spacingToCss(spacing(0))).toBe('')
    expect(spacingToCss(null)).toBe('')
  })
})

describe('escaping', () => {
  it('escapes body text without touching quotes', () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe('a &amp; b &lt; c &gt; d "e"')
    expect(escapeHtml(null)).toBe('')
  })

  it('escapes attribute values including quotes', () => {
    expect(escapeAttr('a & "b" <c>')).toBe('a &amp; &quot;b&quot; &lt;c&gt;')
    expect(escapeAttr(null)).toBe('')
  })
})

describe('attrs()', () => {
  it('skips the falsy values and emits a bare attribute for true', () => {
    expect(attrs({ src: 'a.png', alt: '', width: 0, hidden: true, border: null })).toBe(
      ' src="a.png" width="0" hidden',
    )
    expect(attrs(/** @type {any} */ (null))).toBe('')
  })
})

describe('tableOpen()', () => {
  it('carries every attribute an email client wants, every time', () => {
    expect(tableOpen()).toBe(
      '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse">',
    )
    expect(TABLE_CLOSE).toBe('</table>')
  })

  it('takes a width, an alignment, a class and extra attributes', () => {
    const open = tableOpen({
      width: '100%',
      align: 'center',
      className: 'mk-container',
      style: { maxWidth: 600 },
      extra: { bgcolor: '#fff' },
    })
    expect(open).toContain('class="mk-container"')
    expect(open).toContain('width="100%"')
    expect(open).toContain('align="center"')
    expect(open).toContain('bgcolor="#fff"')
    expect(open).toContain('style="border-collapse:collapse;max-width:600px"')
  })
})

describe('mso()', () => {
  it('wraps content in the conditional comment it was asked for', () => {
    expect(mso('<b>x</b>')).toBe('<!--[if mso]><b>x</b><![endif]-->')
    expect(mso('x', 'gte mso 9')).toBe('<!--[if gte mso 9]>x<![endif]-->')
  })
})

describe('withLinkColor()', () => {
  it('inlines the colour on every anchor, because the head stylesheet is not enough', () => {
    expect(withLinkColor('<a href="#">x</a>', '#2563eb')).toBe(
      '<a href="#" style="color:#2563eb">x</a>',
    )
  })

  it('merges into an existing style rather than replacing it', () => {
    expect(withLinkColor('<a href="#" style="font-weight:bold">x</a>', '#2563eb')).toBe(
      '<a href="#" style="font-weight:bold;color:#2563eb">x</a>',
    )
  })

  it('leaves an anchor that already declares a colour alone', () => {
    const html = '<a href="#" style="color:#ff0000">x</a>'
    expect(withLinkColor(html, '#2563eb')).toBe(html)
  })

  it('does nothing when there is no colour or no anchor', () => {
    expect(withLinkColor('<a href="#">x</a>', '')).toBe('<a href="#">x</a>')
    expect(withLinkColor('plain', '#2563eb')).toBe('plain')
  })
})

describe('withParagraphSpacing()', () => {
  it('writes a bottom margin onto every paragraph', () => {
    expect(withParagraphSpacing('<p>a</p><p>b</p>', 16)).toBe(
      '<p style="margin:0 0 16px">a</p><p style="margin:0 0 16px">b</p>',
    )
  })

  it('means "leave the client default alone" when the field is empty', () => {
    expect(withParagraphSpacing('<p>a</p>', '')).toBe('<p>a</p>')
    expect(withParagraphSpacing('<p>a</p>', null)).toBe('<p>a</p>')
    expect(withParagraphSpacing('<p>a</p>', -4)).toBe('<p>a</p>')
  })

  it('respects a margin the author already wrote', () => {
    const html = '<p style="margin-bottom:4px">a</p>'
    expect(withParagraphSpacing(html, 16)).toBe(html)
  })

  it('prepends to an unrelated style', () => {
    expect(withParagraphSpacing('<p style="color:red">a</p>', 8)).toBe(
      '<p style="margin:0 0 8px;color:red">a</p>',
    )
  })
})

describe('the JSX AST', () => {
  it('drops empty children and marks a childless element self-closing', () => {
    const node = el('Text', { style: {} }, [null, '', 'kept', undefined])
    expect(node.children).toEqual(['kept'])
    expect(node.selfClose).toBe(false)
    expect(el('Hr').selfClose).toBe(true)
  })

  it('accepts a single child as well as an array', () => {
    expect(el('Text', {}, 'one').children).toEqual(['one'])
  })

  it('tells its node kinds apart', () => {
    expect(isRaw(raw('{x}'))).toBe(true)
    expect(isElement(el('Text'))).toBe(true)
    expect(isGuard(guard('a', el('Text')))).toBe(true)
    expect(isLoop(loop('list', 'item, i', el('Text')))).toBe(true)

    expect(isRaw(el('Text'))).toBe(false)
    expect(isElement(raw('x'))).toBe(false)
    expect(isGuard(null)).toBe(false)
    expect(isLoop('string')).toBe(false)
  })
})

describe('varsToChildren()', () => {
  it('splits text into literals and expressions', () => {
    expect(varsToChildren('Hi {{user.name}}!')).toEqual(['Hi ', { __raw: '{user?.name}' }, '!'])
  })

  it('quotes a literal that JSX could not carry as text', () => {
    expect(varsToChildren('a { b')).toEqual([{ __raw: '{"a { b"}' }])
    expect(varsToChildren('  ')).toEqual([{ __raw: '{"  "}' }])
  })

  it('is empty for empty input', () => {
    expect(varsToChildren('')).toEqual([])
    expect(varsToChildren(/** @type {any} */ (null))).toEqual([])
  })
})

describe('varsToTemplate()', () => {
  it('is a plain string literal when there is nothing to interpolate', () => {
    expect(varsToTemplate('<b>hi</b>')).toEqual({ __raw: '"<b>hi</b>"' })
  })

  it('becomes a template literal, escaping what a template literal cannot hold', () => {
    expect(varsToTemplate('Hi {{user.name}}').__raw).toBe('`Hi ${user?.name}`')
    expect(varsToTemplate('a `b` ${c} {{x}}').__raw).toBe('`a \\`b\\` \\${c} ${x}`')
  })
})

describe('varsToAttr()', () => {
  it('leaves an ordinary attribute a plain string', () => {
    expect(varsToAttr('https://x.test')).toBe('https://x.test')
  })

  it('becomes an expression when the whole value is one tag', () => {
    expect(varsToAttr('{{order.url}}')).toEqual({ __raw: '{order?.url}' })
    expect(varsToAttr('  {{order.url}}  ')).toEqual({ __raw: '{order?.url}' })
  })

  it('becomes a template when the tag is only part of the value', () => {
    expect(varsToAttr('https://x.test/{{order.id}}')).toEqual({
      __raw: '{`https://x.test/${order?.id}`}',
    })
  })
})

describe('needsInnerHtml()', () => {
  it('spots markup that could not be emitted as JSX children', () => {
    expect(needsInnerHtml('a<br>b')).toBe(true)
    expect(needsInnerHtml('<b>x</b>')).toBe(true)
    expect(needsInnerHtml('<!-- c -->')).toBe(true)
    expect(needsInnerHtml('a < b')).toBe(false)
    expect(needsInnerHtml('plain')).toBe(false)
    expect(needsInnerHtml(/** @type {any} */ (null))).toBe(false)
  })
})
