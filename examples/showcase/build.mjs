/**
 * Builds one realistic email with the headless API and writes every export
 * format to `out/`, then prints the lint report.
 *
 * Run: node examples/showcase/build.mjs
 *
 * This is an example, not library code — it uses the same public API a consumer
 * would (`mailkiln/core`), imported here from source.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createBlock,
  createColumn,
  createDocument,
  createRow,
  createSection,
  defineVars,
  documentName,
  exportDocument,
  exportFilenames,
  lintDocument,
  normalize,
  spacing,
} from '../../src/core/index.js'

const out = join(dirname(fileURLToPath(import.meta.url)), 'out')

// --- palette ---------------------------------------------------------------

const INK = '#0f172a'
const BODY = '#475569'
// #7c879b was the first choice and the linter rejected it: 3.33:1 against the
// tinted band, below the 4.5:1 minimum. This is the palette the checks accept.
const MUTED = '#5c6779'
const ACCENT = '#4f46e5'
const WASH = '#f4f5fb'
const LINE = '#e6e8f0'

/**
 * A tiny inline mark, so this file renders standalone with no network.
 *
 * Real templates should use a hosted PNG or JPEG: Gmail strips data URIs, and
 * mailkiln's own linter flags SVG as unsupported. This is a showcase artefact,
 * not a pattern to copy.
 *
 * @type {string}
 */
