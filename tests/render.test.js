import { describe, expect, it } from 'vitest'
import {
  builtinBlocks,
  createBlock,
  createColumn,
  createRenderContext,
  createDocument,
  createRow,
  createSection,
  exportDocument,
  normalize,
  renderBlockHtml,
  renderToHtml,
  renderToJsx,
  renderToMjml,
  renderToText,
  renderToTsx,
  toComponentName,
  documentName,
  exportFilenames,
  spacingToCss,
  styleToString,
  mergeStyles,
  escapeAttr,
  escapeHtml,
  attrs,
} from '../src/core/index.js'
import { kitchenSinkDocument, sampleVars, twoColumnDocument } from './helpers.js'

describe('inline serialization', () => {
  it('writes camelCase properties as kebab-case with px on numbers', () => {
    expect(styleToString({ fontSize: 16, backgroundColor: '#fff' })).toBe(
      'font-size:16px;background-color:#fff',
    )
  })

  it('leaves unitless properties unitless', () => {
    expect(styleToString({ lineHeight: 1.6, fontWeight: 700, opacity: 0.5 })).toBe(
      'line-height:1.6;font-weight:700;opacity:0.5',
    )
  })

  it('emits the mso- and -webkit- prefixes email needs', () => {
    expect(styleToString({ msoLineHeightRule: 'exactly' })).toBe('mso-line-height-rule:exactly')
    expect(styleToString({ msoPaddingAlt: '0' })).toBe('mso-padding-alt:0')
  })

  it('drops empty values so a later blank cannot clobber a real value', () => {
    expect(styleToString({ color: '', padding: undefined, margin: 0 })).toBe('margin:0px')
    expect(mergeStyles({ color: 'red' }, { color: '' })).toEqual({ color: 'red' })
    expect(mergeStyles({ color: 'red' }, { color: 'blue' })).toEqual({ color: 'blue' })
  })

  it('preserves authored key order for stable diffs', () => {
    expect(styleToString({ zIndex: 1, color: 'red', margin: 0 })).toBe('z-index:1;color:red;margin:0px')
  })

  it('collapses all-zero spacing to nothing', () => {
    expect(spacingToCss({ top: 0, right: 0, bottom: 0, left: 0 })).toBe('')
    expect(spacingToCss({ top: 1, right: 2, bottom: 3, left: 4 })).toBe('1px 2px 3px 4px')
    expect(spacingToCss(null)).toBe('')
  })

  it('escapes text and attributes', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d')
    expect(escapeAttr('say "hi" & <bye>')).toBe('say &quot;hi&quot; &amp; &lt;bye&gt;')
  })

  it('skips empty attributes and emits bare booleans', () => {
    expect(attrs({ a: 'x', b: '', c: null, d: undefined, e: false, f: true })).toBe(' a="x" f')
  })
})

