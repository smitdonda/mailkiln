/**
 * `<MailKiln>` — the editor.
 *
 * @module mailkiln/react/MailKiln
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  builtinBlocks,
  registerBlock,
  themeToCssVars,
  unknownThemeKeys,
  isDev,
} from '../core/index.js'
import { MailKilnProvider } from './context.jsx'
import { applyTools } from './tools.js'
import { I18nProvider } from './i18n/index.jsx'
import { useMailKiln } from './useMailKiln.js'
import { DndRoot } from './dnd/DndRoot.jsx'
import { Toolbar } from './panels/Toolbar.jsx'
import { targetColumnId } from './panels/BlockPalette.jsx'
import { Canvas } from './panels/Canvas.jsx'
import { SidePanel } from './panels/SidePanel.jsx'
import { PreviewFrame } from './panels/PreviewFrame.jsx'
import { CodePanel } from './panels/CodePanel.jsx'
import { LintPanel } from './panels/LintPanel.jsx'
import { ImportDialog } from './panels/ImportDialog.jsx'
import { QuickInsert } from './panels/QuickInsert.jsx'

/**
 * @param {object} props
 * @param {import('../core/types.js').EmailDocument} [props.value] Controlled document.
 * @param {import('../core/types.js').EmailDocument} [props.defaultValue] Initial document when uncontrolled.
 * @param {(doc: import('../core/types.js').EmailDocument) => void} [props.onChange]
 * @param {import('../core/types.js').VarsDef} [props.vars] From `defineVars`.
 * @param {import('../core/types.js').BlockDef[]} [props.blocks] Custom blocks from `defineBlock`.
 * @param {Record<string, import('./tools.js').ToolConfig>} [props.tools] Per-tool palette
 *   config: `{ image: { enabled: false }, button: { position: 1, usageLimit: 1 } }`.
 * @param {import('../core/theme.js').Theme} [props.theme]
 * @param {'light' | 'dark' | 'auto'} [props.appearance] Editor chrome appearance.
 * @param {string} [props.locale]
 * @param {Record<string, string>} [props.messages] Per-key string overrides.
 * @param {(file: File) => Promise<string>} [props.onImageUpload]
 * @param {Array<{ label: string, value: string }>} [props.specialLinks] Replaces the
 *   built-in unsubscribe / preferences / view-in-browser entries offered by every link
 *   field. Pass `[]` to remove the picker.
 * @param {string[]} [props.lintDisable] Lint rule ids to skip — `['contrast']`, or
 *   `['block:html']` for a whole block type's own rules. The rule stops being reported
 *   everywhere in this document.
 * @param {(bundle: import('../core/types.js').ExportBundle) => void} [props.onExport]
 * @param {boolean} [props.showPalette]
 * @param {boolean} [props.showInspector]
 * @param {string} [props.className]
 * @param {import('react').CSSProperties} [props.style]
 * @returns {import('react').ReactElement}
 */
