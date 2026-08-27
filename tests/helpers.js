/**
 * Shared test fixtures.
 *
 * @module tests/helpers
 */

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseHTML } from 'linkedom'
import {
  createBlock,
  createColumn,
  createDocument,
  createRow,
  createSection,
  defineVars,
  normalize,
  spacing,
} from '../src/core/index.js'

const here = dirname(fileURLToPath(import.meta.url))

/** Node has no DOM; linkedom is the injected parser the docs recommend. */
export const parseHtml = (/** @type {string} */ html) => parseHTML(html).document

export const sampleVars = defineVars({
  sample: {
    user: { name: 'Smit', email: 'smit@example.com' },
    order: { id: 'MK-2291', total: 4200, eta: 'Thursday', items: [{ title: 'Keyboard' }] },
    unsubscribe_url: 'https://example.com/unsub',
  },
})

/**
 * A document exercising every built-in block.
 *
 * @returns {import('../src/core/types.js').EmailDocument}
 */
export function kitchenSinkDocument() {
  return normalize(
    createDocument({
      settings: {
        subject: 'Your order is on its way',
        preheader: 'Arriving {{order.eta}}',
      },
      sections: [
        createSection({
          props: { padding: spacing(24, 0), backgroundColor: '#eef2f7' },
          rows: [
            createRow({
              children: [
                createColumn({
                  width: 100,
                  blocks: [
                    createBlock('heading', { text: 'Thanks, {{user.name}}!' }),
                    createBlock('text', { text: 'Order <b>{{order.id}}</b> is packed.' }),
                    createBlock('button', { text: 'Track it', href: 'https://example.com/track' }),
                    createBlock('image', {
                      src: 'https://example.com/hero.png',
                      alt: 'Hero',
                      width: 552,
                    }),
                    createBlock('divider'),
                    createBlock('spacer', { height: 32 }),
                    createBlock('social'),
                    createBlock('menu', {
                      items: [
                        { label: 'Shop', url: 'https://example.com/shop' },
                        { label: 'Help', url: 'https://example.com/help' },
                      ],
                    }),
                    createBlock('videoThumb', {
                      thumbnailUrl: 'https://example.com/thumb.jpg',
                      videoUrl: 'https://youtube.com/watch?v=abc',
                    }),
                    createBlock('html', { html: '<p style="margin:0">Raw</p>' }),
                    createBlock('text', {
                      text: '<a href="{{unsubscribe_url}}">Unsubscribe</a>',
                      fontSize: 12,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  )
}

/**
 * A two-column document, for cross-column move tests.
 *
 * @returns {import('../src/core/types.js').EmailDocument}
 */
export function twoColumnDocument() {
  return normalize(
    createDocument({
      sections: [
        createSection({
          rows: [
            createRow({
              children: [
                createColumn({ width: 50, blocks: [createBlock('text', { text: 'A' })] }),
                createColumn({ width: 50, blocks: [createBlock('text', { text: 'B' })] }),
              ],
            }),
          ],
        }),
      ],
    }),
  )
}

/**
 * @returns {string[]} fixture filenames
 */
export function fixtureNames() {
  return readdirSync(join(here, 'fixtures')).filter((name) => name.endsWith('.html'))
}

/**
 * @param {string} name
 * @returns {string}
 */
export function fixture(name) {
  return readFileSync(join(here, 'fixtures', name), 'utf8')
}

/**
 * Every block in a document, flattened.
 *
 * @param {import('../src/core/types.js').EmailDocument} doc
 * @returns {import('../src/core/types.js').Block[]}
 */
export function allBlocksIn(doc) {
  return doc.sections.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.blocks)))
}

/**
 * Visible text of a document, for the "import loses no content" assertion.
 *
 * @param {string} html
 * @returns {string}
 */
export function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[\u200b\u200c\u2060]/g, '')
    .replace(/\u034f/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
