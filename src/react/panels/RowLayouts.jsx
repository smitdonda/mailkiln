/**
 * The Rows tab: visual column-layout presets.
 *
 * Every mature email builder (Unlayer, Beefree, Stripo) puts layout on the same
 * footing as content, because "two columns side by side" is the single most
 * common thing a person wants and hunting for a column-count field in a property
 * panel is a bad way to find it.
 *
 * @module mailforge/react/panels/RowLayouts
 */

import { useMailForgeContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { findNode } from '../../core/index.js'
import { LayoutPicker } from './LayoutPicker.jsx'

export { ROW_PRESETS } from '../rowPresets.js'

/**
 * @returns {import('react').ReactElement}
 */
export function RowLayouts() {
  const t = useI18n()
  const { store } = useMailForgeContext()

  /**
   * Add the row to the selected section when there is one, else to the last
   * section — the same "where the user is looking" rule the palette uses.
   *
   * @param {number[]} widths
   */
  const addRow = (widths) => {
    const sectionId = targetSectionId(store)
    if (sectionId) store.addRow(sectionId, widths)
    else store.addSection({ widths })
  }

  return (
    <>
      <div className="mf-section-label">{t('panel.rows')}</div>
      <LayoutPicker onPick={addRow} />
      <p className="mf-help" style={{ padding: '0 14px 16px' }}>
        {t('panel.rowsHint')}
      </p>
    </>
  )
}

/**
 * @param {import('../useMailForge.js').EditorStore} store
 * @returns {string | null}
 */
export function targetSectionId(store) {
  const { doc, selectedId } = store
  if (selectedId) {
    const found = findNode(doc, selectedId)
    if (found) return found.path[0]
  }
  const sections = doc.sections ?? []
  return sections.length ? sections[sections.length - 1].id : null
}
