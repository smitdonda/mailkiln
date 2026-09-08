/**
 * The side panel.
 *
 * One panel, one tab row: Content, Rows, Settings, and — once something is
 * selected — Properties, which the panel switches to on its own.
 *
 * Properties used to *replace* the whole panel, on the reasoning that the thing
 * you are editing and the controls that edit it should not sit at opposite edges
 * of the screen. They still don't; but replacing the tabs threw the block list
 * away on every insert, so adding six blocks cost eleven extra clicks getting
 * back to it. A fourth tab keeps both: properties open where you are already
 * looking, and the palette is one click away instead of a round trip.
 *
 * Deselecting returns to whichever tab you were on before the selection.
 *
 * @module mailkiln/react/panels/SidePanel
 */

import { useEffect, useRef, useState } from 'react'
import { findNode, getBlockDef } from '../../core/index.js'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { BlockPalette } from './BlockPalette.jsx'
import { RowLayouts } from './RowLayouts.jsx'
import { DocumentFields, NodeFields } from './Inspector.jsx'
import { IconArrowLeft, IconClose, IconCopy, IconTrash } from '../icons.jsx'

/** @typedef {'content' | 'rows' | 'settings' | 'properties'} PanelTab */

/**
 * @param {object} props
 * @param {() => void} [props.onClose] Renders a close button. Passed only where the
 *   panel is an overlay — on a wide viewport it is a column, and a column that can
 *   close itself with no way back would be a trap.
 * @returns {import('react').ReactElement}
 */
export function SidePanel({ onClose }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const [tab, setTab] = useState(/** @type {PanelTab} */ ('content'))
  const { selection } = store

  // Where deselecting goes back to. Selecting a structural node is a layout
  // intent, so that one returns to Rows rather than to wherever you happened to
  // be — which is the tab you almost always want next after moving a row.
  const previousTab = useRef(/** @type {PanelTab} */ ('content'))

  useEffect(() => {
    if (selection) {
      if (selection.kind !== 'block') previousTab.current = 'rows'
      setTab('properties')
    } else {
      setTab(previousTab.current)
    }
  }, [selection])

  /** @param {PanelTab} next */
  const pick = (next) => {
    if (next !== 'properties') previousTab.current = next
    setTab(next)
    // Leaving Properties by hand means you are done with that node; keeping it
    // selected would leave the canvas outlined around something the panel is no
    // longer about, and the next insert would target it.
    if (next !== 'properties' && selection) store.select(null)
  }

  const label = selection
    ? selection.kind === 'block'
      ? (getBlockDef(selection.node.type)?.label ?? selection.node.type)
      : t(`inspector.${selection.kind}`)
    : ''

  const showProperties = tab === 'properties' && selection

  // Text, no icons: the words fit, and an icon beside each one only makes the
  // tab row louder than the panel underneath it.
  const tabs = /** @type {Array<[PanelTab, string]>} */ ([
    ['content', t('panel.content')],
    ['rows', t('panel.rows')],
    ['settings', t('panel.settings')],
    ...(selection ? [['properties', t('inspector.title')]] : []),
  ])

  return (
    <aside
      className="mk-panel"
      aria-label={
        showProperties
          ? t('inspector.title')
          : tab === 'content'
            ? t('palette.title')
            : t(`panel.${tab}`)
      }
    >
      <div className="mk-panel-tabs">
        {/* The tabs are their own element rather than the whole header row: a
            `tablist` may only contain tabs, and below the panel breakpoint the
            close button shares this row. */}
        <div className="mk-panel-switch" role="tablist" aria-label={t('inspector.title')}>
          {tabs.map(([id, text]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="mk-panel-tab"
              aria-selected={tab === id}
              onClick={() => pick(id)}
            >
              {text}
            </button>
          ))}
        </div>
        {onClose ? (
          <button
            type="button"
            className="mk-btn mk-btn-icon mk-panel-close"
            aria-label={t('panel.close')}
            title={t('panel.close')}
            onClick={onClose}
          >
            <IconClose />
          </button>
        ) : null}
      </div>

      {showProperties ? (
        <>
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
            {/* A second, always-visible route to duplicate/delete. The canvas
                strip is easy to miss on a short node, and "I added a row I don't
                want" must never be a dead end. */}
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
        </>
      ) : null}

      <div className="mk-panel-body">
        {showProperties ? <NodeFields location={selection} /> : null}
        {!showProperties && tab === 'content' ? <BlockPalette /> : null}
        {!showProperties && tab === 'rows' ? <RowLayouts /> : null}
        {!showProperties && tab === 'settings' ? <DocumentFields /> : null}
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