export function MailKiln({
  value,
  defaultValue,
  onChange,
  vars,
  blocks: customBlocks,
  tools,
  theme,
  appearance = 'light',
  locale = 'en',
  messages,
  onImageUpload,
  specialLinks,
  lintDisable,
  onExport,
  showPalette = true,
  showInspector = true,
  className,
  style,
}) {
  const instanceId = useId()
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const [view, setView] = useState(/** @type {'design' | 'preview' | 'code' | 'checks'} */ ('design'))
  const [device, setDevice] = useState(/** @type {'desktop' | 'mobile' | 'text'} */ ('desktop'))
  const [importOpen, setImportOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [systemDark, setSystemDark] = useState(false)

  // Custom blocks are registered before the first render that could reference
  // them. `registerBlock` is idempotent for an identical definition, so a
  // remount (or Fast Refresh) does not throw "already registered".
  useMemo(() => {
    for (const def of customBlocks ?? []) registerBlock(def)
  }, [customBlocks])

  // `tools` only shapes the palette. Every block stays registered, so a document
  // that already contains a disabled block still renders, still exports and can
  // still be edited — turning a tool off must not break an existing template.
  const blocks = useMemo(
    () => applyTools([...builtinBlocks, ...(customBlocks ?? [])], tools),
    [customBlocks, tools],
  )

  const store = useMailKiln({ value, defaultValue, onChange, vars: vars ?? null, lintDisable })

  useEffect(() => {
    if (appearance !== 'auto' || typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(query.matches)
    const listener = (/** @type {any} */ event) => setSystemDark(event.matches)
    query.addEventListener?.('change', listener)
    return () => query.removeEventListener?.('change', listener)
  }, [appearance])

  useEffect(() => {
    if (!isDev()) return
    const unknown = unknownThemeKeys(theme)
    if (unknown.length) {
      // A typo'd theme key silently does nothing, which is a miserable thing to
      // debug from the outside.
      console.warn(
        `mailkiln: unknown theme ${unknown.length === 1 ? 'key' : 'keys'} ${unknown.join(', ')}. See the Theme type for valid keys.`,
      )
    }
  }, [theme])

  // The consumer owns light/dark: `appearance` decides it outright, or follows the
  // OS when set to 'auto'. There is no in-editor toggle — an editor that lets the
  // user flip its own chrome disagrees with the surrounding app the moment the two
  // are on different settings, and the app is the one that should win.
  const resolvedAppearance =
    appearance === 'auto' ? (systemDark ? 'dark' : 'light') : appearance

  const contextValue = useMemo(
    () => ({
      store,
      blocks,
      onImageUpload,
      specialLinks,
      tools,
      instanceId,
      drag: { activeDrag: null, dropTarget: null },
    }),
    [store, blocks, onImageUpload, specialLinks, tools, instanceId],
  )

  /**
   * Pull focus into the editor when the user clicks somewhere that cannot take
   * it (the canvas, a section background).
   *
   * The focus call has to happen *after* the pointer event's default action,
   * not during it: mousedown's default moves focus on its own, and in Chrome a
   * click on the canvas lands it on `<body>` — which silently undid a `focus()`
   * made in the pointerdown handler and left every editor shortcut (`/`,
   * Delete, Escape, Ctrl+Z) dead until you happened to tab into a control. So
   * this defers a frame and only claims focus if nothing inside the editor took
   * it, which leaves a clicked input, button or contentEditable alone.
   */
  const focusRoot = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const claim = () => {
      const current = rootRef.current
      if (!current) return
      if (current.contains(document.activeElement)) return
      current.focus({ preventScroll: true })
    }
    claim()
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(claim)
    else setTimeout(claim, 0)
  }, [])

  const handleKeyDown = useCallback(
    /** @param {import('react').KeyboardEvent} event */
    (event) => {
      const target = /** @type {HTMLElement} */ (event.target)
      const typing =
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.getAttribute?.('role') === 'textbox'

      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (mod && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (mod && key === 'y') {
        event.preventDefault()
        store.redo()
        return
      }
      if (typing) return

      // `/` opens quick insert — advertised on the empty canvas, so it has to
      // work from anywhere on it.
      if (key === '/' && !mod) {
        event.preventDefault()
        setQuickOpen(true)
        return
      }
      if (mod && key === 'd' && store.selectedId) {
        event.preventDefault()
        store.duplicate(store.selectedId)
        return
      }
      if ((key === 'delete' || key === 'backspace') && store.selectedId) {
        event.preventDefault()
        store.remove(store.selectedId)
        return
      }
      if (key === 'escape') {
        store.select(null)
      }
    },
    [store],
  )

  return (
    <I18nProvider locale={locale} messages={messages}>
      <MailKilnProvider value={contextValue}>
        <div
          ref={rootRef}
          className={['mk-root', className].filter(Boolean).join(' ')}
          data-mk-theme={resolvedAppearance}
          style={{ ...themeToCssVars(theme), ...style }}
          // `tabIndex={-1}` plus the pointer-down focus below is what makes the
          // keyboard shortcuts work at all. A <div> cannot hold focus, so after
          // clicking the canvas the active element is <body> and every keydown
          // fires outside this subtree — undo, delete and `/` all silently did
          // nothing in a real browser, while tests that dispatched events
          // straight at this element passed.
          tabIndex={-1}
          onPointerDown={focusRoot}
          onKeyDown={handleKeyDown}
        >
          <DndRoot>
            <Toolbar
              view={view}
              onView={setView}
              device={device}
              onDevice={setDevice}
              onImport={() => setImportOpen(true)}
              onExport={onExport}
              appearance={resolvedAppearance}
            />

            <div className="mk-shell">
              <main className="mk-main">
                {view === 'design' ? (
                  <Canvas device={device} onQuickInsert={() => setQuickOpen(true)} />
                ) : null}
                {view === 'preview' ? <PreviewFrame device={device} /> : null}
                {view === 'code' ? <CodePanel /> : null}
                {view === 'checks' ? (
                  <LintPanel
                    onShowBlock={(nodeId) => {
                      store.select(nodeId)
                      setView('design')
                    }}
                  />
                ) : null}
              </main>

              {/* One panel, on the right, that swaps between the content tabs
                  and the selected node's properties. `showPalette` and
                  `showInspector` both gate it: either one is enough to want it. */}
              {(showPalette || showInspector) && view === 'design' ? <SidePanel /> : null}
            </div>

            {importOpen ? <ImportDialog onClose={() => setImportOpen(false)} /> : null}
            {quickOpen ? <QuickInsert onClose={() => setQuickOpen(false)} /> : null}
          </DndRoot>
        </div>
      </MailKilnProvider>
    </I18nProvider>
  )
}

export { targetColumnId }
