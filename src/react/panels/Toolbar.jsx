/**
 * Toolbar: history on the left, view switching in the middle, actions on the
 * right — the arrangement every builder converges on, because it maps to
 * undo → look → ship.
 *
 * @module mailforge/react/panels/Toolbar
 */

import { documentName, exportDocument, toComponentName } from '../../core/index.js'
import { useI18n } from '../i18n/index.jsx'
import { useMailForgeContext } from '../context.jsx'
import {
  IconCode,
  IconDesktop,
  IconDownload,
  IconEye,
  IconGrid,
  IconMobile,
  IconMoon,
  IconRedo,
  IconSend,
  IconText,
  IconUndo,
  IconUpload,
  IconWarning,
} from '../icons.jsx'

/**
 * @param {object} props
 * @param {'design' | 'preview' | 'code' | 'checks'} props.view
 * @param {(view: 'design' | 'preview' | 'code' | 'checks') => void} props.onView
 * @param {'desktop' | 'mobile' | 'text'} props.device
 * @param {(device: 'desktop' | 'mobile' | 'text') => void} props.onDevice
 * @param {() => void} props.onImport
 * @param {(bundle: import('../../core/types.js').ExportBundle) => void} [props.onExport]
 * @param {() => void} [props.onSendTest]
 * @param {'light' | 'dark'} props.appearance
 * @param {() => void} props.onToggleAppearance
 * @returns {import('react').ReactElement}
 */
export function Toolbar({
  view,
  onView,
  device,
  onDevice,
  onImport,
  onExport,
  onSendTest,
  appearance,
  onToggleAppearance,
}) {
  const t = useI18n()
  const { store } = useMailForgeContext()
  const { errors, warnings } = store.lint
  const issues = errors + warnings

  const views = /** @type {const} */ ([
    ['design', 'view.design', IconGrid],
    ['preview', 'view.preview', IconEye],
    ['code', 'view.code', IconCode],
    ['checks', 'view.checks', IconWarning],
  ])

  const devices = /** @type {const} */ ([
    ['desktop', 'toolbar.desktop', IconDesktop],
    ['mobile', 'toolbar.mobile', IconMobile],
    ['text', 'code.text', IconText],
  ])

  return (
    <div className="mf-toolbar">
      {/* The template's own name, edited in place. Tagged for history coalescing
          so typing a title is one undo step, not one per keystroke. */}
      <input
        className="mf-title"
        type="text"
        value={store.doc.settings.name ?? ''}
        placeholder={t('toolbar.untitled')}
        aria-label={t('toolbar.name')}
        title={t('toolbar.name')}
        onChange={(event) => store.patchSettings({ name: event.target.value }, 'name')}
      />

      <span className="mf-toolbar-sep" />

      <div className="mf-toolbar-group">
        <button
          type="button"
          className="mf-btn mf-btn-icon"
          disabled={!store.canUndo}
          aria-label={t('toolbar.undo')}
          title={`${t('toolbar.undo')} (Ctrl+Z)`}
          onClick={store.undo}
        >
          <IconUndo />
        </button>
        <button
          type="button"
          className="mf-btn mf-btn-icon"
          disabled={!store.canRedo}
          aria-label={t('toolbar.redo')}
          title={`${t('toolbar.redo')} (Ctrl+Shift+Z)`}
          onClick={store.redo}
        >
          <IconRedo />
        </button>
      </div>

      <span className="mf-toolbar-sep" />

      <div className="mf-segmented" role="tablist" aria-label="View">
        {views.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => onView(id)}
          >
            <Icon />
            {t(label)}
            {id === 'checks' && issues > 0 ? (
              <span className="mf-badge" data-level={errors ? 'error' : 'warn'}>
                {issues}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {view === 'design' || view === 'preview' ? (
        <div className="mf-segmented" role="group" aria-label="Preview width">
          {devices
            // The text view is a preview-only thing; there is nothing to design.
            .filter(([id]) => view === 'preview' || id !== 'text')
            .map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-pressed={device === id}
                aria-label={t(label)}
                title={t(label)}
                onClick={() => onDevice(id)}
              >
                <Icon />
              </button>
            ))}
        </div>
      ) : null}

      <span className="mf-spacer-flex" />

      <button
        type="button"
        className="mf-btn mf-btn-icon"
        aria-label={t('toolbar.theme')}
        title={t('toolbar.theme')}
        aria-pressed={appearance === 'dark'}
        onClick={onToggleAppearance}
      >
        <IconMoon />
      </button>

      <button type="button" className="mf-btn" onClick={onImport}>
        <IconUpload />
        {t('toolbar.import')}
      </button>

      {/* Only when the consumer wired a handler — mailforge cannot send email
          itself, and a button that always fails is worse than no button. */}
      {onSendTest ? (
        <button type="button" className="mf-btn" onClick={onSendTest}>
          <IconSend />
          {t('toolbar.sendTest')}
        </button>
      ) : null}

      {onExport ? (
        <button
          type="button"
          className="mf-btn mf-btn-primary"
          onClick={() =>
            onExport(
              exportDocument(store.doc, {
                vars: store.vars,
                name: toComponentName(documentName(store.doc)),
              }),
            )
          }
        >
          <IconDownload />
          {t('toolbar.export')}
        </button>
      ) : null}
    </div>
  )
}