const MARK =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="24" fill="#4f46e5"/>
      <path d="M22 34h52v28a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6z" fill="none" stroke="#fff" stroke-width="5"/>
      <path d="M23 36l22 16a6 6 0 0 0 7 0l21-16" fill="none" stroke="#fff" stroke-width="5"/>
    </svg>`,
  ).toString('base64')

// --- helpers ---------------------------------------------------------------

/**
 * @param {import('../../src/core/types.js').Block[]} blocks
 * @param {Record<string, any>} [props]
 * @returns {import('../../src/core/types.js').Section}
 */
const band = (blocks, props = {}) =>
  createSection({
    props: { padding: spacing(0), ...props },
    rows: [createRow({ children: [createColumn({ width: 100, blocks })] })],
  })

/**
 * @param {import('../../src/core/types.js').Block[][]} cells
 * @param {object} [options]
 * @param {number[]} [options.widths]
 * @param {Record<string, any>} [options.props]
 * @returns {import('../../src/core/types.js').Section}
 */
const grid = (cells, options = {}) =>
  createSection({
    props: { padding: spacing(0), ...options.props },
    rows: [
      createRow({
        props: { padding: spacing(0, 16), gap: 16, stackOnMobile: true },
        children: cells.map((blocks, index) =>
          createColumn({ width: options.widths?.[index] ?? Math.round(100 / cells.length), blocks }),
        ),
      }),
    ],
  })

/**
 * @param {string} value
 * @param {number} size
 * @param {Record<string, any>} [extra]
 * @returns {import('../../src/core/types.js').Block}
 */
const stat = (value, size, extra = {}) =>
  createBlock('heading', {
    text: value,
    level: 3,
    fontSize: size,
    lineHeight: 1.1,
    color: ACCENT,
    align: 'center',
    padding: spacing(0, 8, 2),
    ...extra,
  })

// --- the email -------------------------------------------------------------

const vars = defineVars({
  sample: {
    user: { name: 'Smit', firstName: 'Smit' },
    product: { name: 'Northwind' },
    stats: { saved: '11h', teams: '2,400', uptime: '99.98%' },
    unsubscribe_url: 'https://northwind.example/unsubscribe?u=abc123',
    preferences_url: 'https://northwind.example/preferences',
  },
})

const doc = normalize(
  createDocument({
    settings: {
      name: 'Northwind 2.0 launch',
      subject: '{{product.name}} 2.0 is here',
      preheader: 'Faster search, shared drafts, and a real audit log.',
      width: 600,
      backgroundColor: '#eceef6',
      contentBackgroundColor: '#ffffff',
      textColor: INK,
      linkColor: ACCENT,
    },
    sections: [
      // masthead
      band(
        [
          createBlock('image', {
            src: MARK,
            alt: '{{product.name}}',
            width: 44,
            align: 'center',
            padding: spacing(28, 24, 10),
          }),
          createBlock('text', {
            text: '{{product.name}}',
            fontSize: 13,
            fontWeight: 'bold',
            letterSpacing: '0.14em',
            color: MUTED,
            align: 'center',
            padding: spacing(0, 24, 26),
          }),
        ],
        { backgroundColor: WASH, borderBottom: `1px solid ${LINE}` },
      ),

      // hero
      band([
        createBlock('text', {
          text: 'PRODUCT UPDATE · JULY',
          fontSize: 12,
          fontWeight: 'bold',
          letterSpacing: '0.12em',
          color: ACCENT,
          align: 'center',
          padding: spacing(38, 24, 10),
        }),
        createBlock('heading', {
          text: '{{product.name}} 2.0 is here',
          level: 1,
          fontSize: 36,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          align: 'center',
          padding: spacing(0, 32, 14),
        }),
        createBlock('text', {
          text: 'Hi {{user.firstName}} — we rebuilt the parts you use every day. Search is instant, drafts are shared, and every change is on the record.',
          fontSize: 17,
          lineHeight: 1.6,
          color: BODY,
          align: 'center',
          padding: spacing(0, 40, 26),
        }),
        createBlock('button', {
          text: 'See what changed',
          href: 'https://northwind.example/changelog/2-0',
          buttonColor: ACCENT,
          fontSize: 16,
          paddingX: 34,
          paddingY: 15,
          borderRadius: 8,
          padding: spacing(0, 24, 12),
        }),
        createBlock('text', {
          text: 'Already in your workspace — nothing to install.',
          fontSize: 13,
          color: MUTED,
          align: 'center',
          padding: spacing(0, 24, 36),
        }),
      ]),

      // stats
      grid(
        [
          [
            stat('{{stats.saved}}', 30),
            createBlock('text', {
              text: 'saved per person, per week',
              fontSize: 13,
              color: MUTED,
              align: 'center',
              padding: spacing(0, 8, 0),
            }),
          ],
          [
            stat('{{stats.teams}}', 30),
            createBlock('text', {
              text: 'teams already switched',
              fontSize: 13,
              color: MUTED,
              align: 'center',
              padding: spacing(0, 8, 0),
            }),
          ],
          [
            stat('{{stats.uptime}}', 30),
            createBlock('text', {
              text: 'uptime last quarter',
              fontSize: 13,
              color: MUTED,
              align: 'center',
              padding: spacing(0, 8, 0),
            }),
          ],
        ],
        { props: { backgroundColor: WASH, padding: spacing(28, 8) } },
      ),

      // features, two-up
      band([
        createBlock('spacer', { height: 36 }),
        createBlock('heading', {
          text: 'Three things worth two minutes',
          level: 2,
          fontSize: 23,
          letterSpacing: '-0.01em',
          align: 'center',
          padding: spacing(0, 24, 22),
        }),
      ]),
      grid([
        [
          createBlock('heading', {
            text: 'Instant search',
            level: 3,
            fontSize: 17,
            padding: spacing(0, 8, 6),
          }),
          createBlock('text', {
            text: 'Results as you type, across every draft and comment. No more waiting on a spinner to find last month’s copy.',
            fontSize: 14.5,
            lineHeight: 1.65,
            color: BODY,
            padding: spacing(0, 8, 20),
          }),
        ],
        [
          createBlock('heading', {
            text: 'Shared drafts',
            level: 3,
            fontSize: 17,
            padding: spacing(0, 8, 6),
          }),
          createBlock('text', {
            text: 'Hand a draft to a teammate without exporting anything. They pick it up where you left it.',
            fontSize: 14.5,
            lineHeight: 1.65,
            color: BODY,
            padding: spacing(0, 8, 20),
          }),
        ],
      ]),
      band([
        createBlock('divider', { color: LINE, padding: spacing(6, 24, 24) }),
      ]),

      // quote
      band(
        [
          createBlock('text', {
            text: '“We cut our review cycle from four days to one. The audit log alone paid for the year.”',
            fontSize: 18,
            lineHeight: 1.55,
            color: INK,
            align: 'center',
            padding: spacing(30, 40, 12),
          }),
          createBlock('text', {
            text: '<b>Priya Raman</b> · Head of Lifecycle, Fable',
            fontSize: 13,
            color: MUTED,
            align: 'center',
            padding: spacing(0, 24, 32),
          }),
        ],
        { backgroundColor: WASH },
      ),

      // closing CTA
      band([
        createBlock('heading', {
          text: 'Take it for a spin',
          level: 2,
          fontSize: 22,
          align: 'center',
          padding: spacing(34, 24, 10),
        }),
        createBlock('text', {
          text: 'Open your workspace and the new search is already in the sidebar.',
          fontSize: 15,
          lineHeight: 1.6,
          color: BODY,
          align: 'center',
          padding: spacing(0, 40, 22),
        }),
        createBlock('button', {
          text: 'Open {{product.name}}',
          href: 'https://northwind.example/app',
          buttonColor: INK,
          fontSize: 15,
          paddingX: 30,
          paddingY: 14,
          borderRadius: 8,
          padding: spacing(0, 24, 38),
        }),
      ]),

      // footer
      band(
        [
          createBlock('social', {
            links: [
              { network: 'x', label: 'X', url: 'https://x.com/northwind', iconUrl: '' },
              { network: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/company/northwind', iconUrl: '' },
              { network: 'github', label: 'GitHub', url: 'https://github.com/northwind', iconUrl: '' },
            ],
            color: MUTED,
            fontSize: 12.5,
            gap: 14,
            padding: spacing(26, 24, 10),
          }),
          createBlock('text', {
            text: 'Northwind Ltd · 40 Rue Faubourg, 75008 Paris',
            fontSize: 12,
            color: MUTED,
            align: 'center',
            padding: spacing(0, 24, 4),
          }),
          createBlock('text', {
            text:
              'You are receiving this because you have a {{product.name}} account. ' +
              '<a href="{{preferences_url}}" style="color:#5c6779">Manage preferences</a> or ' +
              '<a href="{{unsubscribe_url}}" style="color:#5c6779">unsubscribe</a>.',
            fontSize: 12,
            lineHeight: 1.6,
            color: MUTED,
            align: 'center',
            padding: spacing(0, 32, 30),
          }),
        ],
        { backgroundColor: WASH, borderTop: `1px solid ${LINE}` },
      ),
    ],
  }),
)

// --- write every format ----------------------------------------------------

mkdirSync(out, { recursive: true })

const name = documentName(doc)
const bundle = exportDocument(doc, { vars, name })
const files = exportFilenames(name)

for (const [format, source] of Object.entries(bundle)) {
  writeFileSync(join(out, files[format]), source, 'utf8')
}

// --- report ----------------------------------------------------------------

const lint = lintDocument(doc, { vars })
const blocks = doc.sections
  .flatMap((section) => section.rows)
  .flatMap((row) => row.columns)
  .flatMap((column) => column.blocks)

console.log(`\n  ${name}`)
console.log(`  ${'─'.repeat(46)}`)
console.log(`  sections   ${doc.sections.length}`)
console.log(`  blocks     ${blocks.length}  (${[...new Set(blocks.map((b) => b.type))].join(', ')})`)
console.log(`  html       ${(lint.sizeBytes / 1024).toFixed(1)}KB  (Gmail clips at 100KB)`)
console.log(`  jsx        ${bundle.jsx.split('\n').length} lines`)
console.log(`  text       ${bundle.text.split('\n').filter(Boolean).length} lines`)
console.log(`\n  checks     ${lint.errors} errors · ${lint.warnings} warnings · ${lint.infos} notes`)
for (const issue of lint.issues) {
  console.log(`   ${issue.level.padEnd(5)} ${issue.id.padEnd(14)} ${issue.message}`)
}
console.log(`\n  written to examples/showcase/out/`)
for (const filename of Object.values(files)) console.log(`   ${filename}`)
console.log()
