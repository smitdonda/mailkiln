/**
 * The starter templates.
 *
 * A starter that trips this package's own linter would be indefensible, so the
 * headline spec here runs every one of them through it.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  builtinTemplates,
  documentVarPaths,
  getTemplate,
  lintDocument,
  newsletterTemplate,
  passwordResetTemplate,
  receiptTemplate,
  renderToText,
  resetIds,
  validateDocument,
  welcomeTemplate,
} from '../../src/core/index.js'
import { allBlocksIn } from '../support/kit.js'

afterEach(() => resetIds())

describe('the gallery', () => {
  it('lists four templates, each with the copy the picker shows', () => {
    expect(builtinTemplates.map((t) => t.id)).toEqual([
      'welcome',
      'receipt',
      'newsletter',
      'password-reset',
    ])
    for (const template of builtinTemplates) {
      expect(template.name).toBeTruthy()
      expect(template.description).toBeTruthy()
      expect(typeof template.create).toBe('function')
    }
  })

  it('marks the ones that are triggered rather than sent as a campaign', () => {
    expect(getTemplate('receipt')?.transactional).toBe(true)
    expect(getTemplate('password-reset')?.transactional).toBe(true)
    expect(getTemplate('welcome')?.transactional).toBeUndefined()
    expect(getTemplate('nope')).toBeUndefined()
  })

  it('exports each builder by name too', () => {
    expect(welcomeTemplate().settings.name).toBe('Welcome email')
    expect(receiptTemplate().settings.name).toBe('Order receipt')
    expect(newsletterTemplate().settings.name).toBe('Newsletter issue')
    expect(passwordResetTemplate().settings.name).toBe('Password reset')
  })
})

describe('every template', () => {
  it('is a valid document built only from registered blocks', () => {
    for (const template of builtinTemplates) {
      expect(validateDocument(template.create(), { knownBlocksOnly: true })).toEqual([])
    }
  })

  it('mints fresh ids on every call, so picking one twice is safe', () => {
    const first = allBlocksIn(welcomeTemplate()).map((b) => b.id)
    const second = allBlocksIn(welcomeTemplate()).map((b) => b.id)
    expect(first).toHaveLength(second.length)
    expect(second.some((id) => first.includes(id))).toBe(false)
  })

  it('has a name distinct from its subject line', () => {
    for (const template of builtinTemplates) {
      const { name, subject } = template.create().settings
      expect(name).toBeTruthy()
      expect(subject).toBeTruthy()
      expect(name).not.toBe(subject)
    }
  })

  it('reports no lint errors', () => {
    for (const template of builtinTemplates) {
      const result = lintDocument(template.create())
      expect({ id: template.id, errors: result.errors }).toEqual({ id: template.id, errors: 0 })
    }
  })

  it('carries a way out, which is what satisfies the unsubscribe rule', () => {
    for (const template of builtinTemplates) {
      const paths = documentVarPaths(template.create())
      expect(paths.includes('unsubscribe_url') || paths.includes('preferences_url')).toBe(true)
    }
  })

  it('renders enough plain text to count as a text/plain alternative', () => {
    for (const template of builtinTemplates) {
      expect(renderToText(template.create()).length).toBeGreaterThan(40)
    }
  })

  it('declares its merge variables in the copy rather than hard-coding data', () => {
    expect(documentVarPaths(welcomeTemplate()).length).toBeGreaterThan(0)
    expect(documentVarPaths(receiptTemplate())).toContain('order.id')
  })
})

describe('the newsletter', () => {
  it('is the one with a side-by-side story row', () => {
    const doc = newsletterTemplate()
    const widest = Math.max(
      ...doc.sections.flatMap((section) => section.rows.map((row) => row.columns.length)),
    )
    expect(widest).toBeGreaterThan(1)
  })

  it('leaves its lead image for the author to fill in', () => {
    const result = lintDocument(newsletterTemplate())
    expect(result.issues.some((issue) => issue.id === 'image-src')).toBe(true)
  })
})
