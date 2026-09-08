// @vitest-environment jsdom

/**
 * The field dispatcher.
 *
 * This is what makes `defineBlock` worth using: a `schema` in, a working panel
 * out, with no per-block Inspector anywhere in the package. So every field type
 * gets a spec, including the ones only a custom block would reach for.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Field, getIn } from '../../src/react/fields/index.jsx'
import { MailKilnProvider } from '../../src/react/context.jsx'
import { I18nProvider } from '../../src/react/i18n/index.jsx'
import { resetIds } from '../../src/core/index.js'
import { docOf, sampleVars } from '../support/kit.js'

afterEach(() => {
  cleanup()
  resetIds()
  vi.restoreAllMocks()
})

/**
 * A field on its own, with just enough context around it for the controls that
 * reach for one.
 *
 * @param {import('../../src/core/types.js').FieldDef} field
 * @param {any} value
 * @param {Record<string, any>} [context]
 * @returns {{ onChange: import('vitest').Mock }}
 */
function mountField(field, value, context = {}) {
  const onChange = vi.fn()
  render(
    <I18nProvider>
      <MailKilnProvider
        value={
          /** @type {any} */ ({
            store: { doc: docOf(), vars: sampleVars() },
            blocks: [],
            instanceId: 'spec',
            drag: { activeDrag: null, dropTarget: null },
            ...context,
          })
        }
      >
        <Field field={field} value={value} onChange={onChange} />
      </MailKilnProvider>
    </I18nProvider>,
  )
  return { onChange }
}

describe('getIn()', () => {
  it('reads a plain key and a dotted path', () => {
    const props = { fontSize: 16, padding: { top: 4 } }
    expect(getIn(props, 'fontSize')).toBe(16)
    expect(getIn(props, 'padding.top')).toBe(4)
    expect(getIn(props, 'padding.left')).toBeUndefined()
    expect(getIn(props, 'missing.deep')).toBeUndefined()
  })
})

describe('text-ish fields', () => {
  it('renders a labelled text box that reports the key it edits', () => {
    const { onChange } = mountField({ key: 'alt', type: 'text', label: 'Alt text' }, 'before')
    const input = screen.getByLabelText('Alt text')
    fireEvent.change(input, { target: { value: 'after' } })
    expect(onChange).toHaveBeenCalledWith('after', 'alt')
  })

  it('renders help text underneath when the field declares it', () => {
    mountField({ key: 'alt', type: 'text', label: 'Alt text', help: 'Never leave it empty.' }, '')
    expect(screen.getByText('Never leave it empty.')).toBeTruthy()
  })

  it('gives a textarea to multi-line copy', () => {
    mountField({ key: 'html', type: 'textarea', label: 'HTML' }, '<p>x</p>')
    expect(screen.getByLabelText('HTML').tagName).toBe('TEXTAREA')
  })

  it('offers merge-variable autocomplete once you type two braces', async () => {
    mountField({ key: 'text', type: 'text', label: 'Text', vars: true }, '')
    const input = screen.getByLabelText('Text')
    fireEvent.change(input, { target: { value: 'Hi {{user' } })

    await waitFor(() => expect(screen.getByRole('option', { name: /user\.name/ })).toBeTruthy())
  })

  it('stays a plain box when the field opts out of variables', () => {
    mountField({ key: 'letterSpacing', type: 'text', label: 'Letter spacing', vars: false }, '')
    const input = /** @type {HTMLInputElement} */ (screen.getByLabelText('Letter spacing'))
    fireEvent.change(input, { target: { value: '{{user' } })
    expect(screen.queryByRole('option')).toBeNull()
  })
})

