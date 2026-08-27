// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

// Explicit cleanup: without it, every test queries a DOM that still holds the
// previous test's unmounted markup, and `document.querySelector` starts handing
// back detached nodes whose React handlers are gone.
afterEach(() => cleanup())
import {
  MailKiln,
  MailKilnProvider,
  Toolbar,
  useMailKiln,
} from '../src/index.js'
import {
  builtinBlocks,
  createDocument,
  defineBlock,
  listBlocks,
  normalize,
  unregisterBlock,
} from '../src/core/index.js'
import { kitchenSinkDocument, sampleVars, twoColumnDocument } from './helpers.js'

/**
 * Render the editor as a controlled component and keep the latest document.
 *
 * @param {Record<string, any>} [props]
 * @returns {{ get: () => import('../src/core/types.js').EmailDocument, rerender: (p?: any) => void, utils: any, onChange: any }}
 */
function renderEditor(props = {}) {
  let current = props.value ?? twoColumnDocument()
  const onChange = vi.fn((/** @type {any} */ next) => {
    current = next
  })
  const utils = render(<MailKiln value={current} onChange={onChange} {...props} />)
  const rerender = (/** @type {any} */ extra = {}) =>
    utils.rerender(<MailKiln value={current} onChange={onChange} {...props} {...extra} />)
  return { get: () => current, rerender, utils, onChange }
}

/**
 * The action strip inside a canvas node. Section, row and block actions share
 * their labels with the panel header on purpose — two routes to the same thing —
 * so assertions have to say which one they mean.
 *
 * @param {string} selector
 * @returns {HTMLElement}
 */
function strip(selector) {
  const found = document.querySelector(`${selector} .mk-node-tools`)
  if (!found) throw new Error(`no action strip found for ${selector}`)
  return /** @type {HTMLElement} */ (found)
}

