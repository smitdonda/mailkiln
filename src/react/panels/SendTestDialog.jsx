/**
 * Send a test email.
 *
 * mailkiln does not send anything: it has no backend, no account and no ESP
 * integration, and adding one would undo the "self-hosted, works offline" promise.
 * What it does is render the message and hand it to the consumer's `onSendTest`
 * handler — the same shape as `onImageUpload`. Your app owns the transport.
 *
 * The dialog surfaces lint errors before sending, because a test send is the last
 * moment where "no unsubscribe link" is cheap to fix.
 *
 * @module mailkiln/react/panels/SendTestDialog
 */

import { useMemo, useState } from 'react'
import { renderToHtml, renderToText } from '../../core/index.js'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { IconAlert, IconCheckCircle, IconSend } from '../icons.jsx'

/**
 * What `onSendTest` receives. The rendered message, ready to hand to any
 * transport — plus the document, for consumers that would rather send their own
 * rendering or store the test alongside it.
 *
 * @typedef {object} SendTestPayload
 * @property {string[]} to Validated, de-duplicated recipients.
 * @property {string} subject
 * @property {string} html
 * @property {string} text
 * @property {import('../../core/types.js').EmailDocument} document
 */

/** Deliberately permissive: rejecting valid-but-unusual addresses is worse. */
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

/**
 * Split a recipient string on commas, semicolons, spaces and newlines.
 *
 * @param {string} value
 * @returns {{ valid: string[], invalid: string[] }}
 */
export function parseRecipients(value) {
  /** @type {string[]} */
  const valid = []
  /** @type {string[]} */
  const invalid = []
  for (const part of String(value ?? '').split(/[\s,;]+/)) {
    const candidate = part.trim()
    if (!candidate) continue
    if (EMAIL.test(candidate)) {
      if (!valid.includes(candidate)) valid.push(candidate)
    } else {
      invalid.push(candidate)
    }
  }
  return { valid, invalid }
}

/**
 * @param {object} props
 * @param {() => void} props.onClose
 * @returns {import('react').ReactElement}
 */
export function SendTestDialog({ onClose }) {
  const t = useI18n()
  const { store, onSendTest } = useMailKilnContext()
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState(
    () => `[Test] ${store.doc.settings.subject || 'Untitled email'}`,
  )
  const [status, setStatus] = useState(/** @type {'idle' | 'sending' | 'sent' | 'error'} */ ('idle'))
  const [error, setError] = useState('')

  const recipients = useMemo(() => parseRecipients(to), [to])
  const { errors } = store.lint
  const canSend = recipients.valid.length > 0 && status !== 'sending'

  const send = async () => {
    if (!onSendTest || !canSend) return
    setStatus('sending')
    setError('')
    try {
      await onSendTest({
        to: recipients.valid,
        subject,
        html: renderToHtml(store.doc, { vars: store.vars }),
        text: renderToText(store.doc, { vars: store.vars }),
        document: store.doc,
      })
      setStatus('sent')
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div className="mk-overlay" role="presentation" onClick={onClose}>
      <div
        className="mk-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('sendTest.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{t('sendTest.title')}</h2>
        <p className="mk-help">{t('sendTest.hint')}</p>

        <div className="mk-field">
          <label className="mk-label" htmlFor="mk-send-to">
            {t('sendTest.to')}
          </label>
          <input
            id="mk-send-to"
            className="mk-input"
            type="text"
            autoFocus
            value={to}
            placeholder="you@example.com, qa@example.com"
            onChange={(event) => {
              setTo(event.target.value)
              setStatus('idle')
            }}
          />
          {recipients.invalid.length ? (
            <span className="mk-help" style={{ color: 'var(--mk-danger)' }}>
              {t('sendTest.invalid', { list: recipients.invalid.join(', ') })}
            </span>
          ) : null}
        </div>

        <div className="mk-field">
          <label className="mk-label" htmlFor="mk-send-subject">
            {t('sendTest.subject')}
          </label>
          <input
            id="mk-send-subject"
            className="mk-input"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>

        {errors > 0 ? (
          <p className="mk-note" data-level="error">
            <IconAlert />
            {t('sendTest.lintWarning', { count: errors })}
          </p>
        ) : null}

        {status === 'sent' ? (
          <p className="mk-note" data-level="ok">
            <IconCheckCircle />
            {t('sendTest.sent', { count: recipients.valid.length })}
          </p>
        ) : null}

        {status === 'error' ? (
          <p className="mk-note" data-level="error">
            <IconAlert />
            {t('sendTest.failed', { message: error })}
          </p>
        ) : null}

        <div className="mk-dialog-actions">
          <button type="button" className="mk-btn" onClick={onClose}>
            {status === 'sent' ? t('sendTest.done') : t('import.cancel')}
          </button>
          <button
            type="button"
            className="mk-btn mk-btn-primary"
            disabled={!canSend}
            onClick={send}
          >
            <IconSend />
            {status === 'sending' ? t('sendTest.sending') : t('sendTest.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