describe('renderToHtml', () => {
  const html = renderToHtml(kitchenSinkDocument(), { vars: sampleVars })

  it('produces a full document with the email doctype and namespaces', () => {
    expect(html).toContain('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"')
    expect(html).toContain('xmlns:v="urn:schemas-microsoft-com:vml"')
    expect(html).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"')
  })

  it('includes the meta tags email clients need', () => {
    expect(html).toContain('name="x-apple-disable-message-reformatting"')
    expect(html).toContain('name="format-detection"')
    expect(html).toContain('name="color-scheme" content="light dark"')
  })

  it('emits the Outlook DPI fix and the ghost-table centring conditional', () => {
    expect(html).toContain('<o:PixelsPerInch>96</o:PixelsPerInch>')
    expect(html).toContain('<!--[if mso | IE]><table role="presentation"')
  })

  it('uses only presentation tables, never flex or grid', () => {
    expect(html).toContain('<table role="presentation"')
    expect(html).not.toMatch(/display\s*:\s*(flex|grid)/)
  })

  it('interpolates merge variables with sample data', () => {
    expect(html).toContain('Thanks, Smit!')
    expect(html).toContain('MK-2291')
  })

  it('renders the preheader hidden, with zero-width padding', () => {
    expect(html).toContain('mso-hide:all')
    expect(html).toContain('Arriving Thursday')
    expect(html).toContain('&zwnj;')
  })

  it('stacks columns on mobile via a media query', () => {
    expect(html).toContain('@media only screen and (max-width:599px)')
    expect(html).toContain('.mk-stack{display:block !important')
  })

  it('gives every column both a px width attribute and a percentage style', () => {
    const twoCol = renderToHtml(twoColumnDocument())
    // Outlook reads the attribute; everyone else reads the style.
    expect(twoCol).toContain('width="300"')
    expect(twoCol).toContain('width:50%')
  })

  it('writes a VML fallback for a section background image', () => {
    const doc = kitchenSinkDocument()
    doc.sections[0].props.backgroundImage = 'https://example.com/bg.jpg'
    const withBg = renderToHtml(doc)
    expect(withBg).toContain('<!--[if gte mso 9]><v:rect')
    expect(withBg).toContain('<v:fill type="frame"')
    expect(withBg).toContain('</v:textbox></v:rect>')
  })

  it('paints a tinted section across the content column, not just the gutters', () => {
    // The container used to paint `contentBackgroundColor` over the section's own
    // background, so a tinted band showed white in the middle — while the canvas
    // showed it correctly. WYSIWYG has to mean the same thing in both.
    const doc = kitchenSinkDocument()
    doc.sections[0].props.backgroundColor = '#eef2f7'
    const html = renderToHtml(doc)

    const container = html.slice(html.indexOf('class="mk-container"'))
    expect(container.slice(0, 220)).toContain('background-color:#eef2f7')
    expect(container.slice(0, 220)).not.toContain('#ffffff')

    // The JSX export agrees.
    const jsx = renderToJsx(doc)
    expect(jsx).toMatch(/<Container[\s\S]{0,160}backgroundColor: "#eef2f7"/)
  })

  it('lets a full-width section show its background through the container', () => {
    const doc = kitchenSinkDocument()
    doc.sections[0].props.backgroundColor = '#eef2f7'
    doc.sections[0].props.fullWidth = true
    const html = renderToHtml(doc)
    const container = html.slice(html.indexOf('class="mk-container"'), html.indexOf('<tr>', html.indexOf('class="mk-container"')))
    expect(container).not.toContain('background-color')
  })

  it('fills an empty column so it cannot collapse', () => {
    const doc = createDocument()
    expect(renderToHtml(doc)).toContain('&nbsp;')
  })

  it('renders a visible placeholder for an unregistered block instead of a silent hole', () => {
    const doc = createDocument()
    doc.sections[0].rows[0].columns[0].blocks.push({ id: 'x', type: 'ghost', props: {} })
    expect(renderToHtml(doc)).toContain('Unknown block type "ghost"')
  })

  it('is deterministic', () => {
    const doc = kitchenSinkDocument()
    expect(renderToHtml(doc)).toBe(renderToHtml(doc))
  })
})

describe('block HTML', () => {
  const ctx = createRenderContext(kitchenSinkDocument(), { vars: sampleVars })

  it('renders each built-in block to a snapshot', () => {
    for (const def of builtinBlocks) {
      const block = createBlock(def.type)
      expect(renderBlockHtml(block, ctx)).toMatchSnapshot(def.type)
    }
  })

  it('puts button padding on the cell, not the anchor', () => {
    // Outlook ignores padding on inline elements, so a padded <a> collapses there.
    const html = renderBlockHtml(createBlock('button'), ctx)
    const cell = html.slice(html.indexOf('<td'), html.indexOf('</td>'))
    expect(cell).toMatch(/padding:14px 28px/)
    expect(cell).toMatch(/mso-padding-alt:0/)
    const anchor = html.slice(html.indexOf('<a '), html.indexOf('</a>'))
    expect(anchor).not.toMatch(/padding:/)
  })

  it('gives the button its own colour without painting the wrapper cell', () => {
    const html = renderBlockHtml(createBlock('button'), ctx)
    expect(html).toContain('bgcolor="#4f46e5"')
    // The outer wrapper cell carries padding and alignment only.
    const wrapper = html.slice(0, html.indexOf('<table', 1))
    expect(wrapper).not.toContain('#4f46e5')
  })

  it('gives images display:block to avoid the descender gap', () => {
    const html = renderBlockHtml(createBlock('image', { src: 'https://x/y.png', alt: 'y' }), ctx)
    expect(html).toContain('display:block')
  })

  it('gives the spacer both a height attribute and a height style', () => {
    const html = renderBlockHtml(createBlock('spacer', { height: 40 }), ctx)
    expect(html).toContain('height="40"')
    expect(html).toContain('height:40px')
  })

  it('renders a solid divider as a coloured cell and a dashed one as a border', () => {
    expect(renderBlockHtml(createBlock('divider'), ctx)).toContain('background-color:#e5e7eb')
    expect(renderBlockHtml(createBlock('divider', { style: 'dashed' }), ctx)).toContain(
      'border-top:1px dashed',
    )
  })

  it('marks the inline-editable element only when the canvas asks for it', () => {
    const editableCtx = createRenderContext(kitchenSinkDocument(), {
      vars: sampleVars,
      options: { editable: true },
    })
    expect(renderBlockHtml(createBlock('text'), editableCtx)).toContain('data-mk-edit="text"')
    expect(renderBlockHtml(createBlock('heading'), editableCtx)).toContain('data-mk-edit="text"')
    // Default context — every export path — leaves it out.
    expect(renderBlockHtml(createBlock('text'), ctx)).not.toContain('data-mk-edit')
  })

  it('never leaks the editing marker into any export', () => {
    const doc = kitchenSinkDocument()
    const bundle = exportDocument(doc, { vars: sampleVars })
    for (const [format, source] of Object.entries(bundle)) {
      expect(source, `${format} contains the editor-only marker`).not.toContain('data-mk-edit')
    }
  })

  it('emits raw HTML verbatim', () => {
    const html = renderBlockHtml(createBlock('html', { html: '<p>kept &amp; intact</p>' }), ctx)
    expect(html).toContain('<p>kept &amp; intact</p>')
  })
})

