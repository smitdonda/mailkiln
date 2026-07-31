/**
 * Guard for the *published* types.
 *
 * mailforge ships `.d.ts` files generated from JSDoc. Those declarations are the
 * only thing a consumer's editor ever sees, so they get their own check: this
 * file imports the built package the way a consumer does and is type-checked
 * under `strict` against `dist/`. If the generated declarations degrade into
 * `any`, the `@ts-expect-error` assertions below stop erroring and this fails.
 *
 * Deliberately written in JavaScript, not TypeScript — the repo has no `.ts`
 * source, and `checkJs` validates it just as strictly.
 *
 * Run with: npm run verify:types (after npm run build)
 */

import {
  MailForge,
  createBlock,
  createDocument,
  defineBlock,
  defineVars,
  exportDocument,
  findNode,
  insertBlock,
  moveBlock,
  normalize,
  spacing,
} from 'mailforge'
import { lintDocument, renderToJsx, renderToTsx, importFromHtml } from 'mailforge/core'

// --- documents -------------------------------------------------------------

const doc = normalize(createDocument({ settings: { subject: 'Hello' } }))

/** @type {number} */
const width = doc.settings.width

/** @type {string} */
const firstSectionId = doc.sections[0].id

// @ts-expect-error - `sections` is a Section[], not a string
const badSections = doc.sections.toUpperCase()

// @ts-expect-error - `width` is a number
const badWidth = doc.settings.width.toUpperCase()

// --- the discriminated NodeLocation ---------------------------------------

const found = findNode(doc, firstSectionId)
if (found?.kind === 'column') {
  // Narrowing must work, or every consumer has to cast.
  /** @type {number} */
  const columnWidth = found.node.props.width
  void columnWidth
}
if (found?.kind === 'block') {
  /** @type {string} */
  const blockType = found.node.type
  void blockType
  // @ts-expect-error - a Block has no `rows`
  void found.node.rows
}

// --- pure ops --------------------------------------------------------------

const columnId = doc.sections[0].rows[0].columns[0].id
const withBlock = insertBlock(doc, { columnId, type: 'text', props: { text: 'hi' } })
const moved = moveBlock(withBlock, { blockId: 'blk_1', toColumnId: columnId, toIndex: 0 })

// @ts-expect-error - `toColumnId` is required
moveBlock(withBlock, { blockId: 'blk_1' })

// --- merge variables ------------------------------------------------------

const vars = defineVars({ sample: { user: { name: 'Smit' } } })

/** @type {boolean} */
const hasPath = vars.has('user.name')

// @ts-expect-error - defineVars takes an options object, not a bare sample
defineVars({ user: { name: 'Smit' } })

// --- export ---------------------------------------------------------------

const bundle = exportDocument(moved, { vars, name: 'Welcome' })

/** @type {string} */
const jsxSource = bundle.jsx

/** @type {string} */
const tsxSource = bundle.tsx

// @ts-expect-error - there is no `vue` output
void bundle.vue

/** @type {string} */
const alsoJsx = renderToJsx(moved, { vars, lang: 'tsx' })

// @ts-expect-error - `lang` only accepts 'jsx' | 'tsx'
renderToJsx(moved, { lang: 'vue' })

void renderToTsx(moved)

// --- lint -----------------------------------------------------------------

const result = lintDocument(moved, { vars })

/** @type {number} */
const errorCount = result.errors

/** @type {string} */
const firstMessage = result.issues[0].message

// @ts-expect-error - `level` is a union of three strings
const badLevel = result.issues[0].level === 'critical'

// --- import ---------------------------------------------------------------

const report = importFromHtml('<table><tr><td>hi</td></tr></table>')

/** @type {number} */
const confidence = report.confidence

/** @type {string[]} */
const unrecognized = report.unrecognized

// --- custom blocks --------------------------------------------------------

const countdown = defineBlock({
  type: 'countdown',
  label: 'Countdown',
  defaultProps: { endsAt: '' },
  schema: [{ key: 'endsAt', type: 'text', label: 'Ends at' }],
  render: {
    html(props, ctx) {
      return `<div>${ctx.resolve(String(props.endsAt))}</div>`
    },
  },
})

// @ts-expect-error - `render.html` is required
defineBlock({ type: 'broken', label: 'Broken', defaultProps: {}, render: {} })

void createBlock('countdown')
void spacing(8, 16)
void [width, badSections, badWidth, hasPath, jsxSource, tsxSource, alsoJsx, errorCount, firstMessage, badLevel, confidence, unrecognized, countdown]

// --- the React entry ------------------------------------------------------

/** @type {import('react').ReactElement} */
const editor = MailForge({ defaultValue: doc, vars, theme: { accent: '#6366f1' } })
void editor

// @ts-expect-error - `appearance` only accepts 'light' | 'dark' | 'auto'
MailForge({ appearance: 'sepia' })
