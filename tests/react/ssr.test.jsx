/**
 * Server rendering, in the Node environment the rest of the core specs use.
 *
 * There is no `document` here at all, which is the point: the editor has to
 * survive being rendered on a server, and `mailkiln/core` has to work in a CLI
 * or a Lambda with no DOM anywhere near it.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { MailKiln } from '../../src/react/MailKiln.jsx'
import {
  createBlock,
  exportDocument,
  lintDocument,
  normalize,
  renderToHtml,
  resetIds,
} from '../../src/core/index.js'
import { docOf } from '../support/kit.js'

afterEach(() => resetIds())

describe('the environment', () => {
  it('really has no DOM', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })
})

describe('<MailKiln> on the server', () => {
  it('renders to markup without touching the DOM', () => {
    const markup = renderToStaticMarkup(
      <MailKiln defaultValue={normalize(docOf([createBlock('text', { text: 'Hello' })]))} />,
    )
    expect(markup).toContain('mk-root')
    expect(markup).toContain('Hello')
  })

  it('renders with the panels a consumer turned off', () => {
    const markup = renderToStaticMarkup(
      <MailKiln
        defaultValue={normalize(docOf())}
        showPalette={false}
        showInspector={false}
        showStructure={false}
      />,
    )
    expect(markup).toContain('mk-canvas')
    expect(markup).not.toContain('mk-panel')
  })
})

describe('mailkiln/core with no DOM', () => {
  it('renders, lints and exports a document', () => {
    const doc = normalize(docOf([createBlock('text', { text: 'Hello' })]))
    expect(renderToHtml(doc)).toContain('<!DOCTYPE')
    expect(lintDocument(doc).sizeBytes).toBeGreaterThan(0)
    expect(Object.keys(exportDocument(doc))).toHaveLength(6)
  })
})