describe('numeric fields', () => {
  it('reports a number, and an empty string when the box is cleared', () => {
    const { onChange } = mountField({ key: 'fontSize', type: 'number', label: 'Size' }, 16)
    const input = screen.getByLabelText('Size')

    fireEvent.change(input, { target: { value: '24' } })
    expect(onChange).toHaveBeenCalledWith(24, 'fontSize')

    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith('', 'fontSize')
  })

  it('renders a slider with its current value beside it', () => {
    const { onChange } = mountField(
      { key: 'height', type: 'range', label: 'Height', min: 2, max: 160, step: 2 },
      24,
    )
    expect(screen.getByText('24px')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Height'), { target: { value: '40' } })
    expect(onChange).toHaveBeenCalledWith(40, 'height')
  })
})

describe('colour', () => {
  it('pairs the native picker with a hex box, both writing the same prop', () => {
    const { onChange } = mountField({ key: 'color', type: 'color', label: 'Colour' }, '#ff0000')
    fireEvent.change(screen.getByLabelText('Colour hex'), { target: { value: '#00ff00' } })
    expect(onChange).toHaveBeenCalledWith('#00ff00', 'color')
  })

  it('shows black in the swatch for an empty value without writing it down', () => {
    mountField({ key: 'color', type: 'color', label: 'Colour' }, '')
    const swatch = /** @type {HTMLInputElement} */ (screen.getByLabelText('Colour'))
    expect(swatch.value).toBe('#000000')
    expect(/** @type {HTMLInputElement} */ (screen.getByLabelText('Colour hex')).value).toBe('')
  })

  it('expands a three-digit hex for the native picker', () => {
    mountField({ key: 'color', type: 'color', label: 'Colour' }, '#f0a')
    expect(/** @type {HTMLInputElement} */ (screen.getByLabelText('Colour')).value).toBe('#ff00aa')
  })
})

describe('select', () => {
  it('hands back the option’s own value, not the string the DOM gave it', () => {
    const { onChange } = mountField(
      {
        key: 'level',
        type: 'select',
        label: 'Level',
        options: [1, 2, 3].map((n) => ({ value: n, label: `H${n}` })),
      },
      2,
    )
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith(3, 'level')
  })
})

describe('toggle and align', () => {
  it('renders a switch that flips the value it was given', () => {
    const { onChange } = mountField(
      { key: 'fullWidth', type: 'toggle', label: 'Full width' },
      false,
    )
    const toggle = screen.getByRole('switch', { name: 'Full width' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true, 'fullWidth')
  })

  it('renders three alignment buttons, with the current one pressed', () => {
    const { onChange } = mountField({ key: 'align', type: 'align', label: 'Align' }, 'left')
    expect(screen.getByLabelText('Left').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByLabelText('Centre'))
    expect(onChange).toHaveBeenCalledWith('center', 'align')
  })
})

describe('spacing', () => {
  it('edits one side at a time, tagging the patch with that side', () => {
    const { onChange } = mountField(
      { key: 'padding', type: 'spacing', label: 'Padding' },
      { top: 8, right: 24, bottom: 8, left: 24 },
    )
    fireEvent.change(screen.getByLabelText('Padding Top'), { target: { value: '12' } })
    expect(onChange).toHaveBeenCalledWith(
      { top: 12, right: 24, bottom: 8, left: 24 },
      'padding.top',
    )
  })
})

describe('url', () => {
  it('offers the special links every ESP substitutes', () => {
    const { onChange } = mountField({ key: 'href', type: 'url', label: 'Link' }, '')
    fireEvent.click(screen.getByRole('button', { name: 'Special links' }))
    fireEvent.mouseDown(screen.getByRole('option', { name: /Unsubscribe/ }))
    expect(onChange).toHaveBeenCalledWith('{{unsubscribe_url}}', 'href')
  })

  it('takes the consumer’s own list instead when there is one', () => {
    mountField({ key: 'href', type: 'url', label: 'Link' }, '', {
      specialLinks: [{ label: 'Opt out', value: '{{unsub}}' }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Special links' }))
    expect(screen.getByRole('option', { name: /Opt out/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Unsubscribe/ })).toBeNull()
  })
})

describe('image', () => {
  it('always offers a URL box, whether or not uploading is wired up', () => {
    const { onChange } = mountField({ key: 'src', type: 'image', label: 'Image' }, '')
    const url = screen.getByPlaceholderText('or paste a URL')
    fireEvent.change(url, { target: { value: 'https://i.test/a.png' } })
    expect(onChange).toHaveBeenCalledWith('https://i.test/a.png', 'src')
  })

  it('shows the upload button only when the consumer supplied a hook', () => {
    mountField({ key: 'src', type: 'image', label: 'Image' }, '')
    expect(screen.queryByText('Upload')).toBeNull()

    cleanup()
    mountField({ key: 'src', type: 'image', label: 'Image' }, '', {
      onImageUpload: async () => 'https://i.test/uploaded.png',
    })
    expect(screen.getByText('Upload')).toBeTruthy()
  })
})

describe('list', () => {
  it('renders one nested editor per item, from the item schema', () => {
    const { onChange } = mountField(
      {
        key: 'items',
        type: 'list',
        label: 'Menu items',
        addLabel: 'Add item',
        itemDefaults: { label: 'Link', url: '' },
        itemSchema: [
          { key: 'label', type: 'text', label: 'Label' },
          { key: 'url', type: 'url', label: 'URL' },
        ],
      },
      [{ label: 'Shop', url: 'https://s.test' }],
    )

    expect(screen.getByText('Shop')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Store' } })
    expect(onChange).toHaveBeenCalledWith([{ label: 'Store', url: 'https://s.test' }], 'items')
  })

  it('adds an item from the defaults and removes one on request', () => {
    const { onChange } = mountField(
      {
        key: 'items',
        type: 'list',
        label: 'Menu items',
        itemDefaults: { label: 'Link', url: '' },
        itemSchema: [{ key: 'label', type: 'text', label: 'Label' }],
      },
      [{ label: 'Shop' }],
    )

    fireEvent.click(screen.getByRole('button', { name: /Add item/ }))
    expect(onChange).toHaveBeenLastCalledWith(
      [{ label: 'Shop' }, { label: 'Link', url: '' }],
      'items',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onChange).toHaveBeenLastCalledWith([], 'items')
  })

  it('titles an item by whatever it can find on it', () => {
    mountField(
      {
        key: 'links',
        type: 'list',
        label: 'Links',
        itemSchema: [{ key: 'url', type: 'url', label: 'URL' }],
      },
      [{ network: 'twitter' }, {}],
    )
    expect(screen.getByText('twitter')).toBeTruthy()
    expect(screen.getByText('#2')).toBeTruthy()
  })
})

describe('richtext', () => {
  it('comes with a formatting bar the plain textarea does not get', () => {
    mountField({ key: 'text', type: 'richtext', label: 'Text' }, 'Hello')
    const toolbar = screen.getByLabelText('Text formatting')
    expect(within(toolbar).getByLabelText('Bold')).toBeTruthy()
    expect(within(toolbar).getByLabelText('Link')).toBeTruthy()
  })
})

describe('unknown types', () => {
  it('render nothing rather than a broken control', () => {
    const { container } = render(
      <I18nProvider>
        <Field
          field={/** @type {any} */ ({ key: 'x', type: 'hologram', label: 'X' })}
          value=""
          onChange={() => {}}
        />
      </I18nProvider>,
    )
    expect(container.innerHTML).toBe('')
  })
})
