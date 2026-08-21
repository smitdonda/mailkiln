/**
 * The code panel — pillar 1, made visible.
 *
 * Showing the emitted component live, next to the design, is the whole pitch: the
 * visual editor is an authoring convenience, and the code is the artefact you keep.
 * Copy or download it and mailkiln is out of your dependency tree.
 *
 * @module mailkiln/react/panels/CodePanel
 */

import { useMemo, useState } from 'react'
import {
  documentName,
  exportDocument,
  exportFilenames,
  toComponentName,
} from '../../core/index.js'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { IconCheck, IconCopy, IconDownload, IconWarning } from '../icons.jsx'

/** @type {Array<{ id: keyof import('../../core/types.js').ExportBundle, label: string }>} */
const TABS = [
  { id: 'jsx', label: 'code.jsx' },
  { id: 'tsx', label: 'code.tsx' },
  { id: 'html', label: 'code.html' },
  { id: 'mjml', label: 'code.mjml' },
  { id: 'text', label: 'code.text' },
  { id: 'json', label: 'code.json' },
]

/**
 * @returns {import('react').ReactElement}
 */
export function CodePanel() {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const [tab, setTab] = useState(
    /** @type {keyof import('../../core/types.js').ExportBundle} */ ('jsx'),
  )
  const [copied, setCopied] = useState(false)

  const name = toComponentName(documentName(store.doc))
  const bundle = useMemo(
    () => exportDocument(store.doc, { vars: store.vars, name }),
    [store.doc, store.vars, name],
  )
  const filenames = useMemo(() => exportFilenames(name), [name])
  const source = bundle[tab] ?? ''

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(source)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    const blob = new Blob([source], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filenames[tab]
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="mk-code-bar">
        <div className="mk-segmented" role="tablist" aria-label={t('view.code')}>
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
            >
              {t(entry.label)}
            </button>
          ))}
        </div>
        <span className="mk-spacer-flex" />
        <button type="button" className="mk-btn mk-btn-sm" onClick={copy}>
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? t('code.copied') : t('code.copy')}
        </button>
        <button type="button" className="mk-btn mk-btn-sm mk-btn-outline" onClick={download}>
          <IconDownload />
          {t('code.download')}
        </button>
      </div>

      {tab === 'mjml' ? (
        <p className="mk-note">
          <IconWarning />
          {t('code.mjmlNote')}
        </p>
      ) : null}

      <div className="mk-scroll">
        <pre className="mk-code">
          <code>{source}</code>
        </pre>
      </div>
    </>
  )
}
