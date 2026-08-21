/**
 * Image field: upload through the consumer's `onImageUpload` hook, or paste a URL.
 *
 * mailkiln never uploads anything itself — there is no storage story it could
 * pick that would be right for everyone. The URL input is always available, so the
 * field is fully usable even with no upload hook wired up.
 *
 * @module mailkiln/react/fields/ImageField
 */

import { useRef, useState } from 'react'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { IconUpload } from '../icons.jsx'

/**
 * @param {object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.id]
 * @returns {import('react').ReactElement}
 */
export function ImageField({ value, onChange, id }) {
  const t = useI18n()
  const { onImageUpload } = useMailKilnContext()
  const fileRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(/** @type {string | null} */ (null))

  /**
   * @param {File | undefined} file
   */
  const upload = async (file) => {
    if (!file || !onImageUpload) return
    setBusy(true)
    setError(null)
    try {
      const url = await onImageUpload(file)
      if (url) onChange(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mk-field">
      {value ? (
        <img
          src={value}
          alt=""
          style={{
            display: 'block',
            width: '100%',
            maxHeight: 120,
            objectFit: 'contain',
            border: '1px solid var(--mk-border)',
            borderRadius: 6,
            background: 'var(--mk-bg-sunken)',
          }}
        />
      ) : null}

      {onImageUpload ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="mk-sr-only"
            onChange={(event) => upload(event.target.files?.[0])}
          />
          <button
            type="button"
            className="mk-btn mk-btn-outline"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <IconUpload />
            {busy ? t('field.uploading') : t('field.upload')}
          </button>
        </>
      ) : null}

      <input
        id={id}
        className="mk-input"
        type="url"
        value={value ?? ''}
        placeholder={t('field.url')}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="mk-help" style={{ color: 'var(--mk-danger)' }}>{error}</span> : null}
    </div>
  )
}
