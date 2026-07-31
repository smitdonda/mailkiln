/**
 * The layout thumbnail grid.
 *
 * @module mailforge/react/panels/LayoutPicker
 */

import { useI18n } from '../i18n/index.jsx'
import { ROW_PRESETS } from '../rowPresets.js'

/**
 * @param {object} props
 * @param {string | null} [props.active] Preset id to mark as current.
 * @param {(widths: number[], id: string) => void} props.onPick
 * @param {boolean} [props.compact] Two-up instead of labelled cards.
 * @returns {import('react').ReactElement}
 */
export function LayoutPicker({ active, onPick, compact = false }) {
  const t = useI18n()

  return (
    <div className={compact ? 'mf-layouts mf-layouts-compact' : 'mf-layouts'}>
      {ROW_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="mf-layout"
          data-row-preset={preset.id}
          aria-pressed={active === preset.id}
          aria-label={t(`rows.${preset.id}`)}
          title={t(`rows.${preset.id}`)}
          onClick={() => onPick(preset.widths, preset.id)}
        >
          <span className="mf-layout-preview" aria-hidden="true">
            {preset.widths.map((width, index) => (
              <span key={index} style={{ flexGrow: width }} />
            ))}
          </span>
          {compact ? null : t(`rows.${preset.id}`)}
        </button>
      ))}
    </div>
  )
}
