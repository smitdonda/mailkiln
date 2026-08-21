/**
 * The built-in starter templates.
 *
 * Each is a plain function returning a normalized document — no images bundled,
 * no external assets, no ESP-specific markup. Image blocks are left with an empty
 * `src` on purpose: a placeholder URL would render as a broken image in the
 * consumer's inbox if they forgot to replace it, whereas an empty one shows a
 * "No image selected" prompt in the editor and nothing at all in the export.
 *
 * @module mailkiln/core/templates/builtin
 */

import { createBlock, spacing } from '../schema.js'
import { ACCENT, HAIRLINE, INK, MUTED, WASH, build, columns, footer, stack } from './helpers.js'

/**
 * @returns {import('../types.js').EmailDocument}
 */
export function welcomeTemplate() {
  return build({
    name: 'Welcome email',
    subject: 'Welcome to {{product.name}}',
    preheader: 'Here is how to get your first result today.',
    sections: [
      stack(
        [
          createBlock('text', {
            text: '{{product.name}}',
            fontSize: 15,
            fontWeight: 'bold',
            color: INK,
            align: 'center',
            padding: spacing(28, 24, 0),
          }),
        ],
        { backgroundColor: WASH },
      ),
      stack(
        [
          createBlock('heading', {
            text: 'Welcome aboard, {{user.name}}',
            level: 1,
            fontSize: 30,
            lineHeight: 1.25,
            align: 'center',
            padding: spacing(28, 24, 8),
          }),
          createBlock('text', {
            text: 'Your workspace is ready. Most people get their first result within ten minutes — here is the shortest path.',
            fontSize: 16,
            color: MUTED,
            align: 'center',
            padding: spacing(0, 32, 20),
          }),
          createBlock('button', {
            text: 'Open your workspace',
            href: 'https://example.com/app',
            padding: spacing(0, 24, 28),
          }),
        ],
        { backgroundColor: WASH },
      ),
      stack([createBlock('divider', { color: HAIRLINE, padding: spacing(24, 24, 8) })]),
      columns(
        [
          [
            createBlock('heading', {
              text: '1. Invite your team',
              level: 3,
              fontSize: 17,
              padding: spacing(8, 12, 4),
            }),
            createBlock('text', {
              text: 'Drafts sitting in one person’s inbox are how work stalls.',
              fontSize: 14,
              color: MUTED,
              padding: spacing(0, 12, 16),
            }),
          ],
          [
            createBlock('heading', {
              text: '2. Connect your data',
              level: 3,
              fontSize: 17,
              padding: spacing(8, 12, 4),
            }),
            createBlock('text', {
              text: 'Two minutes now saves the copy-paste later.',
              fontSize: 14,
              color: MUTED,
              padding: spacing(0, 12, 16),
            }),
          ],
        ],
        { rowPadding: spacing(0, 12) },
      ),
      stack([
        createBlock('text', {
          text: 'Stuck on anything? Reply to this email — a person reads it.',
          fontSize: 14,
          color: MUTED,
          align: 'center',
          padding: spacing(8, 24, 24),
        }),
      ]),
      footer(),
    ],
  })
}

/**
 * @returns {import('../types.js').EmailDocument}
 */
export function receiptTemplate() {
  return build({
    name: 'Order receipt',
    subject: 'Your receipt for order {{order.id}}',
    preheader: 'Paid in full — no action needed.',
    sections: [
      stack([
        createBlock('heading', {
          text: 'Receipt',
          level: 1,
          fontSize: 26,
          padding: spacing(32, 24, 4),
        }),
        createBlock('text', {
          text: 'Thanks, {{user.name}}. Order <b>{{order.id}}</b> is paid in full and on its way.',
          fontSize: 15,
          color: MUTED,
          padding: spacing(0, 24, 20),
        }),
      ]),
      columns(
        [
          [
            createBlock('text', {
              text: '{{order.items[0].title}}',
              fontSize: 15,
              padding: spacing(10, 12),
            }),
          ],
          [
            createBlock('text', {
              text: '{{order.items[0].price}}',
              fontSize: 15,
              align: 'right',
              padding: spacing(10, 12),
            }),
          ],
        ],
        { widths: [70, 30], rowPadding: spacing(0, 12) },
      ),
      stack([createBlock('divider', { color: HAIRLINE, padding: spacing(4, 24) })]),
      columns(
        [
          [
            createBlock('text', {
              text: '<b>Total</b>',
              fontSize: 15,
              padding: spacing(10, 12),
            }),
          ],
          [
            createBlock('text', {
              text: '<b>{{order.total}}</b>',
              fontSize: 15,
              align: 'right',
              padding: spacing(10, 12),
            }),
          ],
        ],
        { widths: [70, 30], rowPadding: spacing(0, 12) },
      ),
      stack([
        createBlock('button', {
          text: 'View your order',
          href: 'https://example.com/orders/{{order.id}}',
          buttonColor: ACCENT,
          padding: spacing(20, 24, 28),
        }),
      ]),
      footer({
        transactional: true,
        note: 'Keep this receipt for your records.',
      }),
    ],
  })
}

