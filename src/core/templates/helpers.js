/**
 * Shared builders for the starter templates.
 *
 * The templates are functions, not constants: each call mints fresh ids, so
 * picking the same template twice cannot produce a document with duplicate ids.
 *
 * @module mailkiln/core/templates/helpers
 */

import { createBlock, createColumn, createDocument, createRow, createSection, spacing } from '../schema.js'
import { normalize } from '../document.js'

/** @typedef {import('../types.js').EmailDocument} EmailDocument */
/** @typedef {import('../types.js').Block} Block */

/** Palette shared by the built-ins, chosen to clear WCAG AA against white. */
export const INK = '#111827'
export const MUTED = '#5b6472'
export const ACCENT = '#4f46e5'
export const HAIRLINE = '#e5e7eb'
export const WASH = '#f4f5f7'

/**
 * A section holding one full-width column of blocks.
 *
 * @param {Block[]} blocks
 * @param {Partial<import('../types.js').SectionProps>} [props]
 * @returns {import('../types.js').Section}
 */
export function stack(blocks, props = {}) {
  return createSection({
    props: { padding: spacing(0), ...props },
    rows: [createRow({ children: [createColumn({ width: 100, blocks })] })],
  })
}

/**
 * A section holding one row of side-by-side columns.
 *
 * @param {Block[][]} cells One array of blocks per column.
 * @param {object} [options]
 * @param {number[]} [options.widths]
 * @param {Partial<import('../types.js').SectionProps>} [options.props]
 * @param {import('../types.js').Spacing} [options.rowPadding]
 * @returns {import('../types.js').Section}
 */
export function columns(cells, options = {}) {
  const widths = options.widths ?? cells.map(() => Math.round(100 / cells.length))
  return createSection({
    props: { padding: spacing(0), ...options.props },
    rows: [
      createRow({
        props: { padding: options.rowPadding ?? spacing(0, 12), gap: 12, stackOnMobile: true },
        children: cells.map((blocks, index) => createColumn({ width: widths[index], blocks })),
      }),
    ],
  })
}

/**
 * The footer every template ends with.
 *
 * Marketing templates get an unsubscribe link and transactional ones a
 * preferences link — both satisfy the `unsubscribe` lint rule, and shipping a
 * starter template that trips our own linter would be indefensible.
 *
 * @param {object} [options]
 * @param {boolean} [options.transactional]
 * @param {string} [options.note] Extra sentence above the legal line.
 * @returns {import('../types.js').Section}
 */
export function footer(options = {}) {
  const link = options.transactional
    ? '<a href="{{preferences_url}}" style="color:#5b6472">Manage preferences</a>'
    : '<a href="{{unsubscribe_url}}" style="color:#5b6472">Unsubscribe</a>'
  const legal = options.transactional
    ? `You are receiving this because of activity on your account. ${link}.`
    : `You are receiving this because you subscribed. ${link} at any time.`

  return stack(
    [
      createBlock('divider', { color: HAIRLINE, padding: spacing(8, 24) }),
      createBlock('text', {
        text: [options.note, legal].filter(Boolean).join('<br />'),
        fontSize: 12,
        lineHeight: 1.6,
        color: MUTED,
        align: 'center',
        padding: spacing(4, 24, 28),
      }),
    ],
    { backgroundColor: WASH },
  )
}

/**
 * @param {object} init
 * @param {string} init.name What the template is called, as distinct from its subject.
 * @param {string} init.subject
 * @param {string} init.preheader
 * @param {import('../types.js').Section[]} init.sections
 * @returns {EmailDocument}
 */
export function build({ name, subject, preheader, sections }) {
  return normalize(
    createDocument({
      settings: { name, subject, preheader, textColor: INK, linkColor: ACCENT },
      sections,
    }),
  )
}