describe('renderToJsx', () => {
  const doc = kitchenSinkDocument()
  const jsx = renderToJsx(doc, { vars: sampleVars, name: 'OrderShipped' })

  it('matches a snapshot', () => {
    expect(jsx).toMatchSnapshot()
  })

  it('imports only the react-email components it uses', () => {
    const line = jsx.split('\n')[0]
    expect(line).toMatch(/^import \{ .+ \} from '@react-email\/components'$/)
    expect(line).toContain('Html')
    expect(line).toContain('Button')
    expect(line).not.toContain('Markdown')
  })

  it('sorts the import list so the output diffs cleanly', () => {
    const names = /import \{ (.+) \}/.exec(jsx)?.[1].split(', ') ?? []
    expect(names).toEqual([...names].sort())
  })

  it('turns merge tags into real prop references', () => {
    expect(jsx).toContain('export function OrderShipped({ order, unsubscribe_url, user })')
    expect(jsx).toContain('Thanks, {user.name}!')
  })

  it('keeps mixed text and expressions on one line', () => {
    // JSX condenses a newline next to text into a space, so splitting
    // `Thanks, {user.name}!` across lines would export "Smit !".
    expect(jsx).toMatch(/Thanks, \{user\.name\}!/)
    expect(jsx).not.toMatch(/\{user\.name\}\s*\n\s*!/)
  })

  it('documents the props with JSDoc in the plain-JSX flavour', () => {
    expect(jsx).toContain('@param {{')
    expect(jsx).not.toContain('interface')
  })

  it('emits PreviewProps from the sample data so react-email dev shows real content', () => {
    expect(jsx).toContain('OrderShipped.PreviewProps = {')
    expect(jsx).toContain("name: \"Smit\"")
  })

  it('falls back to dangerouslySetInnerHTML for text containing markup', () => {
    expect(jsx).toContain('dangerouslySetInnerHTML={{ __html: `Order <b>${order.id}</b> is packed.` }}')
  })

  it('indents nested style objects under their own tag', () => {
    // A style object closing brace that lines up with the tag rather than the
    // prop is the tell-tale of a broken emitter.
    expect(jsx).not.toMatch(/\n {8}style=\{\{\n {8}\w/)
  })

  it('gives an empty column a nbsp so it cannot collapse', () => {
    const twoCol = twoColumnDocument()
    twoCol.sections[0].rows[0].columns[1].blocks = []
    expect(renderToJsx(twoCol)).toContain("{'\\u00a0'}")
  })

  it('omits the props signature entirely when no variables are used', () => {
    const plain = renderToJsx(twoColumnDocument())
    expect(plain).toContain('export function EmailTemplate()')
    expect(plain).not.toContain('@param')
  })

  it('is deterministic', () => {
    expect(renderToJsx(doc, { vars: sampleVars })).toBe(renderToJsx(doc, { vars: sampleVars }))
  })
})

describe('renderToTsx', () => {
  const tsx = renderToTsx(kitchenSinkDocument(), { vars: sampleVars, name: 'OrderShipped' })

  it('matches a snapshot', () => {
    expect(tsx).toMatchSnapshot()
  })

  it('adds a typed Props interface and annotates the signature', () => {
    expect(tsx).toContain('export interface OrderShippedProps {')
    expect(tsx).toContain('user: { name: string; email: string }')
    expect(tsx).toContain('export function OrderShipped({ order, unsubscribe_url, user }: OrderShippedProps)')
  })

  it('renders the same tree as the JSX flavour', () => {
    const jsx = renderToJsx(kitchenSinkDocument(), { vars: sampleVars, name: 'OrderShipped' })
    const strip = (/** @type {string} */ code) =>
      code
        .replace(/export interface[\s\S]*?\n}\n/, '')
        .replace(/\/\*\*[\s\S]*?\*\/\n/, '')
        .replace(/: OrderShippedProps/, '')
    expect(strip(tsx)).toBe(strip(jsx))
  })
})

describe('toComponentName', () => {
  it('makes a PascalCase identifier out of a name', () => {
    expect(toComponentName('Your order is on its way')).toBe('YourOrderIsOnItsWay')
    expect(toComponentName('50% off — today only!')).toBe('Email50OffTodayOnly')
    expect(toComponentName('')).toBe('EmailTemplate')
    expect(toComponentName(/** @type {any} */ (undefined))).toBe('EmailTemplate')
  })
})

describe('documentName', () => {
  it('prefers the template name over the subject', () => {
    const doc = kitchenSinkDocument()
    doc.settings.name = 'Order shipped v2'
    expect(documentName(doc)).toBe('Order shipped v2')
  })

  it('falls back to the subject, then to a generic name', () => {
    const doc = kitchenSinkDocument()
    expect(doc.settings.name).toBe('')
    expect(documentName(doc)).toBe('Your order is on its way')

    doc.settings.subject = ''
    expect(documentName(doc)).toBe('EmailTemplate')
  })

  it('ignores a name that is only whitespace', () => {
    const doc = kitchenSinkDocument()
    doc.settings.name = '   '
    expect(documentName(doc)).toBe('Your order is on its way')
  })

  it('names the exported component and its files', () => {
    // A subject makes a poor component name — the same subject can belong to
    // several templates, and "50% off!" is not an identifier.
    const doc = kitchenSinkDocument()
    doc.settings.name = 'Order shipped'
    const bundle = exportDocument(doc, { vars: sampleVars })
    expect(bundle.jsx).toContain('export function OrderShipped(')
    expect(bundle.tsx).toContain('interface OrderShippedProps')

    const files = exportFilenames(documentName(doc))
    expect(files.jsx).toBe('OrderShipped.jsx')
    expect(files.html).toBe('order-shipped.html')
    expect(files.json).toBe('order-shipped.mailkiln.json')
  })

  it('lets an explicit name option still win', () => {
    const doc = kitchenSinkDocument()
    doc.settings.name = 'Order shipped'
    expect(exportDocument(doc, { name: 'Override' }).jsx).toContain('export function Override(')
  })
})

describe('renderToMjml', () => {
  const mjml = renderToMjml(kitchenSinkDocument(), { vars: sampleVars })

  it('matches a snapshot', () => {
    expect(mjml).toMatchSnapshot()
  })

  it('emits a valid-looking mjml skeleton', () => {
    expect(mjml.startsWith('<mjml>')).toBe(true)
    expect(mjml).toContain('<mj-head>')
    expect(mjml).toContain('<mj-body')
    expect(mjml.trimEnd().endsWith('</mjml>')).toBe(true)
  })

  it('maps each mailkiln row to its own mj-section', () => {
    expect(mjml).toContain('<mj-section')
    expect(mjml).toContain('<mj-column')
  })

  it('uses mj-raw for blocks with no mjml renderer, so nothing is lost', () => {
    expect(mjml).toContain('<mj-raw>')
  })

  it('carries the subject and preheader into the head', () => {
    expect(mjml).toContain('<mj-title>Your order is on its way</mj-title>')
    expect(mjml).toContain('<mj-preview>Arriving Thursday</mj-preview>')
  })
})

describe('renderToText', () => {
  const text = renderToText(kitchenSinkDocument(), { vars: sampleVars })

  it('matches a snapshot', () => {
    expect(text).toMatchSnapshot()
  })

  it('strips markup and keeps the copy', () => {
    expect(text).toContain('Thanks, Smit!')
    expect(text).toContain('Order MK-2291 is packed.')
    expect(text).not.toContain('<')
  })

  it('includes link destinations, since a text part cannot be clicked through', () => {
    expect(text).toContain('https://example.com/track')
  })

  it('wraps long lines without breaking URLs', () => {
    const wrapped = renderToText(kitchenSinkDocument(), { vars: sampleVars, width: 40 })
    for (const line of wrapped.split('\n')) {
      if (!line.includes('http')) expect(line.length).toBeLessThanOrEqual(41)
    }
    expect(wrapped).toContain('https://example.com/track')
  })

  it('can be left unwrapped', () => {
    expect(renderToText(kitchenSinkDocument(), { width: 0 })).toBeTypeOf('string')
  })
})

describe('exportDocument', () => {
  it('returns all six formats', () => {
    const bundle = exportDocument(kitchenSinkDocument(), { vars: sampleVars, name: 'Probe' })
    expect(Object.keys(bundle).sort()).toEqual(['html', 'json', 'jsx', 'mjml', 'text', 'tsx'])
    expect(bundle.jsx).toContain('export function Probe')
    expect(bundle.tsx).toContain('interface ProbeProps')
    expect(JSON.parse(bundle.json).version).toBe(1)
  })

  it('round-trips the JSON member exactly — the document is never locked in', () => {
    const doc = kitchenSinkDocument()
    expect(JSON.parse(exportDocument(doc).json)).toEqual(doc)
  })
})

describe('mobile controls', () => {
  /**
   * @param {Record<string, any>} props
   * @returns {import('../src/core/types.js').EmailDocument}
   */
  const docWithText = (props) =>
    normalize(
      createDocument({
        sections: [
          createSection({
            rows: [
              createRow({
                children: [createColumn({ width: 100, blocks: [createBlock('text', props)] })],
              }),
            ],
          }),
        ],
      }),
    )

  it('emits nothing at all when no block opts in', () => {
    // The common case must stay byte-identical — mobile controls are opt-in.
    const html = renderToHtml(docWithText({ text: 'Hi' }))
    expect(html).not.toMatch(/class="mk-hide-sm/)
    expect(html).not.toMatch(/mk-b-/)
    expect(renderToJsx(docWithText({ text: 'Hi' }))).toContain('<Head />')
  })

  it('marks a hidden block and hides it below the breakpoint', () => {
    const html = renderToHtml(docWithText({ text: 'Hi', hideOnMobile: true }))
    expect(html).toContain('class="mk-hide-sm"')
    expect(html).toContain('.mk-hide-sm{display:none !important}')
    // Still present in the markup — desktop and Outlook must show it.
    expect(html).toContain('Hi')
  })

  it('scopes a mobile font size to the one block that asked for it', () => {
    const doc = docWithText({ text: 'Hi', mobileFontSize: 13 })
    const id = doc.sections[0].rows[0].columns[0].blocks[0].id
    const html = renderToHtml(doc)
    expect(html).toContain(`class="mk-b-${id}"`)
    expect(html).toContain(`.mk-b-${id} td,.mk-b-${id} td *{font-size:13px !important}`)
    // Inside the media query, not at the top level.
    expect(html.indexOf('@media only screen')).toBeLessThan(html.indexOf(`.mk-b-${id} td`))
  })

  it('ignores a font size that is not a usable number', () => {
    for (const bad of ['', 0, -4, 'big', null]) {
      expect(renderToHtml(docWithText({ text: 'Hi', mobileFontSize: bad }))).not.toMatch(/mk-b-/)
    }
  })

  it('carries both settings into the ejected component', () => {
    // The setting would be a lie if it stopped working the moment you ejected.
    const doc = docWithText({ text: 'Hi', hideOnMobile: true, mobileFontSize: 13 })
    const id = doc.sections[0].rows[0].columns[0].blocks[0].id
    const jsx = renderToJsx(doc)
    expect(jsx).toContain(`className="mk-hide-sm mk-b-${id}"`)
    expect(jsx).toContain('<style>')
    expect(jsx).toContain('@media only screen and (max-width:599px){')
    expect(jsx).toContain('.mk-hide-sm{display:none !important}')
    expect(jsx).toContain(`.mk-b-${id} td,.mk-b-${id} td *{font-size:13px !important}`)
  })

  it('keeps the plain-text version complete', () => {
    // Plain text has no viewport; dropping copy from it would be a real bug.
    expect(renderToText(docWithText({ text: 'Still here', hideOnMobile: true }))).toContain(
      'Still here',
    )
  })
})
