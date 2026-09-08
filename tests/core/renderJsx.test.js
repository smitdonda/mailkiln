/**
 * Pillar 1 — the React Email emitter.
 *
 * Two properties are load-bearing and both are asserted directly: the same
 * document always produces the same bytes, and whatever the document holds the
 * result has to be valid JSX.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  REACT_EMAIL_COMPONENTS,
  createBlock,
  createColumn,
  createDocument,
  createRow,
  createSection,
  documentName,
  renderToJsx,
  renderToTsx,
  resetIds,
  setCondition,
  setRepeat,
  spacing,
  toComponentName,
} from '../../src/core/index.js'
import { docOf, docOfColumns, firstRowId, sampleVars } from '../support/kit.js'

afterEach(() => resetIds())

describe('documentName() / toComponentName()', () => {
  it('prefers the template name, falls back to the subject, then to a generic', () => {
    expect(documentName(createDocument({ settings: { name: 'Welcome v2' } }))).toBe('Welcome v2')
    expect(documentName(createDocument({ settings: { subject: '50% off' } }))).toBe('50% off')
    expect(documentName(createDocument())).toBe('EmailTemplate')
  })

  it('turns anything into a usable identifier', () => {
    expect(toComponentName('welcome email')).toBe('WelcomeEmail')
    expect(toComponentName('50% off — today only!')).toBe('Email50OffTodayOnly')
    expect(toComponentName('   ')).toBe('EmailTemplate')
    expect(toComponentName('already-Pascal')).toBe('AlreadyPascal')
  })
})

describe('renderToJsx()', () => {
  it('is byte-stable for the same document', () => {
    const doc = docOf([createBlock('text', { text: 'Hi' })])
    expect(renderToJsx(doc)).toBe(renderToJsx(doc))
  })

  it('imports exactly the react-email components it used, sorted', () => {
    const doc = docOf([createBlock('text', { text: 'Hi' })])
    const [importLine] = renderToJsx(doc).split('\n')
    expect(importLine).toBe(
      "import { Body, Container, Head, Html, Section, Text } from '@react-email/components'",
    )
    expect(REACT_EMAIL_COMPONENTS.has('Text')).toBe(true)
    expect(REACT_EMAIL_COMPONENTS.has('div')).toBe(false)
  })

  it('takes no props when the template uses no merge variables', () => {
    const code = renderToJsx(docOf([createBlock('text', { text: 'Hi' })]))
    expect(code).toContain('export function EmailTemplate()')
    expect(code).not.toContain('PreviewProps')
  })

  it('turns a merge tag into a prop reference, optional-chained', () => {
    const code = renderToJsx(docOf([createBlock('text', { text: 'Hi {{user.name}}' })]), {
      vars: sampleVars(),
    })
    expect(code).toContain('export function EmailTemplate({ user })')
    expect(code).toContain('Hi {user?.name}')
  })

  it('keeps text and its expressions on one line, so no stray space is exported', () => {
    const code = renderToJsx(docOf([createBlock('text', { text: 'Thanks, {{user.name}}!' })]), {
      vars: sampleVars(),
    })
    expect(code).toContain('Thanks, {user?.name}!')
  })

  it('emits PreviewProps from the sample data, for `react-email dev`', () => {
    const code = renderToJsx(docOf([createBlock('text', { text: '{{user.name}}' })]), {
      vars: sampleVars(),
    })
    expect(code).toContain(
      'EmailTemplate.PreviewProps = { user: { name: "Ada", pro: true, visits: 12 } }',
    )
  })

  it('documents the props with JSDoc in jsx and with an interface in tsx', () => {
    const doc = docOf([createBlock('text', { text: '{{user.name}}' })])
    const vars = sampleVars()

    expect(renderToJsx(doc, { vars })).toContain('@param {{ user: {')
    const tsx = renderToTsx(doc, { vars })
    expect(tsx).toContain('export interface EmailTemplateProps {')
    expect(tsx).toContain('export function EmailTemplate({ user }: EmailTemplateProps)')
  })

  it('names the component from the option, then the document', () => {
    const doc = docOf([], { settings: { name: 'Receipt' } })
    expect(renderToJsx(doc, { name: 'my export' })).toContain('export function MyExport()')
    expect(renderToJsx(doc)).toContain('export function Receipt()')
  })

  it('renders the preheader as a Preview element', () => {
    const code = renderToJsx(docOf([], { settings: { preheader: 'Peek' } }))
    expect(code).toContain('<Preview>Peek</Preview>')
  })
})

describe('structure', () => {
  it('skips the Row and Column wrappers for a single plain column', () => {
    const code = renderToJsx(docOf([createBlock('text', { text: 'Hi' })]))
    expect(code).not.toContain('<Row')
    expect(code).not.toContain('<Column')
  })

  it('emits Row and Column once a row really has columns', () => {
    const code = renderToJsx(docOfColumns([[createBlock('text', { text: 'a' })], []]))
    expect(code).toContain('<Row>')
    expect(code).toContain('<Column')
    expect(code).toContain('width: "50%"')
  })

  it('gives an empty column a non-breaking space so it cannot collapse', () => {
    expect(renderToJsx(docOfColumns([[], []]))).toContain("{'\\u00a0'}")
  })

  it('mirrors the HTML renderer on section backgrounds', () => {
    const tinted = renderToJsx(docOf([], { section: { backgroundColor: '#102030' } }))
    expect(tinted).toContain('backgroundColor: "#102030"')

    const fullWidth = renderToJsx(
      docOf([], { section: { backgroundColor: '#102030', fullWidth: true } }),
    )
    expect(fullWidth).toContain('<Container style={{ maxWidth: 600, width: "100%" }}>')
  })

  it('wraps a block in a Section only when it has padding, colour or alignment', () => {
    const bare = renderToJsx(
      docOf([createBlock('text', { text: 'Hi', padding: spacing(0), align: 'left' })]),
    )
    // Two Sections: the section itself, and nothing extra around the block.
    expect(bare.match(/<Section/g) ?? []).toHaveLength(1)

    const padded = renderToJsx(docOf([createBlock('text', { text: 'Hi' })]))
    expect(padded.match(/<Section/g) ?? []).toHaveLength(2)
  })
})

describe('conditions and repeats', () => {
  it('emits a condition as a real JSX guard', () => {
    let doc = docOf([createBlock('text', { text: 'Pro only' })])
    doc = setCondition(doc, doc.sections[0].id, { path: 'user.pro', op: 'truthy' })
    const code = renderToJsx(doc, { vars: sampleVars() })

    expect(code).toContain('{user?.pro && (')
    expect(code).toContain('Pro only')
  })

  it('emits a repeat as a map, with the key React needs', () => {
    let doc = docOf([createBlock('text', { text: '{{item.title}}' })])
    doc = setRepeat(doc, firstRowId(doc), { path: 'order.items', as: 'item' })
    const code = renderToJsx(doc, { vars: sampleVars() })

    expect(code).toContain('{order?.items?.map((item, itemIndex) => (')
    expect(code).toContain('<Section key={itemIndex}>')
    expect(code).toContain('{item?.title}')
  })

  it('keeps the loop variable out of the component props', () => {
    let doc = docOf([createBlock('text', { text: '{{item.title}}' })])
    doc = setRepeat(doc, firstRowId(doc), { path: 'order.items', as: 'item' })
    expect(renderToJsx(doc, { vars: sampleVars() })).toContain(
      'export function EmailTemplate({ order })',
    )
  })

  it('ignores an unfinished condition rather than emitting broken JSX', () => {
    let doc = docOf([createBlock('text', { text: 'Hi' })])
    doc = setCondition(doc, doc.sections[0].id, /** @type {any} */ ({ path: '', op: 'truthy' }))
    expect(renderToJsx(doc)).not.toContain('&& (')
  })
})

