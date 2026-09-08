// @vitest-environment jsdom

/**
 * `<MailKiln>` end to end, in jsdom.
 *
 * Drag itself is covered by the pure resolver specs; what is checked here is
 * everything a person can reach without one — the palette, the panel, the
 * keyboard, and the three views.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MailKiln } from '../../src/react/MailKiln.jsx'
import { useStore } from '../../src/react/context.jsx'
import { isPristine } from '../../src/react/panels/BlankState.jsx'
import { targetColumnId } from '../../src/react/panels/BlockPalette.jsx'
import {
  createBlock,
  defineBlock,
  normalize,
  resetIds,
  unregisterBlock,
} from '../../src/core/index.js'
import { allBlocksIn, docOf, firstColumnId, sampleVars } from '../support/kit.js'

afterEach(() => {
  cleanup()
  resetIds()
  vi.restoreAllMocks()
})

/**
 * The editor plus a handle on whatever it last reported.
 *
 * @param {Record<string, any>} [props]
 */
function mount(props = {}) {
  const changes = /** @type {import('../../src/core/types.js').EmailDocument[]} */ ([])
  const utils = render(
    <MailKiln defaultValue={normalize(docOf())} onChange={(doc) => changes.push(doc)} {...props} />,
  )
  return { ...utils, changes, latest: () => changes[changes.length - 1] }
}

/** @returns {HTMLElement} */
function root() {
  const element = document.querySelector('.mk-root')
  if (!element) throw new Error('editor did not render')
  return /** @type {HTMLElement} */ (element)
}

/** The label the side panel is currently showing, which says which face it is on. */
function panelLabel() {
  return document.querySelector('aside.mk-panel')?.getAttribute('aria-label') ?? null
}

/**
 * @param {string} type
 * @param {string} [category] Rail category to open first.
 * @returns {HTMLElement}
 */
function paletteTile(type, category) {
  if (category) fireEvent.click(screen.getByTitle(category))
  const tile = document.querySelector(`[data-palette-block="${type}"]`)
  if (!tile) throw new Error(`no palette tile for "${type}"`)
  return /** @type {HTMLElement} */ (tile)
}

describe('first render', () => {
  it('shows the toolbar, the structure pane, the canvas and the panel', () => {
    mount()
    expect(screen.getByLabelText('Template name')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Design/ })).toBeTruthy()
    expect(screen.getByLabelText('Structure')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Content' })).toBeTruthy()
    expect(document.querySelector('.mk-canvas')).toBeTruthy()
  })

  it('offers a starting point instead of an empty dashed column', () => {
    mount()
    expect(screen.getByText('Start building your email')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Add text/ })).toBeTruthy()
  })

  it('knows a pristine document from one the user has already shaped', () => {
    expect(isPristine(normalize(docOf()))).toBe(true)
    expect(isPristine(normalize(docOf([createBlock('text')])))).toBe(false)
  })

  it('lists every built-in block in the palette', () => {
    mount()
    expect(paletteTile('text')).toBeTruthy()
    expect(paletteTile('button')).toBeTruthy()
    expect(document.querySelectorAll('[data-palette-block]').length).toBeGreaterThan(0)
  })
})

describe('adding blocks', () => {
  it('appends the tile you click and selects what it added', () => {
    const { latest } = mount()
    fireEvent.click(paletteTile('button'))

    expect(allBlocksIn(latest()).map((b) => b.type)).toEqual(['button'])
    // The panel swaps to the new block's properties.
    expect(panelLabel()).toBe('Properties')
    const panel = /** @type {HTMLElement} */ (document.querySelector('aside.mk-panel'))
    expect(within(panel).getByText('Button')).toBeTruthy()
  })

  it('works from the blank state too', () => {
    const { latest } = mount()
    fireEvent.click(screen.getByRole('button', { name: /Add text/ }))
    expect(allBlocksIn(latest()).map((b) => b.type)).toEqual(['text'])
  })

  it('appends into the column the last selection was in', () => {
    const doc = normalize(docOf())
    const { latest } = mount({ defaultValue: doc })

    fireEvent.click(paletteTile('text'))
    fireEvent.click(screen.getByRole('button', { name: 'Back to content' }))
    fireEvent.click(paletteTile('button'))

    const columns = latest().sections[0].rows[0].columns
    expect(columns).toHaveLength(1)
    expect(columns[0].blocks.map((b) => b.type)).toEqual(['text', 'button'])
  })

  it('resolves the append target from whatever is selected', () => {
    const doc = normalize(docOf([createBlock('text')]))
    const columnId = firstColumnId(doc)
    const blockId = allBlocksIn(doc)[0].id

    /** @param {Record<string, any>} store */
    const target = (store) => targetColumnId(/** @type {any} */ ({ doc, ...store }))

    expect(target({ selectedId: blockId })).toBe(columnId)
    expect(target({ selectedId: columnId })).toBe(columnId)
    expect(target({ selectedId: doc.sections[0].rows[0].id })).toBe(columnId)
    expect(target({ selectedId: doc.sections[0].id })).toBe(columnId)
    expect(target({ selectedId: null, focusColumnId: columnId })).toBe(columnId)
    expect(target({ selectedId: null, focusColumnId: null })).toBe(columnId)
  })
})