/**
 * @returns {import('../types.js').EmailDocument}
 */
export function newsletterTemplate() {
  return build({
    name: 'Newsletter issue',
    subject: '{{issue.title}}',
    preheader: 'Three things worth your time this week.',
    sections: [
      stack(
        [
          createBlock('text', {
            text: '{{issue.name}} · Issue {{issue.number}}',
            fontSize: 12,
            letterSpacing: '0.08em',
            color: MUTED,
            align: 'center',
            padding: spacing(24, 24, 0),
          }),
          createBlock('heading', {
            text: '{{issue.title}}',
            level: 1,
            fontSize: 28,
            lineHeight: 1.25,
            align: 'center',
            padding: spacing(8, 32, 24),
          }),
        ],
        { backgroundColor: WASH },
      ),
      stack([
        createBlock('image', {
          src: '',
          alt: 'This week’s lead illustration',
          width: 552,
          padding: spacing(24, 24, 16),
        }),
        createBlock('text', {
          text: 'A short standfirst that tells the reader why this issue is worth the next two minutes.',
          fontSize: 16,
          lineHeight: 1.65,
          padding: spacing(0, 24, 8),
        }),
      ]),
      stack([createBlock('divider', { color: HAIRLINE, padding: spacing(16, 24) })]),
      columns([
        [
          createBlock('heading', {
            text: 'The first story',
            level: 3,
            fontSize: 18,
            padding: spacing(0, 12, 4),
          }),
          createBlock('text', {
            text: 'Two sentences of summary, then a link. Long newsletters get skimmed; short ones get read.',
            fontSize: 14,
            color: MUTED,
            padding: spacing(0, 12, 16),
          }),
        ],
        [
          createBlock('heading', {
            text: 'The second story',
            level: 3,
            fontSize: 18,
            padding: spacing(0, 12, 4),
          }),
          createBlock('text', {
            text: 'Keep the same shape for every item so readers learn where to look.',
            fontSize: 14,
            color: MUTED,
            padding: spacing(0, 12, 16),
          }),
        ],
      ]),
      stack([
        createBlock('button', {
          text: 'Read the full issue',
          href: 'https://example.com/issues/{{issue.number}}',
          buttonColor: ACCENT,
          padding: spacing(12, 24, 24),
        }),
        createBlock('social', { padding: spacing(0, 24, 8) }),
      ]),
      footer(),
    ],
  })
}

/**
 * @returns {import('../types.js').EmailDocument}
 */
export function passwordResetTemplate() {
  return build({
    name: 'Password reset',
    subject: 'Reset your password',
    preheader: 'The link expires in 60 minutes.',
    sections: [
      stack([
        createBlock('heading', {
          text: 'Reset your password',
          level: 1,
          fontSize: 24,
          align: 'center',
          padding: spacing(36, 24, 8),
        }),
        createBlock('text', {
          text: 'Hi {{user.name}}, use the button below to choose a new password. The link expires in 60 minutes.',
          fontSize: 15,
          lineHeight: 1.65,
          color: MUTED,
          align: 'center',
          padding: spacing(0, 32, 20),
        }),
        createBlock('button', {
          text: 'Choose a new password',
          href: '{{reset_url}}',
          buttonColor: ACCENT,
          padding: spacing(0, 24, 24),
        }),
        createBlock('text', {
          text: 'If you did not ask for this, you can ignore this email — your password will not change.',
          fontSize: 13,
          color: MUTED,
          align: 'center',
          padding: spacing(0, 32, 28),
        }),
      ]),
      footer({ transactional: true }),
    ],
  })
}
