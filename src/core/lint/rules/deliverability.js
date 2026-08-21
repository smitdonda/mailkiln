/**
 * The rules that decide whether the message reaches the inbox at all: a plain
 * text alternative, a preheader, an unsubscribe link, and subject-line phrasing.
 *
 * @module mailkiln/core/lint/rules/deliverability
 */

import { eachBlock } from '../walk.js'

/**
 * A deliberately short, curated list. These are the phrases that actually move
 * spam scores; a long list would produce noise and get ignored, which is worse
 * than no rule at all. `warn` only — some of these are legitimate in context.
 */
export const SPAM_PHRASES = [
  'act now',
  'apply now',
  'buy direct',
  'cash bonus',
  'click here',
  'congratulations',
  'double your',
  'earn extra cash',
  'for free',
  'free access',
  'free gift',
  'guaranteed',
  'limited time only',
  'make money',
  'no credit check',
  'no obligation',
  'risk free',
  'satisfaction guaranteed',
  'this is not spam',
  'urgent',
  'winner',
  'you have been selected',
]

/** @type {import('../../types.js').LintRule} */
export const plainTextRule = {
  id: 'plain-text',
  level: 'warn',
  title: 'Plain-text alternative',
  docs: 'HTML-only messages score worse with every major filter.',
  check(ctx) {
    const text = (ctx.text ?? '').trim()
    if (text.length >= 40) return []
    return [
      {
        id: 'plain-text',
        level: 'warn',
        message:
          text.length === 0
            ? 'This template renders no plain text at all.'
            : `The plain-text version is only ${text.length} characters.`,
        hint: 'Send the text/plain part alongside the HTML — every serious filter checks for it. Blocks without text renderers (images, raw HTML) contribute nothing.',
        data: { length: text.length },
      },
    ]
  },
}

/** @type {import('../../types.js').LintRule} */
export const preheaderRule = {
  id: 'preheader',
  level: 'warn',
  title: 'Preheader text',
  docs: 'The inbox preview line after the subject.',
  check(ctx) {
    const preheader = String(ctx.doc.settings?.preheader ?? '').trim()
    if (!preheader) {
      return [
        {
          id: 'preheader',
          level: 'warn',
          message: 'No preheader set.',
          hint: 'Without one, the inbox shows the first words of your email body — usually "View in browser".',
        },
      ]
    }
    if (preheader.length > 140) {
      return [
        {
          id: 'preheader',
          level: 'info',
          message: `Preheader is ${preheader.length} characters — most clients show 40–100.`,
          hint: 'Front-load the meaningful part.',
        },
      ]
    }
    return []
  },
}

/** @type {import('../../types.js').LintRule} */
export const unsubscribeRule = {
  id: 'unsubscribe',
  level: 'error',
  title: 'Unsubscribe link',
  docs: 'Required by CAN-SPAM, GDPR and both Gmail and Yahoo bulk-sender rules.',
  check(ctx) {
    const haystack = `${ctx.html} ${ctx.text}`.toLowerCase()
    if (/unsubscribe|opt.?out|manage (your )?(email )?preferences|{{\s*unsubscribe/i.test(haystack)) {
      return []
    }
    return [
      {
        id: 'unsubscribe',
        level: 'error',
        message: 'No unsubscribe link found.',
        hint: 'Add one — it is a legal requirement for commercial mail in the US and EU, and Gmail/Yahoo require it for bulk senders. A {{unsubscribe_url}} merge variable counts.',
      },
    ]
  },
}

/** @type {import('../../types.js').LintRule} */
export const spamPhrasesRule = {
  id: 'spam-phrases',
  level: 'warn',
  title: 'Spam-trigger phrases',
  docs: 'Curated list; every hit is a judgement call, not a verdict.',
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    const settings = ctx.doc.settings ?? {}

    for (const [field, value] of [
      ['subject', settings.subject],
      ['preheader', settings.preheader],
    ]) {
      const haystack = String(value ?? '').toLowerCase()
      if (!haystack) continue
      for (const phrase of SPAM_PHRASES) {
        if (!haystack.includes(phrase)) continue
        issues.push({
          id: 'spam-phrases',
          level: 'warn',
          message: `The ${field} contains "${phrase}".`,
          hint: 'Filters weight subject and preheader most heavily. Rephrase if you can; ignore this if the phrase is genuinely what you mean.',
          data: { field, phrase },
        })
      }
    }

    const allCaps = String(settings.subject ?? '')
    if (allCaps.length > 8 && allCaps === allCaps.toUpperCase() && /[A-Z]{4,}/.test(allCaps)) {
      issues.push({
        id: 'spam-phrases',
        level: 'warn',
        message: 'The subject line is in all caps.',
        hint: 'Reliably read as shouting by both filters and people.',
      })
    }
    const exclamations = (String(settings.subject ?? '').match(/!/g) ?? []).length
    if (exclamations > 1) {
      issues.push({
        id: 'spam-phrases',
        level: 'warn',
        message: `The subject line has ${exclamations} exclamation marks.`,
        hint: 'More than one is a common spam signal.',
      })
    }

    return issues
  },
}

/** @type {import('../../types.js').LintRule} */
export const fontSizeRule = {
  id: 'font-size',
  level: 'warn',
  title: 'Minimum font size',
  docs: 'iOS Mail auto-zooms text below 12px, breaking fixed-width layouts.',
  check(ctx) {
    /** @type {import('../../types.js').LintIssue[]} */
    const issues = []
    for (const { block } of eachBlock(ctx.doc)) {
      const size = Number(block.props?.fontSize)
      if (!Number.isFinite(size) || size <= 0) continue
      if (size < 12) {
        issues.push({
          id: 'font-size',
          level: 'warn',
          message: `Font size is ${size}px.`,
          hint: 'iOS Mail scales text under 12px up automatically, which shifts everything around it. 14px is a safe floor for body copy.',
          nodeId: block.id,
          data: { size },
        })
      }
    }
    return issues
  },
}
