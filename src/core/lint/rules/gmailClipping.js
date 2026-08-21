/**
 * Gmail clips a message at ~102KB and replaces the rest with a "View entire
 * message" link. Everything after the cut — including the unsubscribe footer and
 * any tracking pixel — is simply not there for most recipients.
 *
 * @module mailkiln/core/lint/rules/gmailClipping
 */

/** Gmail's documented clipping threshold, in bytes. */
export const GMAIL_LIMIT = 102400

/** Warn from 80% so there is room to add a paragraph before it breaks. */
export const WARN_AT = Math.round(GMAIL_LIMIT * 0.8)

/** @type {import('../../types.js').LintRule} */
export const gmailClippingRule = {
  id: 'gmail-clipping',
  level: 'error',
  title: 'Gmail message clipping',
  docs: 'Gmail truncates messages larger than 102KB.',
  check(ctx) {
    const bytes = byteLength(ctx.html)
    /**
     * @param {number} n
     * @returns {string}
     */
    const kb = (n) => `${(n / 1024).toFixed(1)}KB`

    if (bytes >= GMAIL_LIMIT) {
      return [
        {
          id: 'gmail-clipping',
          level: 'error',
          message: `Rendered HTML is ${kb(bytes)} — Gmail clips at ${kb(GMAIL_LIMIT)}.`,
          hint: 'Shorten copy, remove raw HTML blocks, or split into two emails. Anything past the cut (including your unsubscribe link) will not be shown.',
          data: { bytes, limit: GMAIL_LIMIT },
        },
      ]
    }
    if (bytes >= WARN_AT) {
      return [
        {
          id: 'gmail-clipping',
          level: 'warn',
          message: `Rendered HTML is ${kb(bytes)}, within 20% of Gmail's ${kb(GMAIL_LIMIT)} clipping limit.`,
          hint: 'There is not much headroom left for more content.',
          data: { bytes, limit: GMAIL_LIMIT },
        },
      ]
    }
    return []
  },
}

/**
 * UTF-8 byte length — what the limit is actually measured in.
 *
 * @param {string} value
 * @returns {number}
 */
export function byteLength(value) {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(value ?? '').length
  return Buffer.byteLength(value ?? '', 'utf8')
}
