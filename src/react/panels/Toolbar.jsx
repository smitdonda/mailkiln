/**
 * Toolbar: history on the left, view switching in the middle, actions on the
 * right — the arrangement every builder converges on, because it maps to
 * undo → look → ship.
 *
 * @module mailkiln/react/panels/Toolbar
 */

import { documentName, exportDocument, GMAIL_LIMIT, toComponentName } from '../../core/index.js'
import { useI18n } from '../i18n/index.jsx'
import { useMailKilnContext } from '../context.jsx'
import {
  IconDesktop,
  IconDownload,
  IconEye,
  IconGrid,
  IconMail,
  IconMobile,
  IconMoon,
  IconSliders,
  IconRedo,
  IconText,
  IconUndo,
  IconWarning,
} from '../icons.jsx'

/**
 * @param {object} props
 * @param {'design' | 'preview' | 'checks'} props.view
 * @param {(view: 'design' | 'preview' | 'checks') => void} props.onView
 * @param {'desktop' | 'mobile' | 'text'} props.device
 * @param {(device: 'desktop' | 'mobile' | 'text') => void} props.onDevice
 * @param {(bundle: import('../../core/types.js').ExportBundle) => void} [props.onExport]
 * @param {boolean} [props.panelOpen] Whether the side panel is showing. Only meaningful
 *   below the layout's panel breakpoint, where the panel is an overlay rather than a column.
 * @param {() => void} [props.onTogglePanel] Renders the panel toggle. Hidden by CSS on
 *   wide viewports, where the panel is always visible and a toggle would be noise.
 * @param {'light' | 'dark'} props.appearance
 * @param {() => void} [props.onToggleAppearance] Renders a dark-mode toggle.
 *   `<MailKiln>` does not pass one — it takes its appearance from the `appearance`
 *   prop, so the surrounding app stays in charge of light vs dark. Pass a handler
 *   here if you are assembling your own layout and want the button back.
 * @returns {import('react').ReactElement}
 */
export function Toolbar({
  view,
  onView,
  device,
  onDevice,
  onExport,
  panelOpen,
  onTogglePanel,
  appearance,
  onToggleAppearance,
}) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const { errors, warnings, sizeBytes } = store.lint
  const issues = errors + warnings

  // The one number that decides whether the footer reaches the reader at all:
  // Gmail cuts the message at 102KB and replaces the rest with a link. The
  // linter already reports it, but only once you go and look, and by then the
  // paragraph that pushed you over is three edits back. The 80% here is the
  // rule's own `WARN_AT`, derived the same way.
  const sizeLevel =
    sizeBytes >= GMAIL_LIMIT ? 'error' : sizeBytes >= GMAIL_LIMIT * 0.8 ? 'warn' : undefined

  const views = /** @type {const} */ ([
    ['design', 'view.design', IconGrid],
    ['preview', 'view.preview', IconEye],
    ['checks', 'view.checks', IconWarning],
  ])

  const devices = /** @type {const} */ ([
    ['desktop', 'toolbar.desktop', IconDesktop],
    ['mobile', 'toolbar.mobile', IconMobile],
    ['text', 'code.text', IconText],
  ])

  return (
    <div className="mk-toolbar">
      {/* The template's own name, edited in place. Tagged for history coalescing
          so typing a title is one undo step, not one per keystroke. */}
      {/* A mark for the thing being edited, so the name has something to sit
          against instead of starting at the window edge. Deliberately a quiet
          outline glyph rather than a filled tile: this component is embedded in
          somebody else's product, where a coloured badge reads as branding they
          did not ask for — and the accent is already spent on the selected node
          and on Export. */}
      <div className="mk-toolbar-doc">
        <IconMail className="mk-doc-mark" aria-hidden="true" />
        <input
          className="mk-title"
          type="text"
          value={store.doc.settings.name ?? ''}
          placeholder={t('toolbar.untitled')}
          aria-label={t('toolbar.name')}
          title={t('toolbar.name')}
          onChange={(event) => store.patchSettings({ name: event.target.value }, 'name')}
        />
      </div>

      <span className="mk-toolbar-sep" />

      <div className="mk-toolbar-group">
        <button
          type="button"
          className="mk-btn mk-btn-icon"
          disabled={!store.canUndo}
          aria-label={t('toolbar.undo')}
          title={`${t('toolbar.undo')} (Ctrl+Z)`}
          onClick={store.undo}
        >
          <IconUndo />
        </button>
        <button
          type="button"
          className="mk-btn mk-btn-icon"
          disabled={!store.canRedo}
          aria-label={t('toolbar.redo')}
          title={`${t('toolbar.redo')} (Ctrl+Shift+Z)`}
          onClick={store.redo}
        >
          <IconRedo />
        </button>
      </div>

      <span className="mk-toolbar-sep" />

      <div className="mk-segmented" role="tablist" aria-label="View">
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
              <span className="mk-badge" data-level={errors ? 'error' : 'warn'}>
                {issues}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {onTogglePanel ? (
        <button
          type="button"
          className="mk-btn mk-btn-panel"
          data-open={panelOpen ? 'true' : undefined}
          title={t('toolbar.panel')}
          aria-expanded={panelOpen === true}
          onClick={onTogglePanel}
        >
          <IconSliders />
          {t('toolbar.panel')}
        </button>
      ) : null}

      {view === 'design' || view === 'preview' ? (
        <div className="mk-segmented" role="group" aria-label="Preview width">
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

      <span className="mk-spacer-flex" />

      {/* Ambient, not a control — the word count of an email. There is nothing
          to click because the Checks tab beside it is already the way in. */}
      <span className="mk-size" data-level={sizeLevel} title={t('toolbar.sizeHint')}>
        {t('toolbar.size', {
          size: Math.round(sizeBytes / 1024),
          // The budget belongs beside the number, not only in the tooltip: a
          // bare "8 KB" gives nobody a reason to care until it is too late.
          limit: Math.round(GMAIL_LIMIT / 1024),
        })}
      </span>

      {onToggleAppearance ? (
        <button
          type="button"
          className="mk-btn mk-btn-icon"
          aria-label={t('toolbar.theme')}
          title={t('toolbar.theme')}
          aria-pressed={appearance === 'dark'}
          onClick={onToggleAppearance}
        >
          <IconMoon />
        </button>
      ) : null}

      {onExport ? (
        <button
          type="button"
          className="mk-btn mk-btn-primary"
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