describe('the side panel', () => {
  it('swaps between its three tabs', () => {
    mount()
    fireEvent.click(screen.getByRole('tab', { name: 'Rows' }))
    expect(screen.getByRole('button', { name: '2 columns' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(screen.getByText('Email settings')).toBeTruthy()
  })

  it('adds a row from the layout picker', () => {
    const { latest } = mount()
    fireEvent.click(screen.getByRole('tab', { name: 'Rows' }))
    fireEvent.click(screen.getByRole('button', { name: '2 : 1' }))

    const rows = latest().sections[0].rows
    expect(rows).toHaveLength(2)
    expect(rows[1].columns.map((c) => c.props.width)).toEqual([67, 33])
  })

  it('edits document settings from the Settings tab', () => {
    const { latest } = mount()
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Ship it' } })
    expect(latest().settings.subject).toBe('Ship it')
  })

  it('builds a block’s properties from its schema alone', () => {
    const { latest } = mount()
    fireEvent.click(paletteTile('heading'))

    // Typography lives in a collapsed group, so the panel opens on the essentials.
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    const size = screen.getByLabelText('Size')
    fireEvent.change(size, { target: { value: '40' } })
    expect(allBlocksIn(latest())[0].props.fontSize).toBe(40)
  })

  it('duplicates and deletes the selected node from its header', () => {
    const { latest } = mount()
    fireEvent.click(paletteTile('text'))

    fireEvent.click(screen.getByRole('button', { name: /^Duplicate Text$/ }))
    expect(allBlocksIn(latest())).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /^Delete Text$/ }))
    expect(allBlocksIn(latest())).toHaveLength(1)
  })

  it('gives the selected node an ancestor trail to climb back up', () => {
    mount()
    fireEvent.click(paletteTile('text'))
    const crumbs = screen.getByLabelText('Selected node ancestors')
    expect(within(crumbs).getByRole('button', { name: 'Section' })).toBeTruthy()
    expect(within(crumbs).getByRole('button', { name: 'Row' })).toBeTruthy()

    fireEvent.click(within(crumbs).getByRole('button', { name: 'Row' }))
    expect(panelLabel()).toBe('Properties')
  })
})

describe('the toolbar', () => {
  it('renames the template as you type', () => {
    const { latest } = mount()
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Welcome v2' } })
    expect(latest().settings.name).toBe('Welcome v2')
  })

  it('enables undo only once there is something to undo', () => {
    const { latest } = mount()
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo.hasAttribute('disabled')).toBe(true)

    fireEvent.click(paletteTile('text'))
    expect(undo.hasAttribute('disabled')).toBe(false)

    fireEvent.click(undo)
    expect(allBlocksIn(latest())).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(allBlocksIn(latest())).toHaveLength(1)
  })

  it('switches views, and only offers the text width inside Preview', () => {
    mount()
    expect(screen.queryByLabelText('Text')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /Preview/ }))
    expect(document.querySelector('iframe')).toBeTruthy()
    expect(screen.getByLabelText('Text')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /Checks/ }))
    expect(document.querySelector('.mk-lint')).toBeTruthy()
  })

  it('hands the whole export bundle to onExport', () => {
    const onExport = vi.fn()
    mount({ onExport })
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))

    expect(onExport).toHaveBeenCalledTimes(1)
    expect(Object.keys(onExport.mock.calls[0][0])).toEqual([
      'jsx',
      'tsx',
      'html',
      'mjml',
      'text',
      'json',
    ])
  })

  it('shows the rendered size, which is what decides whether the footer arrives', () => {
    mount()
    expect(screen.getByText(/\d+ KB/)).toBeTruthy()
  })
})

