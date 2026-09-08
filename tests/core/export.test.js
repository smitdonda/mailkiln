/**
 * The export bundle, plus the two small modules that ride along with it: editor
 * theming and the special links every ESP substitutes.
 *
 * The JSON member is the one that matters most — "export" here must never mean
 * "the only copy is now in a format we control".
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  SPECIAL_LINKS,
  SPECIAL_LINK_PATHS,
  THEME_VARS,
  createBlock,
  createDocument,
  exportDocument,
  exportFilenames,
  isSpecialLink,
  normalize,
  resetIds,
  setCondition,
  setRepeat,
  themeToCssVars,
  unknownThemeKeys,
  validateDocument,
} from '../../src/core/index.js'
import { allBlocksIn, docOf, firstRowId, sampleVars } from '../support/kit.js'

afterEach(() => resetIds())

describe('exportDocument()', () => {
  it('produces every format in one call', () => {
    const bundle = exportDocument(docOf([createBlock('text', { text: 'Hi' })]))
    expect(Object.keys(bundle)).toEqual(['jsx', 'tsx', 'html', 'mjml', 'text', 'json'])
    expect(bundle.html).toContain('<!DOCTYPE')
    expect(bundle.mjml).toContain('<mjml>')
    expect(bundle.text).toBe('Hi')
    expect(bundle.jsx).toContain('export function')
    expect(bundle.tsx).toContain('export function')
  })

  it('round-trips through the JSON member', () => {
    const doc = normalize(docOf([createBlock('text', { text: 'Hi' })]))
    const parsed = JSON.parse(exportDocument(doc).json)
    expect(parsed).toEqual(doc)
    expect(validateDocument(parsed, { knownBlocksOnly: true })).toEqual([])
  })

  it('strips the unfinished conditions the editor was right to keep', () => {
    let doc = docOf([createBlock('text', { text: 'Hi' })])
    const blockId = allBlocksIn(doc)[0].id
    doc = setCondition(doc, blockId, /** @type {any} */ ({ path: '', op: 'truthy' }))
    doc = setRepeat(doc, firstRowId(doc), { path: '', as: 'item' })

    const parsed = JSON.parse(exportDocument(doc).json)
    expect(parsed.sections[0].rows[0].columns[0].blocks[0]).not.toHaveProperty('showIf')
    expect(parsed.sections[0].rows[0]).not.toHaveProperty('repeat')
  })

  it('names the component from the option, then the document', () => {
    const doc = docOf([], { settings: { name: 'Order receipt' } })
    expect(exportDocument(doc).jsx).toContain('export function OrderReceipt()')
    expect(exportDocument(doc, { name: 'Custom' }).jsx).toContain('export function Custom()')
  })

  it('threads the declared variables through the typed members', () => {
    const doc = docOf([createBlock('text', { text: 'Hi {{user.name}}' })])
    const bundle = exportDocument(doc, { vars: sampleVars() })
    expect(bundle.tsx).toContain('export interface')
    expect(bundle.html).toContain('Hi Ada')
    expect(bundle.jsx).toContain('{user?.name}')
  })
})

describe('exportFilenames()', () => {
  it('gives the code members a PascalCase name and the rest a kebab one', () => {
    expect(exportFilenames('Welcome email')).toEqual({
      jsx: 'WelcomeEmail.jsx',
      tsx: 'WelcomeEmail.tsx',
      html: 'welcome-email.html',
      mjml: 'welcome-email.mjml',
      text: 'welcome-email.txt',
      json: 'welcome-email.mailkiln.json',
    })
  })

  it('accepts a name that is already an identifier, and falls back on nothing', () => {
    expect(exportFilenames('OrderReceipt').jsx).toBe('OrderReceipt.jsx')
    expect(exportFilenames('').jsx).toBe('EmailTemplate.jsx')
  })
})

describe('themeToCssVars()', () => {
  it('maps tokens onto the custom properties the stylesheet reads', () => {
    expect(themeToCssVars({ accent: '#4f46e5', foreground: '#111' })).toEqual({
      '--mk-accent': '#4f46e5',
      '--mk-fg': '#111',
    })
  })

  it('treats a numeric radius as pixels and leaves a string alone', () => {
    expect(themeToCssVars({ radius: 8 })).toEqual({ '--mk-radius': '8px' })
    expect(themeToCssVars({ radius: '0.5rem' })).toEqual({ '--mk-radius': '0.5rem' })
  })

  it('skips empty values, unknown keys and no theme at all', () => {
    expect(themeToCssVars({ accent: '', border: undefined })).toEqual({})
    expect(themeToCssVars(/** @type {any} */ ({ accnet: '#fff' }))).toEqual({})
    expect(themeToCssVars(null)).toEqual({})
  })

  it('keeps its custom properties out of Tailwind’s namespaces', () => {
    for (const name of Object.values(THEME_VARS)) {
      expect(name.startsWith('--mk-')).toBe(true)
      expect(name.startsWith('--mk-color-')).toBe(false)
      expect(name.startsWith('--mk-font-')).toBe(false)
    }
  })
})

describe('unknownThemeKeys()', () => {
  it('reports a typo, which would otherwise silently do nothing', () => {
    expect(unknownThemeKeys(/** @type {any} */ ({ accnet: '#fff', accent: '#000' }))).toEqual([
      'accnet',
    ])
    expect(unknownThemeKeys({ accent: '#000' })).toEqual([])
    expect(unknownThemeKeys(null)).toEqual([])
  })
})

describe('special links', () => {
  it('offers the three paths every ESP substitutes, as ready merge tags', () => {
    expect(SPECIAL_LINK_PATHS).toEqual([
      'unsubscribe_url',
      'preferences_url',
      'view_in_browser_url',
    ])
    expect(SPECIAL_LINKS).toEqual([
      '{{unsubscribe_url}}',
      '{{preferences_url}}',
      '{{view_in_browser_url}}',
    ])
  })

  it('recognises one, whitespace and all', () => {
    expect(isSpecialLink('{{unsubscribe_url}}')).toBe(true)
    expect(isSpecialLink('  {{preferences_url}}  ')).toBe(true)
    expect(isSpecialLink('{{user.name}}')).toBe(false)
    expect(isSpecialLink(/** @type {any} */ (undefined))).toBe(false)
  })
})

describe('the document is always readable back', () => {
  it('survives a full export and re-import of its own JSON', () => {
    const original = normalize(createDocument({ settings: { subject: 'Hi' } }))
    const revived = JSON.parse(exportDocument(original).json)
    expect(normalize(revived)).toEqual(original)
  })
})
