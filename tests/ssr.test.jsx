/**
 * Server rendering has to agree with the first client render, or React throws
 * out the server markup and Next.js logs a hydration error.
 *
 * The trap is `@dnd-kit`: it names its accessibility elements from a
 * module-global counter, so the server's `DndDescribedBy-0` becomes
 * `DndDescribedBy-1` on the client and every draggable's `aria-describedby`
 * disagrees. Passing `DndContext` an `id` — the editor's own `useId()` — pins
 * those names to the tree instead of to a counter.
 *
 * Rendering the same tree twice in one process is the cheapest reproduction:
 * the counter advances between the two renders exactly as it does between
 * server and client.
 *
 * @module tests/ssr
 */

import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MailKiln } from '../src/index.js'
import { kitchenSinkDocument, sampleVars } from './helpers.js'

describe('server rendering', () => {
  it('produces the same markup on a second render', () => {
    const doc = kitchenSinkDocument()
    /** @returns {string} */
    const markup = () => renderToString(<MailKiln value={doc} onChange={() => {}} vars={sampleVars} />)
    expect(markup()).toBe(markup())
  })

  it('names the dnd-kit accessibility nodes after the editor instance, not a counter', () => {
    const doc = kitchenSinkDocument()
    const html = renderToString(<MailKiln value={doc} onChange={() => {}} />)
    const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1])
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.every((id) => !/^DndDescribedBy-\d+$/.test(id))).toBe(true)
  })
})