describe('MailKiln', () => {
  it('renders the toolbar, palette, canvas and inspector', () => {
    renderEditor()
    expect(screen.getByLabelText('Blocks')).toBeTruthy()
    expect(screen.getByLabelText('Properties')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Design/ })).toBeTruthy()
  })

  it('lists every built-in block in the palette, grouped', () => {
    renderEditor()
    const palette = screen.getByLabelText('Blocks')
    for (const label of ['Text', 'Heading', 'Image', 'Button', 'Divider', 'Spacer', 'Social', 'Video', 'HTML']) {
      expect(within(palette).getByText(label), `missing "${label}"`).toBeTruthy()
    }
    // Group headings, scoped to the section labels — "Content" is also the name
    // of the tab that contains them.
    const groups = [...palette.querySelectorAll('.mk-section-label')].map((el) => el.textContent)
    expect(groups).toContain('Content')
    expect(groups).toContain('Layout')
    expect(groups).toContain('Advanced')
  })

  it('offers Content, Rows and Settings tabs, and adds a row layout', () => {
    const editor = renderEditor()
    const rowsTab = screen.getByRole('tab', { name: /Rows/ })
    fireEvent.click(rowsTab)

    // Visual column presets, the way every mature builder exposes layout.
    const twoColumn = document.querySelector('[data-row-preset="2"]')
    expect(twoColumn).toBeTruthy()
    fireEvent.click(/** @type {Element} */ (twoColumn))

    const rows = editor.get().sections.flatMap((section) => section.rows)
    expect(rows.at(-1)?.columns.map((c) => c.props.width)).toEqual([50, 50])

    editor.rerender()
    fireEvent.click(screen.getByRole('tab', { name: /Settings/ }))
    expect(screen.getByLabelText('Subject')).toBeTruthy()
  })

  it('swaps the panel to the selected block and back again', () => {
    const editor = renderEditor()
    expect(screen.getByLabelText('Blocks')).toBeTruthy()

    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-block-id][data-block-type="text"]')))
    editor.rerender()

    // The panel is now the block's properties — not a second panel elsewhere.
    expect(screen.getByLabelText('Properties')).toBeTruthy()
    expect(screen.queryByLabelText('Blocks')).toBeNull()

    fireEvent.click(screen.getByLabelText('Back to content'))
    editor.rerender()
    expect(screen.getByLabelText('Blocks')).toBeTruthy()
  })

  it('filters the palette by search', () => {
    renderEditor()
    const palette = screen.getByLabelText('Blocks')
    fireEvent.change(within(palette).getByLabelText('Search blocks'), { target: { value: 'butt' } })
    expect(within(palette).getByText('Button')).toBeTruthy()
    expect(within(palette).queryByText('Divider')).toBeNull()
  })

  it('appends a block when a palette entry is activated, and selects it', () => {
    // Click/Enter is the keyboard and touch path into the canvas. Drag is not
    // the only way in.
    const editor = renderEditor()
    const before = listBlocks(editor.get()).length
    fireEvent.click(within(screen.getByLabelText('Blocks')).getByText('Button'))

    const after = listBlocks(editor.get())
    expect(after).toHaveLength(before + 1)
    expect(after.some((block) => block.type === 'button')).toBe(true)

    editor.rerender()
    // The Inspector is now showing the new block.
    expect(screen.getByLabelText('Properties').textContent).toMatch(/Button/)
  })

  it('selects a column on click, so its own properties are reachable', () => {
    const editor = renderEditor()
    const column = document.querySelectorAll('.mk-col')[1]
    fireEvent.click(/** @type {Element} */ (column))
    editor.rerender()

    const inspector = screen.getByLabelText('Properties')
    expect(inspector.textContent).toMatch(/Column/)
    // The fields that used to be unreachable: a column click bubbled to the row.
    expect(within(inspector).getByLabelText('Width %')).toBeTruthy()
    expect(within(inspector).getByLabelText('Background hex')).toBeTruthy()
    expect(document.querySelectorAll('.mk-col')[1].getAttribute('data-selected')).toBe('true')
  })

  it('takes you to the block when a check is clicked', () => {
    // The properties panel only exists in the design view, so selecting the node
    // without switching back left the button — "Show the block this affects" —
    // looking like it did nothing.
    const editor = renderEditor({
      value: (() => {
        const doc = twoColumnDocument()
        doc.sections[0].rows[0].columns[0].blocks.push({
          id: 'blk_empty_image',
          type: 'image',
          props: { src: '', alt: '' },
        })
        return normalize(doc)
      })(),
    })

    fireEvent.click(screen.getByRole('tab', { name: /Checks/ }))
    editor.rerender()

    const issue = screen.getByTitle('Show the block this affects')
    fireEvent.click(issue)
    editor.rerender()

    // Back in the design view, with the offending block open in the panel.
    expect(document.querySelector('.mk-canvas')).toBeTruthy()
    expect(screen.getByLabelText('Properties').textContent).toMatch(/Image/)
  })

  it('walks back up the tree from the selected node', () => {
    // The only route up. Columns fill their row, so once a column takes the
    // click there is nothing left on a zero-padding row that means "the row".
    const editor = renderEditor()
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-block-id]')))
    editor.rerender()

    const crumbs = screen.getByLabelText('Selected node ancestors')
    expect([...crumbs.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Section',
      'Row',
      'Column',
    ])

    fireEvent.click(within(crumbs).getByText('Row'))
    editor.rerender()
    const inspector = screen.getByLabelText('Properties')
    expect(inspector.textContent).toMatch(/Row/)
    expect(within(inspector).getByLabelText('Stack on mobile')).toBeTruthy()
  })

  it('keeps appending into the column you were last working in', () => {
    // Opening the palette means deselecting — the panel shows the selected
    // node's properties otherwise — so without a remembered column every append
    // after the first landed in the document's last column.
    const editor = renderEditor()
    const firstColumnId = editor.get().sections[0].rows[0].columns[0].id

    fireEvent.click(/** @type {Element} */ (document.querySelectorAll('.mk-col')[0]))
    editor.rerender()
    fireEvent.click(screen.getByLabelText('Back to content'))
    editor.rerender()
    // Deselecting a structural node lands on the Rows tab, so the palette needs
    // asking for by name.
    fireEvent.click(screen.getByRole('tab', { name: 'Content' }))
    editor.rerender()

    fireEvent.click(within(screen.getByLabelText('Blocks')).getByText('Button'))
    editor.rerender()

    const columns = editor.get().sections[0].rows[0].columns
    expect(columns[0].id).toBe(firstColumnId)
    expect(columns[0].blocks.map((b) => b.type)).toEqual(['text', 'button'])
    expect(columns[1].blocks.map((b) => b.type)).toEqual(['text'])

    // And a second append still goes there, not to the end of the document.
    fireEvent.click(screen.getByLabelText('Back to content'))
    editor.rerender()
    fireEvent.click(within(screen.getByLabelText('Blocks')).getByText('Divider'))
    editor.rerender()

    const after = editor.get().sections[0].rows[0].columns
    expect(after[0].blocks.map((b) => b.type)).toEqual(['text', 'button', 'divider'])
    expect(after[1].blocks).toHaveLength(1)
  })

  it('renders each canvas block with the real HTML renderer', () => {
    renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
    // Merge variables resolved with sample data, and real table markup.
    expect(document.body.innerHTML).toContain('Thanks, Smit!')
    expect(document.querySelector('.mk-node table')).toBeTruthy()
  })

  it('selects a block on click and shows its generated Inspector fields', () => {
    const editor = renderEditor()
    const node = document.querySelector('[data-block-id][data-block-type="text"]')
    expect(node).toBeTruthy()
    fireEvent.click(/** @type {Element} */ (node))
    editor.rerender()

    const inspector = screen.getByLabelText('Properties')
    // The primary field is open; grouped fields start collapsed so a text block
    // does not open with fourteen inputs.
    expect(within(inspector).getByLabelText('Text')).toBeTruthy()
    expect(within(inspector).queryByText('Size')).toBeNull()

    const typeGroup = within(inspector).getByRole('button', { name: 'Type' })
    expect(typeGroup.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(typeGroup)

    // Every one of these fields comes from the text block's `schema`.
    expect(within(inspector).getByText('Size')).toBeTruthy()
    expect(within(inspector).getByText('Line height')).toBeTruthy()
    expect(within(inspector).getByText('Weight')).toBeTruthy()

    fireEvent.click(within(inspector).getByRole('button', { name: 'Layout' }))
    expect(within(inspector).getByText('Align')).toBeTruthy()
  })

  it('edits a block through the Inspector', () => {
    const editor = renderEditor()
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-block-id][data-block-type="text"]')))
    editor.rerender()

    const inspector = screen.getByLabelText('Properties')
    const textarea = within(inspector).getByLabelText('Text')
    fireEvent.change(textarea, { target: { value: 'Edited copy' } })

    expect(listBlocks(editor.get())[0].props.text).toBe('Edited copy')
  })

  describe('inline editing', () => {
    it('does not rewrite the text prop when a selected block is merely blurred', () => {
      // The reported bug: the whole rendered block was contentEditable, and on
      // blur its first child's innerHTML — the wrapper <table> — was written back
      // into props.text. Selecting a block and clicking anywhere else destroyed
      // the copy and left `<tbody><tr><td …>` in the Text field.
      const editor = renderEditor()
      const node = /** @type {HTMLElement} */ (
        document.querySelector('[data-block-id][data-block-type="text"]')
      )
      fireEvent.click(node)
      editor.rerender()

      const editable = /** @type {HTMLElement} */ (node.querySelector('[data-mk-edit]'))
      expect(editable).toBeTruthy()
      expect(editable.tagName).toBe('DIV')
      expect(editable.getAttribute('contenteditable')).toBe('true')

      editable.focus()
      fireEvent.blur(editable)

      expect(listBlocks(editor.get())[0].props.text).toBe('A')
      expect(JSON.stringify(editor.get())).not.toMatch(/<tbody|<td /)
    })

    it('writes only the edited text back', () => {
      const editor = renderEditor()
      const node = /** @type {HTMLElement} */ (
        document.querySelector('[data-block-id][data-block-type="text"]')
      )
      fireEvent.click(node)
      editor.rerender()

      const editable = /** @type {HTMLElement} */ (node.querySelector('[data-mk-edit]'))
      editable.innerHTML = 'Edited on the canvas'
      fireEvent.blur(editable)

      const block = listBlocks(editor.get())[0]
      expect(block.props.text).toBe('Edited on the canvas')
      // Everything else about the block is untouched.
      expect(block.props.fontSize).toBe(16)
      expect(block.props.align).toBe('left')
    })

    it('marks the heading element, not its wrapper', () => {
      const editor = renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
      const node = /** @type {HTMLElement} */ (
        document.querySelector('[data-block-id][data-block-type="heading"]')
      )
      fireEvent.click(node)
      editor.rerender()

      const editable = /** @type {HTMLElement} */ (node.querySelector('[data-mk-edit]'))
      expect(editable.tagName).toBe('H2')
      expect(editable.getAttribute('data-mk-edit')).toBe('text')
    })

    it('keeps typing out of the editor shortcut handler', () => {
      // Without stopPropagation, "d" duplicates the block and Delete removes it
      // while you are writing a sentence.
      const editor = renderEditor()
      const node = /** @type {HTMLElement} */ (
        document.querySelector('[data-block-id][data-block-type="text"]')
      )
      fireEvent.click(node)
      editor.rerender()

      const editable = /** @type {HTMLElement} */ (node.querySelector('[data-mk-edit]'))
      editable.focus()
      fireEvent.keyDown(editable, { key: 'Delete' })
      fireEvent.keyDown(editable, { key: 'd', ctrlKey: true })

      expect(listBlocks(editor.get())).toHaveLength(2)
    })
  })

  describe('rich-text toolbar', () => {
    /**
     * Select a block on the canvas and hand back its node.
     *
     * @param {ReturnType<typeof renderEditor>} editor
     * @param {string} type
     * @returns {HTMLElement}
     */
    function selectBlock(editor, type) {
      const node = /** @type {HTMLElement} */ (
        document.querySelector(`[data-block-id][data-block-type="${type}"]`)
      )
      fireEvent.click(node)
      editor.rerender()
      return node
    }

    it('appears only for a block that is editable in place', () => {
      const editor = renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })

      const text = selectBlock(editor, 'text')
      expect(text.querySelector('.mk-inline-toolbar')).toBeTruthy()
      // The toolbar takes the label's corner, so the label steps aside.
      expect(text.querySelector('.mk-node-label')).toBeNull()

      const image = selectBlock(editor, 'image')
      expect(image.querySelector('.mk-inline-toolbar')).toBeNull()
      expect(image.querySelector('.mk-node-label')).toBeTruthy()
    })

    it('hides the list buttons on a heading — <ul> inside <h2> is invalid', () => {
      const editor = renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })

      const text = selectBlock(editor, 'text')
      expect(within(text).getByLabelText('Bulleted list')).toBeTruthy()

      const heading = selectBlock(editor, 'heading')
      expect(within(heading).getByLabelText('Bold')).toBeTruthy()
      expect(within(heading).queryByLabelText('Bulleted list')).toBeNull()
      expect(within(heading).queryByLabelText('Numbered list')).toBeNull()
    })

    it('normalizes what contentEditable produced before it reaches the document', () => {
      // execCommand emits styled spans and <div> wrappers; a Word paste brings
      // class names and mso- properties. None of it may reach props.text.
      const editor = renderEditor()
      const node = selectBlock(editor, 'text')
      const editable = /** @type {HTMLElement} */ (node.querySelector('[data-mk-edit]'))

      editable.innerHTML =
        '<div class="MsoNormal" style="mso-x:1">' +
        '<span style="font-weight:700;font-family:Calibri">Bold</span> and ' +
        '<font color="red"><i>italic</i></font></div>'
      fireEvent.blur(editable)

      expect(listBlocks(editor.get())[0].props.text).toBe('<b>Bold</b> and <i>italic</i>')
    })

    it('normalizes a paste instead of inserting it raw', () => {
      const execCommand = vi.fn(() => true)
      Object.assign(document, { execCommand })

      const editor = renderEditor()
      const node = selectBlock(editor, 'text')
      const editable = /** @type {HTMLElement} */ (node.querySelector('[data-mk-edit]'))

      fireEvent.paste(editable, {
        clipboardData: {
          getData: (/** @type {string} */ type) =>
            type === 'text/html'
              ? '<p class="MsoNormal"><span style="font-weight:bold">Pasted</span></p>'
              : 'Pasted',
        },
      })

      expect(execCommand).toHaveBeenCalledWith('insertHTML', false, '<b>Pasted</b>')

      // @ts-expect-error — putting jsdom back the way we found it.
      delete document.execCommand
    })

    it('inserts a merge-variable link from the link popover', () => {
      const execCommand = vi.fn(() => true)
      Object.assign(document, { execCommand })

      const editor = renderEditor()
      const node = selectBlock(editor, 'text')

      fireEvent.click(within(node).getByLabelText('Link'))
      const url = /** @type {HTMLInputElement} */ (within(node).getByLabelText('Link URL'))
      fireEvent.change(url, { target: { value: '{{unsubscribe_url}}' } })
      fireEvent.click(within(node).getByText('Apply'))

      expect(execCommand).toHaveBeenCalledWith(
        'insertHTML',
        false,
        '<a href="{{unsubscribe_url}}">{{unsubscribe_url}}</a>',
      )

      // @ts-expect-error — putting jsdom back the way we found it.
      delete document.execCommand
    })
  })

  it('duplicates and deletes through the hover toolbar', () => {
    const editor = renderEditor()
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-block-id][data-block-type="text"]')))
    editor.rerender()

    fireEvent.click(screen.getByLabelText('Duplicate'))
    expect(listBlocks(editor.get())).toHaveLength(3)

    editor.rerender()
    fireEvent.click(screen.getByLabelText('Delete'))
    expect(listBlocks(editor.get())).toHaveLength(2)
  })

  it('removes a row that was added by mistake', () => {
    // The reported flow: add a row from the Rows tab, decide against it, and be
    // able to get rid of it without knowing about the Delete key.
    const editor = renderEditor()
    fireEvent.click(screen.getByRole('tab', { name: /Rows/ }))
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-row-preset="3"]')))
    editor.rerender()

    const rowCount = () => editor.get().sections.flatMap((s) => s.rows).length
    expect(rowCount()).toBe(2)

    // Select the row on the canvas, then use its own action strip.
    const added = editor.get().sections[0].rows[1]
    fireEvent.click(/** @type {Element} */ (document.querySelector(`[data-row-id="${added.id}"]`)))
    editor.rerender()

    // Scoped to the canvas strip: the panel header offers the same action, so
    // the label deliberately appears twice.
    fireEvent.click(within(strip(`[data-row-id="${added.id}"]`)).getByLabelText('Delete Row'))
    expect(rowCount()).toBe(1)
  })

  it('offers duplicate and delete in the panel header for whatever is selected', () => {
    const editor = renderEditor()
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-block-id]')))
    editor.rerender()

    const header = /** @type {HTMLElement} */ (
      screen.getByLabelText('Properties').querySelector('.mk-panel-head')
    )
    expect(within(header).getByLabelText(/^Duplicate /)).toBeTruthy()

    fireEvent.click(within(header).getByLabelText(/^Delete /))
    expect(listBlocks(editor.get())).toHaveLength(1)
  })

  it('removes a section from its action strip', () => {
    const editor = renderEditor()
    const first = editor.get().sections[0]
    fireEvent.click(screen.getByText('Add section'))
    editor.rerender()
    expect(editor.get().sections).toHaveLength(2)

    fireEvent.click(/** @type {Element} */ (document.querySelector(`[data-section-id="${first.id}"]`)))
    editor.rerender()
    fireEvent.click(
      within(strip(`[data-section-id="${first.id}"]`)).getByLabelText('Delete Section'),
    )
    expect(editor.get().sections).toHaveLength(1)

    // That removed the only section with content, so the document is empty again
    // and the blank state takes over.
    editor.rerender()
    expect(screen.getByText('Start building your email')).toBeTruthy()
  })

  it('reorders sections with the move buttons', () => {
    // Reordering sections had no UI at all before: `moveSection` existed in core
    // with nothing wired to it.
    const editor = renderEditor()
    fireEvent.click(screen.getByText('Add section'))
    editor.rerender()

    const [first, second] = editor.get().sections
    fireEvent.click(/** @type {Element} */ (document.querySelector(`[data-section-id="${first.id}"]`)))
    editor.rerender()

    const moveStrip = within(strip(`[data-section-id="${first.id}"]`))
    expect(moveStrip.getByLabelText('Move up Section').hasAttribute('disabled')).toBe(true)
    fireEvent.click(moveStrip.getByLabelText('Move down Section'))

    expect(editor.get().sections.map((s) => s.id)).toEqual([second.id, first.id])
  })

  it('duplicates a row from its action strip', () => {
    const editor = renderEditor()
    const row = editor.get().sections[0].rows[0]
    fireEvent.click(/** @type {Element} */ (document.querySelector(`[data-row-id="${row.id}"]`)))
    editor.rerender()

    fireEvent.click(within(strip(`[data-row-id="${row.id}"]`)).getByLabelText('Duplicate Row'))
    expect(editor.get().sections[0].rows).toHaveLength(2)
    // The copy brings its blocks, with fresh ids.
    expect(listBlocks(editor.get())).toHaveLength(4)
    expect(new Set(listBlocks(editor.get()).map((b) => b.id)).size).toBe(4)
  })

  it('shows a starting point for an empty template', () => {
    const editor = renderEditor({ value: normalize(createDocument()) })
    expect(screen.getByText('Start building your email')).toBeTruthy()
    // The blank state replaces the section scaffolding, not the other way round.
    expect(document.querySelector('.mk-col-empty')).toBeNull()

    fireEvent.click(screen.getByText('Add text'))
    expect(listBlocks(editor.get()).map((b) => b.type)).toEqual(['text'])

    editor.rerender()
    expect(screen.queryByText('Start building your email')).toBeNull()
    // The new block is selected and its properties are open. The canvas
    // deselects on click, so this only holds because the action stops the click
    // from bubbling to it.
    expect(screen.getByLabelText('Properties').textContent).toMatch(/Text/)
  })

  it('keeps the blank state out of the way once there is any structure', () => {
    // Adding a two-column row leaves a document with zero blocks. Showing the
    // "start here" screen then would throw away what the user just built.
    const editor = renderEditor({ value: normalize(createDocument()) })
    fireEvent.click(screen.getByRole('tab', { name: /Rows/ }))
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-row-preset="2"]')))
    editor.rerender()

    expect(screen.queryByText('Start building your email')).toBeNull()
    expect(document.querySelectorAll('.mk-col-empty').length).toBeGreaterThan(0)
  })

  describe('visibility panel', () => {
    /**
     * Select a node and open its Visibility group.
     *
     * @param {ReturnType<typeof renderEditor>} editor
     * @param {string} selector
     * @returns {HTMLElement}
     */
    function openVisibility(editor, selector) {
      fireEvent.click(/** @type {Element} */ (document.querySelector(selector)))
      editor.rerender()
      fireEvent.click(screen.getByRole('button', { name: 'Visibility' }))
      editor.rerender()
      return /** @type {HTMLElement} */ (
        screen.getByRole('button', { name: 'Visibility' }).parentElement
      )
    }

    it('keeps the switch on while the condition is still being typed', () => {
      // The bug this locks down: `setCondition` normalized on write, an empty
      // path normalized to null, so the write was a no-op and the switch could
      // never turn on. `normalize()` then re-ran on every controlled `value`
      // change and would have discarded the draft a second time.
      const editor = renderEditor()
      const group = openVisibility(editor, '[data-block-type="text"]')

      fireEvent.click(within(group).getByRole('switch', { name: 'Show conditionally' }))
      editor.rerender()

      expect(screen.getByLabelText('Show when')).toBeTruthy()
      expect(listBlocks(editor.get())[0].showIf).toEqual({ path: '', op: 'truthy' })
      // Inert until it is finished.
      expect(within(group).getByText(/Incomplete/)).toBeTruthy()
    })

    it('writes a finished condition and says which way it falls', () => {
      const editor = renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
      const group = openVisibility(editor, '[data-block-type="button"]')
      fireEvent.click(within(group).getByRole('switch', { name: 'Show conditionally' }))
      editor.rerender()

      fireEvent.change(screen.getByLabelText('Show when'), { target: { value: 'user.name' } })
      editor.rerender()

      const button = listBlocks(editor.get()).find((b) => b.type === 'button')
      expect(button?.showIf).toEqual({ path: 'user.name', op: 'truthy' })
      expect(screen.getByText('With your sample data: shown.')).toBeTruthy()

      // Marked on the canvas, not removed from it — a node you cannot select is
      // a condition you cannot undo.
      const node = document.querySelector('[data-block-type="button"]')
      expect(node?.hasAttribute('data-conditional')).toBe(true)
      expect(node?.hasAttribute('data-cond-off')).toBe(false)
      expect(node?.textContent).toContain('Track it')
    })

    it('marks a block whose condition is false without hiding it', () => {
      const editor = renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
      const group = openVisibility(editor, '[data-block-type="button"]')
      fireEvent.click(within(group).getByRole('switch', { name: 'Show conditionally' }))
      editor.rerender()
      fireEvent.change(screen.getByLabelText('Show when'), { target: { value: 'user.missing' } })
      editor.rerender()

      const node = document.querySelector('[data-block-type="button"]')
      expect(node?.hasAttribute('data-cond-off')).toBe(true)
      expect(node?.querySelector('.mk-cond-badge')?.textContent).toBe('user.missing is set')
      expect(screen.getByText('With your sample data: hidden.')).toBeTruthy()
    })

    it('offers repeat on a row and reports the sample length', () => {
      const editor = renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
      const group = openVisibility(editor, '.mk-row')
      fireEvent.click(within(group).getByRole('switch', { name: 'Repeat for each item' }))
      editor.rerender()

      fireEvent.change(screen.getByLabelText('Repeat over'), { target: { value: 'order.items' } })
      editor.rerender()

      expect(editor.get().sections[0].rows[0].repeat).toEqual({
        path: 'order.items',
        as: 'item',
        previewCount: 3,
      })
      expect(screen.getByText('Your sample data has 1 item(s).')).toBeTruthy()
      expect(document.querySelector('.mk-row .mk-cond-badge')?.textContent).toContain(
        'each order.items',
      )
    })

    it('shows a repeated row once on the canvas, scoped to the first item', () => {
      // Three copies would be three DOM nodes sharing one set of ids, and
      // drag-and-drop could not tell them apart. The Preview tab shows them all.
      const editor = renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
      const group = openVisibility(editor, '.mk-row')
      fireEvent.click(within(group).getByRole('switch', { name: 'Repeat for each item' }))
      editor.rerender()
      fireEvent.change(screen.getByLabelText('Repeat over'), { target: { value: 'order.items' } })
      editor.rerender()

      expect(document.querySelectorAll('.mk-row')).toHaveLength(1)
      expect(document.querySelectorAll('[data-block-id]')).toHaveLength(
        listBlocks(editor.get()).length,
      )
    })
  })

  describe('tool configuration', () => {
    /**
     * @param {ReturnType<typeof renderEditor>} editor
     * @returns {string[]}
     */
    const paletteOrder = (editor) => {
      void editor
      return [...document.querySelectorAll('[data-palette-block]')].map(
        (tile) => tile.getAttribute('data-palette-block') ?? '',
      )
    }

    it('removes a disabled tool from the palette and quick insert', () => {
      const editor = renderEditor({ tools: { image: { enabled: false } } })
      expect(paletteOrder(editor)).not.toContain('image')
      expect(paletteOrder(editor)).toContain('text')

      fireEvent.keyDown(document.querySelector('.mk-root') ?? document.body, { key: '/' })
      expect(screen.queryByText('Image')).toBeNull()
    })

    it('still renders a document that already uses a disabled tool', () => {
      // Turning a tool off must not break templates built before the change.
      const editor = renderEditor({
        value: kitchenSinkDocument(),
        vars: sampleVars,
        tools: { image: { enabled: false } },
      })
      expect(document.querySelector('[data-block-type="image"]')).toBeTruthy()
      expect(listBlocks(editor.get()).some((b) => b.type === 'image')).toBe(true)
    })

    it('treats position as an index, leaving unpositioned tools in order', () => {
      const editor = renderEditor({ tools: { button: { position: 0 } } })
      const order = paletteOrder(editor)
      expect(order[0]).toBe('button')
      // Everything else keeps its declared order relative to itself.
      expect(order.indexOf('text')).toBeLessThan(order.indexOf('heading'))
    })

    it('disables a tile once its usage limit is reached, with a reason', () => {
      const editor = renderEditor({ tools: { button: { usageLimit: 1 } } })
      const tile = () =>
        /** @type {HTMLButtonElement} */ (document.querySelector('[data-palette-block="button"]'))

      expect(tile().disabled).toBe(false)
      fireEvent.click(tile())
      editor.rerender()

      expect(listBlocks(editor.get()).filter((b) => b.type === 'button')).toHaveLength(1)

      // Inserting selects the new block, which swaps the panel to its properties.
      fireEvent.click(screen.getByLabelText('Back to content'))
      editor.rerender()

      expect(tile().disabled).toBe(true)
      expect(tile().title).toBe('Button: limit of 1 reached for this template.')

      // And clicking again is a no-op rather than a second block.
      fireEvent.click(tile())
      editor.rerender()
      expect(listBlocks(editor.get()).filter((b) => b.type === 'button')).toHaveLength(1)
    })

    it('drops an exhausted tool from quick insert rather than greying it', () => {
      // Quick insert is arrow-key driven; a dead entry you can land on is worse
      // than one that is not there.
      const editor = renderEditor({ tools: { button: { usageLimit: 1 } } })
      fireEvent.click(
        /** @type {HTMLElement} */ (document.querySelector('[data-palette-block="button"]')),
      )
      editor.rerender()

      fireEvent.keyDown(document.querySelector('.mk-root') ?? document.body, { key: '/' })
      const list = screen.getByRole('listbox', { name: 'Quick insert' })
      expect(within(list).queryByText('Button')).toBeNull()
      expect(within(list).getByText('Text')).toBeTruthy()
    })
  })

  describe('special links', () => {
    /**
     * Select the button block and hand back its Link field's picker button.
     *
     * @param {ReturnType<typeof renderEditor>} editor
     * @returns {HTMLElement | null}
     */
    function openButtonBlock(editor) {
      fireEvent.click(
        /** @type {Element} */ (document.querySelector('[data-block-type="button"]')),
      )
      editor.rerender()
      return screen.queryByLabelText('Special links')
    }

    it('inserts an unsubscribe merge tag into an href', () => {
      // The linter tells you the unsubscribe link is missing; before this there
      // was no way to add one without knowing the ESP's merge-tag spelling.
      const editor = renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
      const picker = /** @type {HTMLElement} */ (openButtonBlock(editor))

      fireEvent.click(picker)
      // Scoped to the menu: the kitchen-sink document has an "Unsubscribe" link
      // of its own sitting on the canvas.
      const menu = screen.getByRole('listbox', { name: 'Special links' })
      fireEvent.mouseDown(within(menu).getByText('Unsubscribe'))

      const button = listBlocks(editor.get()).find((b) => b.type === 'button')
      expect(button?.props.href).toBe('{{unsubscribe_url}}')
    })

    it('offers the three ESP links the linter already treats as declared', () => {
      const editor = renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
      fireEvent.click(/** @type {HTMLElement} */ (openButtonBlock(editor)))

      const menu = screen.getByRole('listbox', { name: 'Special links' })
      expect([...menu.querySelectorAll('.mk-var-sample')].map((n) => n.textContent)).toEqual([
        '{{unsubscribe_url}}',
        '{{preferences_url}}',
        '{{view_in_browser_url}}',
      ])
    })

    it('lets a consumer replace the list, or remove the picker entirely', () => {
      const editor = renderEditor({
        value: kitchenSinkDocument(),
        vars: sampleVars,
        specialLinks: [{ label: 'Refer a friend', value: '{{referral_url}}' }],
      })
      fireEvent.click(/** @type {HTMLElement} */ (openButtonBlock(editor)))
      const menu = screen.getByRole('listbox', { name: 'Special links' })
      expect(within(menu).getByText('Refer a friend')).toBeTruthy()
      expect(within(menu).queryByText('Unsubscribe')).toBeNull()

      cleanup()
      const bare = renderEditor({
        value: kitchenSinkDocument(),
        vars: sampleVars,
        specialLinks: [],
      })
      expect(openButtonBlock(bare)).toBeNull()
    })
  })

  describe('template name', () => {
    it('is editable in the toolbar and lands on the document', () => {
      const editor = renderEditor()
      const title = screen.getByLabelText('Template name')
      expect(/** @type {HTMLInputElement} */ (title).placeholder).toBe('Untitled email')

      fireEvent.change(title, { target: { value: 'Welcome email v2' } })
      expect(editor.get().settings.name).toBe('Welcome email v2')
    })

    it('coalesces typing a name into one undo step', () => {
      const editor = renderEditor()
      const title = screen.getByLabelText('Template name')
      for (const value of ['W', 'We', 'Wel', 'Welc']) {
        fireEvent.change(title, { target: { value } })
      }
      expect(editor.get().settings.name).toBe('Welc')

      editor.rerender()
      fireEvent.keyDown(/** @type {Element} */ (document.querySelector('.mk-root')), {
        key: 'z',
        ctrlKey: true,
      })
      expect(editor.get().settings.name).toBe('')
    })

    it('is also editable in the Settings tab', () => {
      const editor = renderEditor()
      fireEvent.click(screen.getByRole('tab', { name: /Settings/ }))
      const field = within(screen.getByLabelText('Settings')).getByLabelText('Template name')
      fireEvent.change(field, { target: { value: 'From the panel' } })
      expect(editor.get().settings.name).toBe('From the panel')
    })

    it('names the exported component, in preference to the subject', () => {
      const onExport = vi.fn()
      const doc = kitchenSinkDocument()
      doc.settings.name = 'Order shipped'
      renderEditor({ value: doc, vars: sampleVars, onExport })

      fireEvent.click(screen.getByRole('tab', { name: /Code/ }))
      expect(/** @type {Element} */ (document.querySelector('.mk-code')).textContent).toContain(
        'export function OrderShipped(',
      )

      fireEvent.click(screen.getByText('Export'))
      expect(onExport.mock.calls[0][0].jsx).toContain('export function OrderShipped(')
    })

    it('falls back to the subject when unnamed', () => {
      renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
      fireEvent.click(screen.getByRole('tab', { name: /Code/ }))
      expect(/** @type {Element} */ (document.querySelector('.mk-code')).textContent).toContain(
        'export function YourOrderIsOnItsWay(',
      )
    })
  })

  it('opens quick insert with / after clicking the canvas', () => {
    // Reproduces the real focus path: clicking a <div> canvas leaves focus on
    // <body>, so the shortcut only works because the root pulls focus to itself.
    // Dispatching keydown straight at `.mk-root` hid this bug entirely.
    const editor = renderEditor()
    const canvas = /** @type {Element} */ (document.querySelector('.mk-canvas'))
    fireEvent.pointerDown(canvas)
    fireEvent.click(canvas)

    expect(document.activeElement).toBe(document.querySelector('.mk-root'))

    fireEvent.keyDown(/** @type {Element} */ (document.activeElement), { key: '/' })
    const dialog = screen.getByRole('dialog', { name: 'Quick insert' })

    fireEvent.change(within(dialog).getByLabelText('Search blocks…'), { target: { value: 'butt' } })
    const options = within(dialog).getAllByRole('option')
    expect(options).toHaveLength(1)

    fireEvent.mouseDown(options[0])
    expect(listBlocks(editor.get()).some((b) => b.type === 'button')).toBe(true)
  })

  it('undoes and redoes with the keyboard', () => {
    const editor = renderEditor()
    fireEvent.click(within(screen.getByLabelText('Blocks')).getByText('Divider'))
    expect(listBlocks(editor.get())).toHaveLength(3)
    editor.rerender()

    const root = /** @type {Element} */ (document.querySelector('.mk-root'))
    fireEvent.keyDown(root, { key: 'z', ctrlKey: true })
    expect(listBlocks(editor.get())).toHaveLength(2)

    editor.rerender()
    fireEvent.keyDown(root, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(listBlocks(editor.get())).toHaveLength(3)
  })

  it('deletes the selected block with the Delete key', () => {
    const editor = renderEditor()
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-block-id][data-block-type="text"]')))
    editor.rerender()
    fireEvent.keyDown(/** @type {Element} */ (document.querySelector('.mk-root')), { key: 'Delete' })
    expect(listBlocks(editor.get())).toHaveLength(1)
  })

  it('does not treat Delete inside a text field as "delete the block"', () => {
    const editor = renderEditor()
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-block-id][data-block-type="text"]')))
    editor.rerender()
    const input = within(screen.getByLabelText('Properties')).getByLabelText('Text')
    fireEvent.keyDown(input, { key: 'Delete' })
    expect(listBlocks(editor.get())).toHaveLength(2)
  })

  it('coalesces typing into a single undo step', () => {
    const editor = renderEditor()
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-block-id][data-block-type="text"]')))
    editor.rerender()

    const textarea = within(screen.getByLabelText('Properties')).getByLabelText('Text')
    for (const value of ['H', 'He', 'Hel', 'Hell', 'Hello']) {
      fireEvent.change(textarea, { target: { value } })
    }
    expect(listBlocks(editor.get())[0].props.text).toBe('Hello')

    editor.rerender()
    fireEvent.keyDown(/** @type {Element} */ (document.querySelector('.mk-root')), {
      key: 'z',
      ctrlKey: true,
    })
    // One undo returns to the original text, not to "Hell".
    expect(listBlocks(editor.get())[0].props.text).toBe('A')
  })

  it('offers merge-variable autocomplete on {{', async () => {
    const editor = renderEditor({ vars: sampleVars })
    fireEvent.click(/** @type {Element} */ (document.querySelector('[data-block-id][data-block-type="text"]')))
    editor.rerender()

    const textarea = within(screen.getByLabelText('Properties')).getByLabelText('Text')
    fireEvent.change(textarea, { target: { value: 'Hi {{' } })
    fireEvent.keyUp(textarea, { key: '{' })

    const menu = await screen.findByRole('listbox')
    expect(within(menu).getByText('user.name')).toBeTruthy()
    expect(within(menu).getByText('order.total')).toBeTruthy()
    // The sample value is shown alongside each path.
    expect(within(menu).getByText('Smit')).toBeTruthy()

    fireEvent.mouseDown(within(menu).getByText('user.name'))
    expect(listBlocks(editor.get())[0].props.text).toBe('Hi {{user.name}}')
  })

  it('switches to the code view and shows the emitted component', () => {
    renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
    fireEvent.click(screen.getByRole('tab', { name: /Code/ }))
    const code = /** @type {Element} */ (document.querySelector('.mk-code'))
    expect(code.textContent).toContain("from '@react-email/components'")
    expect(code.textContent).toContain('export function YourOrderIsOnItsWay')
    expect(code.textContent).toContain('{user.name}')
  })

  it('offers every export format in the code view, including TSX', () => {
    renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
    fireEvent.click(screen.getByRole('tab', { name: /Code/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'TSX' }))
    expect(/** @type {Element} */ (document.querySelector('.mk-code')).textContent).toContain(
      'export interface YourOrderIsOnItsWayProps',
    )
  })

  it('warns about the MJML caveat where the user will see it', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('tab', { name: /Code/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'MJML' }))
    expect(document.body.textContent).toMatch(/does not bundle the MJML compiler/)
  })

  it('shows lint issues, and selects the offending block when one is clicked', () => {
    const editor = renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
    fireEvent.click(screen.getByRole('tab', { name: /Checks/ }))

    const items = screen.getAllByRole('listitem')
    expect(items.length).toBeGreaterThan(0)

    const clickable = document.querySelector('.mk-lint-item:not([disabled])')
    expect(clickable, 'expected at least one issue to link to a node').toBeTruthy()
    fireEvent.click(/** @type {Element} */ (clickable))
    editor.rerender()

    // The canvas only exists in the Design view, so go back to see the selection.
    fireEvent.click(screen.getByRole('tab', { name: /Design/ }))
    expect(document.querySelector('[data-selected="true"]')).toBeTruthy()
  })

  it('shows an issue count badge on the Checks tab', () => {
    renderEditor()
    const tab = screen.getByRole('tab', { name: /Checks/ })
    expect(tab.textContent).toMatch(/\d/)
  })

  it('previews in a sandboxed iframe, never inline', () => {
    // Email HTML carries `html,body{margin:0!important}`; inline it would
    // restyle the consumer's page.
    renderEditor({ value: kitchenSinkDocument() })
    fireEvent.click(screen.getByRole('tab', { name: /Preview/ }))
    const frame = /** @type {HTMLIFrameElement} */ (document.querySelector('iframe'))
    expect(frame).toBeTruthy()
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.getAttribute('srcdoc')).toContain('<!DOCTYPE html')
  })

  it('switches the preview between desktop, mobile and text', () => {
    renderEditor({ value: kitchenSinkDocument(), vars: sampleVars })
    fireEvent.click(screen.getByRole('tab', { name: /Preview/ }))

    fireEvent.click(screen.getByLabelText('Mobile'))
    expect(/** @type {HTMLElement} */ (document.querySelector('.mk-preview-device')).style.width).toBe(
      '375px',
    )

    fireEvent.click(screen.getByLabelText('Text'))
    expect(/** @type {Element} */ (document.querySelector('.mk-code')).textContent).toContain(
      'Thanks, Smit!',
    )
  })

  it('imports HTML through the dialog, reporting before replacing', () => {
    const editor = renderEditor()
    fireEvent.click(screen.getByText('Import HTML'))

    const dialog = screen.getByRole('dialog')
    const source =
      '<html><head><title>Imported</title></head><body><table><tr><td style="padding:10px"><h1>Imported heading</h1></td></tr></table></body></html>'
    fireEvent.change(within(dialog).getByLabelText('Import an existing email'), {
      target: { value: source },
    })

    // Nothing is replaced until the report has been shown and confirmed.
    fireEvent.click(within(dialog).getByText('Analyse'))
    expect(dialog.textContent).toMatch(/blocks are fully editable/)
    expect(editor.get().settings.subject).not.toBe('Imported')

    fireEvent.click(within(dialog).getByText('Replace template'))
    expect(editor.get().settings.subject).toBe('Imported')
    expect(listBlocks(editor.get()).some((b) => b.type === 'heading')).toBe(true)
  })

  it('keeps the previous template on the undo stack after an import', () => {
    const editor = renderEditor()
    fireEvent.click(screen.getByText('Import HTML'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Import an existing email'), {
      target: { value: '<html><body><table><tr><td><p>New</p></td></tr></table></body></html>' },
    })
    fireEvent.click(within(dialog).getByText('Analyse'))
    fireEvent.click(within(dialog).getByText('Replace template'))
    editor.rerender()

    fireEvent.keyDown(/** @type {Element} */ (document.querySelector('.mk-root')), {
      key: 'z',
      ctrlKey: true,
    })
    expect(listBlocks(editor.get()).map((b) => b.props.text)).toContain('A')
  })

  it('calls onExport with all six formats', () => {
    const onExport = vi.fn()
    renderEditor({ value: kitchenSinkDocument(), vars: sampleVars, onExport })
    fireEvent.click(screen.getByText('Export'))
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(Object.keys(onExport.mock.calls[0][0]).sort()).toEqual([
      'html',
      'json',
      'jsx',
      'mjml',
      'text',
      'tsx',
    ])
  })

  it('applies theme tokens as CSS variables on its own root only', () => {
    renderEditor({ theme: { accent: '#ff0055' } })
    const root = /** @type {HTMLElement} */ (document.querySelector('.mk-root'))
    expect(root.style.getPropertyValue('--mk-accent')).toBe('#ff0055')
  })

  it('warns about a mistyped theme key instead of silently ignoring it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderEditor({ theme: { accnet: '#ff0055' } })
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/unknown theme key accnet/))
    warn.mockRestore()
  })

  it('translates the UI', () => {
    renderEditor({ locale: 'hi' })
    expect(screen.getByLabelText('ब्लॉक')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /डिज़ाइन/ })).toBeTruthy()
  })

  it('accepts per-key string overrides', () => {
    renderEditor({ messages: { 'palette.title': 'Widgets' } })
    expect(screen.getByLabelText('Widgets')).toBeTruthy()
  })

  it('takes dark mode from the appearance prop', () => {
    renderEditor()
    expect(
      /** @type {HTMLElement} */ (document.querySelector('.mk-root')).dataset.mkTheme,
    ).toBe('light')

    cleanup()
    renderEditor({ appearance: 'dark' })
    expect(
      /** @type {HTMLElement} */ (document.querySelector('.mk-root')).dataset.mkTheme,
    ).toBe('dark')
  })

  it('ships no dark-mode toggle of its own — the host app owns the setting', () => {
    renderEditor()
    expect(screen.queryByLabelText('Toggle dark mode')).toBeNull()
  })

  it('still offers the toggle to a custom layout that wires one up', () => {
    const onToggleAppearance = vi.fn()

    function Harness() {
      const store = useMailKiln({ defaultValue: twoColumnDocument() })
      return (
        <MailKilnProvider
          value={{ store, blocks: builtinBlocks, instanceId: 't', drag: { activeDrag: null, dropTarget: null } }}
        >
          <Toolbar
            view="design"
            onView={() => {}}
            device="desktop"
            onDevice={() => {}}
            onImport={() => {}}
            appearance="light"
            onToggleAppearance={onToggleAppearance}
          />
        </MailKilnProvider>
      )
    }
    render(<Harness />)

    fireEvent.click(screen.getByLabelText('Toggle dark mode'))
    expect(onToggleAppearance).toHaveBeenCalledTimes(1)
  })

  it('can hide the palette and inspector for a custom layout', () => {
    renderEditor({ showPalette: false, showInspector: false })
    expect(screen.queryByLabelText('Blocks')).toBeNull()
    expect(screen.queryByLabelText('Properties')).toBeNull()
  })

  it('works uncontrolled', () => {
    render(<MailKiln defaultValue={twoColumnDocument()} />)
    expect(document.querySelectorAll('[data-block-id][data-block-type="text"]')).toHaveLength(2)
  })

  it('gives a registered custom block a palette entry and a generated Inspector', () => {
    const custom = defineBlock({
      type: 'test-countdown',
      label: 'Countdown',
      group: 'Advanced',
      defaultProps: { endsAt: '2026-01-01', tone: 'urgent' },
      schema: [
        { key: 'endsAt', type: 'text', label: 'Ends at' },
        {
          key: 'tone',
          type: 'select',
          label: 'Tone',
          options: [
            { value: 'urgent', label: 'Urgent' },
            { value: 'calm', label: 'Calm' },
          ],
        },
      ],
      render: { html: (p) => `<div>${p.endsAt}</div>` },
    })

    try {
      const editor = renderEditor({ blocks: [custom] })
      const palette = screen.getByLabelText('Blocks')
      fireEvent.click(within(palette).getByText('Countdown'))
      expect(listBlocks(editor.get()).some((b) => b.type === 'test-countdown')).toBe(true)

      editor.rerender()
      const inspector = screen.getByLabelText('Properties')
      // Both fields were generated from the definition — no bespoke component.
      expect(within(inspector).getByLabelText('Ends at')).toBeTruthy()
      expect(within(inspector).getByLabelText('Tone')).toBeTruthy()
    } finally {
      unregisterBlock('test-countdown')
    }
  })

  it('exposes drag handles and keyboard drag instructions for every block', () => {
    // dnd-kit's own rect measurement is meaningless in jsdom, so the drop maths
    // is unit-tested in dnd.test.js. What matters here is that each block is a
    // real keyboard-reachable draggable with instructions attached.
    renderEditor()
    const nodes = document.querySelectorAll('[data-block-id]')
    expect(nodes.length).toBe(2)
    for (const node of nodes) {
      expect(node.getAttribute('tabindex')).toBe('0')
      expect(node.getAttribute('aria-roledescription')).toBe('Text, sortable')
      expect(node.getAttribute('aria-describedby')).toBeTruthy()
    }
    expect(document.body.textContent).toMatch(/Press space or enter to pick up a block/)
  })

  it('commits a cross-column move through the same path a drop takes', async () => {
    // dnd-kit cannot actually run a drag in jsdom — every getBoundingClientRect
    // returns zeros, so its sensors have nothing to measure. The drop *maths* is
    // unit-tested in dnd.test.js; this covers the other half, the commit that
    // onDragEnd performs, through the public hook.
    /** @type {any} */
    let store = null
    function Harness() {
      store = useMailKiln({ defaultValue: twoColumnDocument() })
      return <span data-testid="probe">{listBlocks(store.doc).length}</span>
    }
    render(<Harness />)

    const doc = store.doc
    const [left, right] = doc.sections[0].rows[0].columns
    await act(async () => {
      store.moveBlock({ blockId: left.blocks[0].id, toColumnId: right.id, toIndex: 0 })
    })

    expect(store.doc.sections[0].rows[0].columns[0].blocks).toHaveLength(0)
    expect(
      store.doc.sections[0].rows[0].columns[1].blocks.map((/** @type {any} */ b) => b.props.text),
    ).toEqual(['A', 'B'])

    // And one drop is exactly one undo step.
    await act(async () => {
      store.undo()
    })
    expect(store.doc.sections[0].rows[0].columns[0].blocks).toHaveLength(1)
  })

  describe('rich-text field', () => {
    /** @returns {HTMLElement} the panel showing a selected text block */
    const selectTextBlock = () => {
      const editor = renderEditor()
      const node = document.querySelector('[data-block-id][data-block-type="text"]')
      fireEvent.click(/** @type {Element} */ (node))
      editor.rerender()
      return screen.getByLabelText('Properties')
    }

    it('offers formatting buttons over the property-panel textarea', () => {
      const inspector = selectTextBlock()
      const bar = within(inspector).getByRole('group', { name: 'Text formatting' })
      expect(within(bar).getByLabelText('Bold')).toBeTruthy()
      expect(within(bar).getByLabelText('Link')).toBeTruthy()
    })

    it('wraps the selected run rather than making the author type tags', () => {
      const inspector = selectTextBlock()
      const field = /** @type {HTMLTextAreaElement} */ (within(inspector).getByLabelText('Text'))
      fireEvent.change(field, { target: { value: 'Hello there' } })
      field.setSelectionRange(0, 5)
      fireEvent.click(within(inspector).getByLabelText('Bold'))

      const updated = /** @type {HTMLTextAreaElement} */ (within(inspector).getByLabelText('Text'))
      expect(updated.value).toBe('<b>Hello</b> there')
    })

    it('leaves the preheader a plain textarea — <b> in an inbox preview is a bug', () => {
      renderEditor()
      fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
      const inspector = screen.getByLabelText('Settings')
      expect(within(inspector).getByLabelText('Preheader')).toBeTruthy()
      expect(within(inspector).queryByRole('group', { name: 'Text formatting' })).toBeNull()
    })
  })

  it('offers border fields on a row and on a column', () => {
    const editor = renderEditor()
    const column = document.querySelector('[data-column-id]')
    fireEvent.click(/** @type {Element} */ (column))
    editor.rerender()

    const inspector = screen.getByLabelText('Properties')
    fireEvent.click(within(inspector).getByRole('button', { name: 'Borders' }))
    const field = within(inspector).getByLabelText('Border right')
    fireEvent.change(field, { target: { value: '5px solid #1d1d1f' } })

    expect(editor.get().sections[0].rows[0].columns[0].props.borderRight).toBe('5px solid #1d1d1f')
  })

  it('honours lintDisable, so an accepted rule stops being reported', () => {
    const wide = normalize(createDocument({ settings: { width: 700 } }))
    /** @returns {string} the text of the Checks view */
    const checksText = () => {
      fireEvent.click(screen.getByRole('tab', { name: /Checks/ }))
      return /** @type {HTMLElement} */ (document.querySelector('.mk-main')).textContent ?? ''
    }

    renderEditor({ value: wide })
    expect(checksText()).toMatch(/700px/)

    cleanup()
    renderEditor({ value: wide, lintDisable: ['structure'] })
    expect(checksText()).not.toMatch(/700px/)
  })
})
