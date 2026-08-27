/**
 * The side panel.
 *
 * One panel, three tabs — Content, Rows, Settings — and it *swaps* to the
 * selected node's properties instead of showing them somewhere else. That swap is
 * the whole reason this component exists: with a separate always-on inspector,
 * the thing you are editing and the controls that edit it sit at opposite edges
 * of the screen, and you spend the session looking back and forth.
 *
 * Selecting a block therefore replaces the tabs with a titled header and a back
 * button; deselecting returns to whichever tab you were on.
 *
 * @module mailkiln/react/panels/SidePanel
 */

import { useEffect, useState } from 'react'
import { findNode, getBlockDef } from '../../core/index.js'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { BlockPalette } from './BlockPalette.jsx'
import { RowLayouts } from './RowLayouts.jsx'
import { DocumentFields, NodeFields } from './Inspector.jsx'
import { IconArrowLeft, IconCopy, IconGrid, IconRows, IconSliders, IconTrash } from '../icons.jsx'

/** @typedef {'content' | 'rows' | 'settings'} PanelTab */

/**
 * @returns {import('react').ReactElement}
 */
export function SidePanel() {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const [tab, setTab] = useState(/** @type {PanelTab} */ ('content'))
  const { selection } = store

  // Selecting a structural node is a layout intent, so land on Rows for it and
  // on Content for a block. Without this the panel opens on whatever tab you
  // last used, which is rarely the one you want next.
  useEffect(() => {
    if (selection && selection.kind !== 'block') setTab('rows')
  }, [selection])

  if (selection) {
    const label =
      selection.kind === 'block'
        ? (getBlockDef(selection.node.type)?.label ?? selection.node.type)
        : t(`inspector.${selection.kind}`)

    return (
      <aside className="mk-panel" aria-label={t('inspector.title')}>
        <div className="mk-panel-head">
          <button
            type="button"
            className="mk-btn mk-btn-icon"
            aria-label={t('panel.back')}
            title={t('panel.back')}
            onClick={() => store.select(null)}
          >
            <IconArrowLeft />
          </button>
          <span className="mk-panel-title">{label}</span>
          {/* A second, always-visible route to duplicate/delete. The canvas strip
              is easy to miss on a short node, and "I added a row I don't want"
              must never be a dead end. */}
          <button
            type="button"
            className="mk-btn mk-btn-icon"
            aria-label={`${t('canvas.duplicate')} ${label}`}
            title={t('canvas.duplicate')}
            onClick={() => store.duplicate(selection.node.id)}
          >
            <IconCopy />
          </button>
          <button
            type="button"
            className="mk-btn mk-btn-icon"
            aria-label={`${t('canvas.delete')} ${label}`}
            title={t('canvas.delete')}
            onClick={() => store.remove(selection.node.id)}
          >
            <IconTrash />
          </button>
        </div>
        <Breadcrumbs selection={selection} />
        <div className="mk-panel-body">
          <NodeFields location={selection} />
        </div>
      </aside>
    )
  }

  const tabs = /** @type {const} */ ([
    ['content', 'panel.content', IconGrid],
    ['rows', 'panel.rows', IconRows],
    ['settings', 'panel.settings', IconSliders],
  ])

  return (
    <aside
      className="mk-panel"
      aria-label={tab === 'content' ? t('palette.title') : t(`panel.${tab}`)}
    >
      <div className="mk-panel-tabs" role="tablist" aria-label={t('inspector.title')}>
        {tabs.map(([id, key, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="mk-panel-tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon />
            {t(key)}
          </button>
        ))}
      </div>

      <div className="mk-panel-body">
        {tab === 'content' ? <BlockPalette /> : null}
        {tab === 'rows' ? <RowLayouts /> : null}
        {tab === 'settings' ? <DocumentFields /> : null}
      </div>
    </aside>
  )
}

/**
 * The ancestor trail of the selected node: Section › Row › Column › Block.
 *
 * Not decoration — it is the only reliable way *up*. Columns fill their row, so
 * on a row with no padding there is nowhere left to click that means "the row";
 * before this, adding padding to such a row was impossible from the canvas.
 *
 * @param {object} props
 * @param {import('../../core/types.js').NodeLocation} props.selection
 * @returns {import('react').ReactElement | null}
 */
function Breadcrumbs({ selection }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const trail = (selection.path ?? []).slice(0, -1)
  if (!trail.length) return null

  return (
    <nav className="mk-crumbs" aria-label={t('panel.ancestors')}>
      {trail.map((id) => {
        const found = findNode(store.doc, id)
        if (!found) return null
        const label =
          found.kind === 'block'
            ? (getBlockDef(found.node.type)?.label ?? found.node.type)
            : t(`inspector.${found.kind}`)
        return (
          <button key={id} type="button" className="mk-crumb" onClick={() => store.select(id)}>
            {label}
          </button>
        )
      })}
    </nav>
  )
}
