import { describe, expect, it } from 'vitest'
import {
  assertDocument,
  builtinTemplates,
  exportDocument,
  getTemplate,
  lintDocument,
  listBlocks,
  renderToHtml,
  validateDocument,
} from '../src/core/index.js'
import { allBlocksIn, parseHtml } from './helpers.js'
import { importFromHtml } from '../src/core/index.js'

describe('starter templates', () => {
  it('ships a named, described set', () => {
    expect(builtinTemplates.length).toBeGreaterThanOrEqual(4)
    for (const template of builtinTemplates) {
      expect(template.id, 'id').toBeTruthy()
      expect(template.name, `${template.id} name`).toBeTruthy()
      expect(template.description, `${template.id} description`).toBeTruthy()
      expect(typeof template.create).toBe('function')
    }
    const ids = builtinTemplates.map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(getTemplate('welcome')).toBeTruthy()
    expect(getTemplate('nope')).toBeUndefined()
  })

  it.each(builtinTemplates.map((template) => [template.id, template]))(
    '%s produces a valid document',
    (_id, template) => {
      const doc = template.create()
      expect(validateDocument(doc, { knownBlocksOnly: true })).toEqual([])
      expect(() => assertDocument(doc)).not.toThrow()
      expect(listBlocks(doc).length).toBeGreaterThan(3)
      expect(doc.settings.subject).toBeTruthy()
      expect(doc.settings.preheader).toBeTruthy()
    },
  )

  it.each(builtinTemplates.map((template) => [template.id, template]))(
    '%s returns a fresh document with unique ids every time',
    (_id, template) => {
      // Picking the same template twice must not produce colliding node ids.
      const first = template.create()
      const second = template.create()
      expect(first).not.toBe(second)

      const ids = [...allBlocksIn(first), ...allBlocksIn(second)].map((block) => block.id)
      expect(new Set(ids).size).toBe(ids.length)
    },
  )

  it.each(builtinTemplates.map((template) => [template.id, template]))(
    '%s passes our own linter with zero errors',
    (_id, template) => {
      // The bar that matters: shipping a starter template that trips the
      // deliverability rules we advertise would be indefensible. Warnings are
      // allowed (an empty image src is an intentional prompt); errors are not.
      const result = lintDocument(template.create())
      const errors = result.issues.filter((issue) => issue.level === 'error')
      expect(errors.map((issue) => `${issue.id}: ${issue.message}`)).toEqual([])
    },
  )

  it.each(builtinTemplates.map((template) => [template.id, template]))(
    '%s stays well under the Gmail clipping limit',
    (_id, template) => {
      expect(lintDocument(template.create()).sizeBytes).toBeLessThan(40_000)
    },
  )

  it('gives every template an unsubscribe or preferences link', () => {
    for (const template of builtinTemplates) {
      const html = renderToHtml(template.create())
      expect(html, template.id).toMatch(/unsubscribe|preferences/i)
    }
  })

  it('exports every template to every format', () => {
    for (const template of builtinTemplates) {
      const bundle = exportDocument(template.create(), { name: template.name })
      expect(bundle.jsx, template.id).toContain("from '@react-email/components'")
      expect(bundle.html, template.id).toContain('<!DOCTYPE html')
      expect(bundle.text.length, template.id).toBeGreaterThan(80)
      expect(() => JSON.parse(bundle.json)).not.toThrow()
    }
  })

  it('round-trips every template through the importer', () => {
    for (const template of builtinTemplates) {
      const doc = template.create()
      const report = importFromHtml(renderToHtml(doc), { parseHtml })
      expect(report.confidence, template.id).toBeGreaterThan(0.85)
    }
  })

  it('uses merge variables so the typed export is worth something', () => {
    const welcome = JSON.stringify(getTemplate('welcome')?.create())
    expect(welcome).toMatch(/\{\{user\.name\}\}/)
  })
})