describe('it always compiles', () => {
  it('falls back to dangerouslySetInnerHTML for markup it cannot make into children', () => {
    const code = renderToJsx(docOf([createBlock('text', { text: 'a<br>b' })]))
    expect(code).toContain('dangerouslySetInnerHTML={{ __html: "a<br>b" }}')
  })

  it('builds a template literal when that markup also carries merge tags', () => {
    const code = renderToJsx(docOf([createBlock('text', { text: '<b>Hi {{user.name}}</b>' })]), {
      vars: sampleVars(),
    })
    expect(code).toContain('__html: `<b>Hi ${user?.name}</b>`')
  })

  it('degrades an unregistered block to its placeholder markup instead of failing', () => {
    const code = renderToJsx(docOf([createBlock('countdown', {})]))
    expect(code).toContain('unknown block: countdown')
    expect(code).toContain('dangerouslySetInnerHTML')
  })

  it('reaches for a block’s HTML when it declares no jsx renderer', () => {
    const doc = createDocument({
      sections: [
        createSection({
          rows: [
            createRow({
              children: [createColumn({ width: 100, blocks: [createBlock('html', {})] })],
            }),
          ],
        }),
      ],
    })
    expect(renderToJsx(doc)).toContain('dangerouslySetInnerHTML')
  })
})

describe('the head', () => {
  it('stays empty when the template has no mobile overrides', () => {
    expect(renderToJsx(docOf([createBlock('text', { text: 'Hi' })]))).toContain('<Head />')
  })

  it('carries the media query when a block hides or resizes on mobile', () => {
    const hidden = renderToJsx(docOf([createBlock('text', { hideOnMobile: true })]))
    expect(hidden).toContain('.mk-hide-sm{display:none !important}')
    expect(hidden).toContain('className="mk-hide-sm"')

    const doc = docOf([createBlock('text', { mobileFontSize: 13 })])
    const blockId = doc.sections[0].rows[0].columns[0].blocks[0].id
    const resized = renderToJsx(doc)
    expect(resized).toContain(`.mk-b-${blockId} td`)
    expect(resized).toContain(`className="mk-b-${blockId}"`)
  })
})

describe('the printer', () => {
  it('breaks a long style object onto its own lines and keeps a short one inline', () => {
    const code = renderToJsx(docOf([], { section: { backgroundColor: '#fff' } }))
    expect(code).toContain('<Container style={{ maxWidth: 600, width: "100%"')
    expect(code).toMatch(/style=\{\{\n/)
  })

  it('single-quotes a string that contains a double quote', () => {
    const code = renderToJsx(
      docOf([createBlock('text', { text: 'Hi', fontFamily: 'Comic "Sans"' })]),
    )
    expect(code).toContain(`fontFamily: 'Comic "Sans"'`)
  })

  it('never leaves three blank lines in the output', () => {
    expect(renderToJsx(docOf([createBlock('text', { text: 'Hi' })]))).not.toMatch(/\n{3}/)
  })
})