describe('keyboard', () => {
  it('undoes and redoes with the usual chords', () => {
    const { latest } = mount()
    fireEvent.click(paletteTile('text'))

    fireEvent.keyDown(root(), { key: 'z', ctrlKey: true })
    expect(allBlocksIn(latest())).toHaveLength(0)

    fireEvent.keyDown(root(), { key: 'z', ctrlKey: true, shiftKey: true })
    expect(allBlocksIn(latest())).toHaveLength(1)

    fireEvent.keyDown(root(), { key: 'z', ctrlKey: true })
    fireEvent.keyDown(root(), { key: 'y', ctrlKey: true })
    expect(allBlocksIn(latest())).toHaveLength(1)
  })

  it('duplicates and deletes the selection', () => {
    const { latest } = mount()
    fireEvent.click(paletteTile('text'))

    fireEvent.keyDown(root(), { key: 'd', ctrlKey: true })
    expect(allBlocksIn(latest())).toHaveLength(2)

    fireEvent.keyDown(root(), { key: 'Delete' })
    expect(allBlocksIn(latest())).toHaveLength(1)
  })

  it('opens quick insert on slash and closes it on escape', () => {
    mount()
    fireEvent.keyDown(root(), { key: '/' })
    const dialog = screen.getByRole('dialog', { name: 'Quick insert' })
    expect(dialog).toBeTruthy()

    fireEvent.keyDown(within(dialog).getByLabelText('Search blocks…'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('leaves a text field’s own keystrokes alone', () => {
    const { latest } = mount()
    const name = screen.getByLabelText('Template name')
    fireEvent.keyDown(name, { key: '/' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(latest()).toBeUndefined()
  })

  it('deselects on escape once nothing is covering the canvas', () => {
    mount()
    fireEvent.click(paletteTile('text'))
    expect(panelLabel()).toBe('Properties')

    fireEvent.keyDown(root(), { key: 'Escape' })
    expect(panelLabel()).toBe('Blocks')
  })
})

describe('quick insert', () => {
  /** @returns {HTMLElement} */
  const open = () => {
    fireEvent.keyDown(root(), { key: '/' })
    return screen.getByRole('dialog', { name: 'Quick insert' })
  }

  it('filters as you type and inserts on Enter', () => {
    const { latest } = mount()
    const dialog = open()
    const input = within(dialog).getByLabelText('Search blocks…')

    fireEvent.change(input, { target: { value: 'divid' } })
    expect(within(dialog).getAllByRole('option')).toHaveLength(1)

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(allBlocksIn(latest()).map((b) => b.type)).toEqual(['divider'])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('moves the highlight with the arrow keys, wrapping at both ends', () => {
    mount()
    const dialog = open()
    const input = within(dialog).getByLabelText('Search blocks…')
    const options = within(dialog).getAllByRole('option')

    expect(options[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(within(dialog).getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    const last = within(dialog).getAllByRole('option').at(-1)
    expect(last?.getAttribute('aria-selected')).toBe('true')
  })

  it('says so when nothing matches', () => {
    mount()
    const dialog = open()
    fireEvent.change(within(dialog).getByLabelText('Search blocks…'), {
      target: { value: 'zzzz' },
    })
    expect(within(dialog).queryAllByRole('option')).toHaveLength(0)
    expect(within(dialog).getByText(/No blocks match/)).toBeTruthy()
  })
})

describe('the checks view', () => {
  it('lists the issues the linter found', () => {
    mount()
    fireEvent.click(screen.getByRole('tab', { name: /Checks/ }))
    expect(screen.getByText('No unsubscribe link found.')).toBeTruthy()
  })

  it('takes you to the block an issue is about', () => {
    mount({ defaultValue: normalize(docOf([createBlock('button', { href: '#' })])) })
    fireEvent.click(screen.getByRole('tab', { name: /Checks/ }))
    fireEvent.click(screen.getByText('Button has no destination.'))

    // Back in the design view, with the offending block selected.
    expect(screen.getByRole('tab', { name: /Design/ }).getAttribute('aria-selected')).toBe('true')
    expect(panelLabel()).toBe('Properties')
  })

  it('filters by level, and falls back to All rather than stranding you', () => {
    mount()
    fireEvent.click(screen.getByRole('tab', { name: /Checks/ }))
    const errors = screen.getByRole('button', { name: /error/ })
    fireEvent.click(errors)
    expect(errors.getAttribute('aria-pressed')).toBe('true')
  })

  it('badges the tab with the number of errors and warnings', () => {
    mount()
    const badge = document.querySelector('.mk-badge')
    expect(badge?.textContent).toMatch(/^\d+$/)
  })
})

describe('the preview view', () => {
  it('renders the email in a sandboxed iframe', () => {
    mount({ defaultValue: normalize(docOf([createBlock('text', { text: 'Hello there' })])) })
    fireEvent.click(screen.getByRole('tab', { name: /Preview/ }))

    const frame = /** @type {HTMLIFrameElement} */ (document.querySelector('iframe'))
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.getAttribute('srcdoc')).toContain('Hello there')
  })

  it('narrows to the mobile width, and says which width is on screen', () => {
    mount()
    fireEvent.click(screen.getByRole('tab', { name: /Preview/ }))
    expect(screen.getByText(/600.px/)).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Mobile'))
    expect(screen.getByText(/375.px/)).toBeTruthy()
  })

  it('shows the plain-text alternative on demand', () => {
    mount({ defaultValue: normalize(docOf([createBlock('text', { text: 'Plain words' })])) })
    fireEvent.click(screen.getByRole('tab', { name: /Preview/ }))
    fireEvent.click(screen.getByLabelText('Text'))
    expect(screen.getByText('Plain words')).toBeTruthy()
  })

  it('drops the text width when you leave Preview', () => {
    mount()
    fireEvent.click(screen.getByRole('tab', { name: /Preview/ }))
    fireEvent.click(screen.getByLabelText('Text'))
    fireEvent.click(screen.getByRole('tab', { name: /Design/ }))

    expect(screen.getByLabelText('Desktop').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('the structure pane', () => {
  it('lists the document and selects what you click', () => {
    mount({ defaultValue: normalize(docOf([createBlock('heading', { text: 'Ship it' })])) })
    const tree = screen.getByLabelText('Structure')
    fireEvent.click(within(tree).getAllByText('Heading')[0])
    expect(panelLabel()).toBe('Properties')
  })

  it('folds down to a rail without losing its jump list', () => {
    mount()
    const tree = screen.getByLabelText('Structure')
    fireEvent.click(within(tree).getByRole('button', { name: 'Collapse structure' }))
    expect(tree.getAttribute('data-collapsed')).toBe('true')
  })
})

describe('consumer configuration', () => {
  afterEach(() => unregisterBlock('spec-countdown'))

  it('hides a disabled tool but keeps existing blocks of that type working', () => {
    mount({
      defaultValue: normalize(docOf([createBlock('image', { src: 'https://i.test/a.png' })])),
      tools: { image: { enabled: false } },
    })
    expect(document.querySelector('[data-palette-block="image"]')).toBeNull()
    // The block itself is still in the document and still rendered.
    expect(screen.getByLabelText('Structure').textContent).toContain('Image')
  })

  it('greys a tool that has hit its usage limit, and says why', () => {
    mount({
      defaultValue: normalize(docOf([createBlock('button')])),
      tools: { button: { usageLimit: 1 } },
    })
    const tile = paletteTile('button')
    expect(tile.hasAttribute('disabled')).toBe(true)
    expect(tile.getAttribute('title')).toContain('limit of 1')
  })

  it('registers a custom block and offers it in the palette', () => {
    const countdown = defineBlock({
      type: 'spec-countdown',
      label: 'Countdown',
      group: 'Advanced',
      defaultProps: { until: '2026-01-01' },
      schema: [{ key: 'until', type: 'text', label: 'Until' }],
      render: { html: (p) => `<div>${p.until}</div>` },
    })

    const { latest } = mount({ blocks: [countdown] })
    fireEvent.click(paletteTile('spec-countdown', 'Advanced'))

    expect(allBlocksIn(latest()).map((b) => b.type)).toEqual(['spec-countdown'])
    expect(screen.getByLabelText('Until')).toBeTruthy()
  })

  it('translates the chrome, and takes per-key overrides', () => {
    const { rerender } = mount({ locale: 'hi' })
    expect(screen.queryByLabelText('Template name')).toBeNull()

    rerender(
      <MailKiln defaultValue={normalize(docOf())} messages={{ 'toolbar.name': 'Name of thing' }} />,
    )
    expect(screen.getByLabelText('Name of thing')).toBeTruthy()
  })

  it('applies theme tokens as custom properties on its own root', () => {
    mount({ theme: { accent: '#ff0000', radius: 10 } })
    expect(root().style.getPropertyValue('--mk-accent')).toBe('#ff0000')
    expect(root().style.getPropertyValue('--mk-radius')).toBe('10px')
  })

  it('warns once about a theme key that would silently do nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount({ theme: /** @type {any} */ ({ accnet: '#ff0000' }) })
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/unknown theme key accnet/)
  })

  it('takes the appearance from the prop rather than offering its own toggle', () => {
    mount({ appearance: 'dark' })
    expect(root().getAttribute('data-mk-theme')).toBe('dark')
    expect(screen.queryByLabelText('Toggle dark mode')).toBeNull()
  })

  it('can be rendered without the palette, the properties or the outline', () => {
    mount({ showPalette: false, showInspector: false, showStructure: false })
    expect(screen.queryByRole('tab', { name: 'Content' })).toBeNull()
    expect(screen.queryByLabelText('Structure')).toBeNull()
    expect(document.querySelector('.mk-canvas')).toBeTruthy()
  })

  it('runs against declared merge variables', () => {
    mount({
      defaultValue: normalize(docOf([createBlock('text', { text: 'Hi {{user.nmae}}' })])),
      vars: sampleVars(),
    })
    fireEvent.click(screen.getByRole('tab', { name: /Checks/ }))
    expect(screen.getByText('{{user.nmae}} is not declared in defineVars.')).toBeTruthy()
  })
})

describe('controlled mode', () => {
  it('follows the value the parent hands down', () => {
    const first = normalize(docOf([createBlock('text', { text: 'first' })]))
    const second = normalize(docOf([createBlock('heading', { text: 'second' })]))
    const { rerender } = render(<MailKiln value={first} onChange={() => {}} />)

    expect(screen.getByLabelText('Structure').textContent).toContain('Text')
    rerender(<MailKiln value={second} onChange={() => {}} />)
    expect(screen.getByLabelText('Structure').textContent).toContain('Heading')
  })
})

describe('the canvas as a DOM surface', () => {
  /** The rendered body of the first block on the canvas. */
  function canvasBlockHtml() {
    const body = document.querySelector('.mk-node-body')
    if (!body) throw new Error('no block on the canvas')
    return body.innerHTML
  }

  it('writes no inline event handler into its own DOM', () => {
    // The document is plain JSON and the importer keeps what a third-party
    // email brought with it, so this markup does not have to have been typed
    // by the person looking at it. `innerHTML` does not run a <script>, but it
    // does attach every `on*` handler it is given — in the host app's origin.
    mount({
      defaultValue: normalize(
        docOf([
          createBlock('text', {
            text: 'Hi <img src="x" onerror="steal()"> <a href="javascript:go()">go</a>',
          }),
        ]),
      ),
    })

    const html = canvasBlockHtml()
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
    // The copy is still all there — sanitizing must never delete words.
    expect(document.querySelector('.mk-node-body')?.textContent).toContain('Hi')
    expect(document.querySelector('.mk-node-body')?.textContent).toContain('go')
    expect(document.querySelector('.mk-canvas img')).toBeTruthy()
  })

  it('leaves the document itself alone — the linter is what reports it', () => {
    const dirty = 'Hi <img src="x" onerror="steal()">'
    const { latest } = mount({
      defaultValue: normalize(docOf([createBlock('text', { text: dirty })])),
    })
    // Nothing was patched on render, so the block still holds what it held.
    expect(latest()).toBeUndefined()
    expect(
      allBlocksIn(normalize(docOf([createBlock('text', { text: dirty })])))[0].props.text,
    ).toBe(dirty)
  })

  it('shows resolved merge variables until the block is opened for editing', () => {
    mount({
      defaultValue: normalize(docOf([createBlock('text', { text: 'Total {{order.total}}' })])),
      vars: sampleVars(),
    })

    // Not selected: the author sees the email.
    expect(canvasBlockHtml()).toContain('42.5')
    expect(canvasBlockHtml()).not.toContain('{{order.total}}')

    // Selected, and so editable in place: whatever is in that element on blur
    // *becomes* props.text, so the tag has to be what is in it.
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('.mk-node-body')))
    expect(canvasBlockHtml()).toContain('{{order.total}}')
    expect(canvasBlockHtml()).not.toContain('42.5')
  })

  it('commits the tag, not one recipient’s sample value', () => {
    const { latest } = mount({
      defaultValue: normalize(docOf([createBlock('text', { text: 'Total {{order.total}}' })])),
      vars: sampleVars(),
    })

    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('.mk-node-body')))
    const target = /** @type {HTMLElement} */ (document.querySelector('[data-mk-edit]'))
    target.innerHTML = `${target.innerHTML} paid`
    fireEvent.blur(target)

    expect(latest()).toBeDefined()
    expect(allBlocksIn(latest())[0].props.text).toBe('Total {{order.total}} paid')
  })
})

/** A panel with no provider above it. */
function Orphan() {
  useStore()
  return null
}

describe('composed by hand', () => {
  it('tells a panel rendered outside the provider what to do about it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Orphan />)).toThrow(/must be rendered inside <MailKiln>/)
  })
})
