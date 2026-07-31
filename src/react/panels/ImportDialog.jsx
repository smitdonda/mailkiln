/**
 * Import dialog — pillar 2's front door.
 *
 * Analyse first, then confirm. The report is shown *before* anything is replaced,
 * because "9 of 11 blocks are editable, 2 kept as raw HTML" is a decision the user
 * should get to make rather than discover.
 *
 * @module mailforge/react/panels/ImportDialog
 */

import { useRef, useState } from 'react'
import { importFromHtml } from '../../core/index.js'
import { useI18n } from '../i18n/index.jsx'
import { useMailForgeContext } from '../context.jsx'

/**
 * @param {object} props
 * @param {() => void} props.onClose
 * @returns {import('react').ReactElement}
 */
export function ImportDialog({ onClose }) {
  const t = useI18n()
  const { store } = useMailForgeContext()
  const [html, setHtml] = useState('')
  const [report, setReport] = useState(/** @type {import('../../core/types.js').ImportReport | null} */ (null))
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [dragging, setDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const dropRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))

  const analyse = () => {
    setError(null)
    setReport(null)
    try {
      setReport(importFromHtml(html))
    } catch (cause) {
      setError(t('import.failed', { message: cause instanceof Error ? cause.message : String(cause) }))
    }
  }

  const confirm = () => {
    if (!report) return
    // A dropped file already carries a name the user chose; inheriting it beats
    // leaving the import "Untitled email".
    const document =
      filename && !report.document.settings.name
        ? { ...report.document, settings: { ...report.document.settings, name: filename } }
        : report.document
    store.replaceDocument(document)
    onClose()
  }

  /** @param {any} event */
  const onDrop = async (event) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    const text = await file.text()
    setHtml(text)
    setFilename(String(file.name ?? '').replace(/\.[a-z]+$/i, ''))
    dropRef.current?.focus()
  }

  return (
    <div className="mf-overlay" role="presentation" onClick={onClose}>
      <div
        className="mf-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('import.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{t('import.title')}</h2>
        <p className="mf-help">{t('import.hint')}</p>

        <textarea
          ref={dropRef}
          className="mf-textarea"
          style={{ minHeight: 200 }}
          value={html}
          placeholder={t('import.placeholder')}
          aria-label={t('import.title')}
          onChange={(event) => setHtml(event.target.value)}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        />

        <div className="mf-dropzone" data-over={dragging || undefined}>
          {t('import.drop')}
        </div>

        {error ? (
          <p className="mf-help" style={{ color: 'var(--mf-danger)' }}>
            {error}
          </p>
        ) : null}

        {report ? (
          <div className="mf-report">
            <span className="mf-report-stat">
              {Math.round(report.confidence * 100)}%
              <span className="mf-help">{t('import.editable')}</span>
            </span>
            <div className="mf-meter">
              <span style={{ width: `${Math.round(report.confidence * 100)}%` }} />
            </div>
            <strong>
              {t('import.report', { recognized: report.recognized, total: report.blockCount })}
            </strong>
            {report.unrecognized.length ? (
              <span>{t('import.raw', { count: report.unrecognized.length })}</span>
            ) : null}
            {report.detectedVars.length ? (
              <span>
                Merge variables found: {report.detectedVars.map((path) => `{{${path}}}`).join(', ')}
              </span>
            ) : null}
            {report.warnings.length ? (
              <>
                <span className="mf-label">{t('import.warnings')}</span>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {report.warnings.map((warning) => (
                    <li key={warning.code} className="mf-help">
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <span className="mf-help">{t('import.replaceWarning')}</span>
          </div>
        ) : null}

        <div className="mf-dialog-actions">
          <button type="button" className="mf-btn" onClick={onClose}>
            {t('import.cancel')}
          </button>
          <button
            type="button"
            className="mf-btn mf-btn-outline"
            disabled={!html.trim()}
            onClick={analyse}
          >
            {t('import.parse')}
          </button>
          <button
            type="button"
            className="mf-btn mf-btn-primary"
            disabled={!report}
            onClick={confirm}
          >
            {t('import.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
