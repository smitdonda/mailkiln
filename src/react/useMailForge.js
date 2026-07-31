/**
 * The editor's state engine.
 *
 * Every mutation goes through `core/document.js` and lands in the history stack,
 * which is why undo/redo needs no special cases: a drag, an Inspector edit and an
 * import are all "commit a new document".
 *
 * Works controlled (`value` + `onChange`) or uncontrolled (`defaultValue`).
 *
 * @module mailforge/react/useMailForge
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  assertDocument,
  canRedo as canRedoHistory,
  canUndo as canUndoHistory,
  commit,
  createDocument,
  createHistory,
  duplicateNode as duplicateNodeOp,
  findNode,
  insertBlock as insertBlockOp,
  insertRow as insertRowOp,
  insertSection as insertSectionOp,
  lintDocument,
  moveBlock as moveBlockOp,
  moveRow as moveRowOp,
  moveSection as moveSectionOp,
  normalize,
  patchProps as patchPropsOp,
  patchSettings as patchSettingsOp,
  patchTag,
  redo as redoHistory,
  removeNode as removeNodeOp,
  reset as resetHistory,
  setColumnWidths as setColumnWidthsOp,
  setRowColumns as setRowColumnsOp,
  setRowLayout as setRowLayoutOp,
  setCondition as setConditionOp,
  setRepeat as setRepeatOp,
  undo as undoHistory,
} from '../core/index.js'

/** @typedef {import('../core/types.js').EmailDocument} EmailDocument */
/** @typedef {import('../core/types.js').Block} Block */

/**
 * The editor store. Spelled out rather than inferred so consumers who call
 * `useMailForge()` to build their own layout get real autocomplete out of the
 * published `.d.ts`.
 *
 * @typedef {object} EditorStore
 * @property {EmailDocument} doc
 * @property {import('../core/types.js').History} history
 * @property {import('../core/types.js').VarsDef | null} vars
 * @property {import('../core/types.js').LintResult} lint
 * @property {string | null} selectedId
 * @property {import('../core/types.js').NodeLocation | null} selection
 * @property {string | null} hoveredId
 * @property {(id: string | null) => void} select
 * @property {(id: string | null) => void} setHovered
 * @property {(next: EmailDocument | ((doc: EmailDocument) => EmailDocument), opts?: { tag?: string | null }) => void} apply
 * @property {() => void} undo
 * @property {() => void} redo
 * @property {boolean} canUndo
 * @property {boolean} canRedo
 * @property {(columnId: string, init?: { index?: number, type?: string, block?: Block, props?: Record<string, any> }) => void} insertBlock
 * @property {(move: { blockId: string, toColumnId: string, toIndex?: number }) => void} moveBlock
 * @property {(id: string, patch: Record<string, any>, tagKey?: string) => void} patch
 * @property {(patch: Partial<import('../core/types.js').DocumentSettings>, tagKey?: string) => void} patchSettings
 * @property {(id: string) => void} remove
 * @property {(id: string) => void} duplicate
 * @property {(init?: { index?: number, columns?: number, widths?: number[] }) => void} addSection
 * @property {(sectionId: string, layout?: number | number[]) => void} addRow
 * @property {(rowId: string, count: number) => void} setRowColumns
 * @property {(rowId: string, widths: number[]) => void} setColumnWidths
 * @property {(rowId: string, widths: number[]) => void} setRowLayout
 * @property {(id: string, showIf: import('../core/types.js').Condition | null) => void} setCondition
 * @property {(rowId: string, repeat: import('../core/types.js').Repeat | null) => void} setRepeat
 * @property {(sectionId: string, toIndex: number) => void} moveSection
 * @property {(move: { rowId: string, toSectionId?: string, toIndex?: number }) => void} moveRow
 * @property {(next: EmailDocument) => void} replaceDocument
 */

/**
 * @param {object} [options]
 * @param {EmailDocument} [options.value] Controlled document.
 * @param {EmailDocument} [options.defaultValue] Initial document when uncontrolled.
 * @param {(doc: EmailDocument) => void} [options.onChange]
 * @param {import('../core/types.js').VarsDef | null} [options.vars]
 * @param {number} [options.historyLimit]
 * @returns {EditorStore}
 */
export function useMailForge(options = {}) {
  const { value, defaultValue, onChange, vars = null, historyLimit } = options

  const [history, setHistory] = useState(() =>
    createHistory(normalize(value ?? defaultValue ?? createDocument()), { limit: historyLimit }),
  )
  const historyRef = useRef(history)
  historyRef.current = history

  const [selectedId, setSelectedId] = useState(/** @type {string | null} */ (null))
  const [hoveredId, setHoveredId] = useState(/** @type {string | null} */ (null))

  // Controlled mode: an external value change that we didn't cause resets
  // history rather than stacking onto it — the parent is the source of truth.
  useEffect(() => {
    if (!value) return
    if (value === historyRef.current.present) return
    const normalized = normalize(value)
    if (normalized === historyRef.current.present) return
    assertDocument(normalized, { knownBlocksOnly: true })
    setHistory((current) => resetHistory(current, normalized))
  }, [value])

  const doc = history.present

  /**
   * Commit a new document. `tag` drives history coalescing — consecutive commits
   * with the same tag inside the coalesce window become one undo step, which is
   * what makes typing undo as a sentence instead of as forty keystrokes.
   */
  const apply = useCallback(
    /**
     * @param {EmailDocument | ((doc: EmailDocument) => EmailDocument)} next
     * @param {{ tag?: string | null }} [opts]
     */
    (next, opts = {}) => {
      const current = historyRef.current.present
      const produced = typeof next === 'function' ? next(current) : next
      if (!produced || produced === current) return
      const normalized = normalize(produced)
      if (normalized === current) return
      const updated = commit(historyRef.current, normalized, { tag: opts.tag ?? null })
      historyRef.current = updated
      setHistory(updated)
      onChange?.(normalized)
    },
    [onChange],
  )

  const store = useEditorStore({
    doc,
    history,
    apply,
    setHistory,
    historyRef,
    onChange,
    selectedId,
    setSelectedId,
    hoveredId,
    setHoveredId,
    vars,
  })

  return store
}

/**
 * @typedef {object} StoreArgs
 * @property {EmailDocument} doc
 * @property {import('../core/types.js').History} history
 * @property {(next: EmailDocument | ((doc: EmailDocument) => EmailDocument), opts?: { tag?: string | null }) => void} apply
 * @property {(history: import('../core/types.js').History) => void} setHistory
 * @property {{ current: import('../core/types.js').History }} historyRef
 * @property {((doc: EmailDocument) => void) | undefined} onChange
 * @property {string | null} selectedId
 * @property {(id: string | null) => void} setSelectedId
 * @property {string | null} hoveredId
 * @property {(id: string | null) => void} setHoveredId
 * @property {import('../core/types.js').VarsDef | null} vars
 */

/**
 * Split out so the returned shape is described in one place. Named `use*`
 * because it calls hooks — it is part of `useMailForge`, not a helper.
 *
 * @param {StoreArgs} args
 * @returns {EditorStore}
 */
function useEditorStore(args) {
  const {
    doc,
    history,
    apply,
    setHistory,
    historyRef,
    onChange,
    selectedId,
    setSelectedId,
    hoveredId,
    setHoveredId,
    vars,
  } = args

  const selection = useMemo(
    () => (selectedId ? findNode(doc, selectedId) : null),
    [doc, selectedId],
  )

  // Selecting a node that later disappears (deleted, or replaced by an import)
  // would leave the Inspector editing a ghost.
  useEffect(() => {
    if (selectedId && !findNode(doc, selectedId)) setSelectedId(null)
  }, [doc, selectedId, setSelectedId])

  const lint = useMemo(() => lintDocument(doc, { vars }), [doc, vars])

  const undo = useCallback(() => {
    const next = undoHistory(historyRef.current)
    if (next === historyRef.current) return
    historyRef.current = next
    setHistory(next)
    onChange?.(next.present)
  }, [historyRef, setHistory, onChange])

  const redo = useCallback(() => {
    const next = redoHistory(historyRef.current)
    if (next === historyRef.current) return
    historyRef.current = next
    setHistory(next)
    onChange?.(next.present)
  }, [historyRef, setHistory, onChange])

  const actions = useMemo(
    () => ({
      /**
       * @param {string} columnId
       * @param {object} [init]
       * @param {number} [init.index]
       * @param {string} [init.type]
       * @param {import('../core/types.js').Block} [init.block]
       * @param {Record<string, any>} [init.props]
       */
      insertBlock(columnId, init = {}) {
        let insertedId = null
        apply((current) => {
          const next = insertBlockOp(current, { columnId, ...init })
          // Select what was just added — the Inspector should be showing it.
          const before = new Set(collectBlockIds(current))
          insertedId = collectBlockIds(next).find((id) => !before.has(id)) ?? null
          return next
        })
        if (insertedId) setSelectedId(insertedId)
      },

      /**
       * @param {object} move
       * @param {string} move.blockId
       * @param {string} move.toColumnId
       * @param {number} [move.toIndex]
       */
      moveBlock(move) {
        apply((current) => moveBlockOp(current, move))
      },

      /**
       * @param {string} id
       * @param {Record<string, any>} patch
       * @param {string} [tagKey] Coalescing key; pass the field name for text inputs.
       */
      patch(id, patch, tagKey) {
        apply((current) => patchPropsOp(current, id, patch), {
          tag: tagKey ? patchTag(id, tagKey) : null,
        })
      },

      /**
       * @param {Partial<import('../core/types.js').DocumentSettings>} patch
       * @param {string} [tagKey]
       */
      patchSettings(patch, tagKey) {
        apply((current) => patchSettingsOp(current, patch), {
          tag: tagKey ? patchTag('settings', tagKey) : null,
        })
      },

      /** @param {string} id */
      remove(id) {
        apply((current) => removeNodeOp(current, id))
        if (id === selectedId) setSelectedId(null)
      },

      /** @param {string} id */
      duplicate(id) {
        apply((current) => duplicateNodeOp(current, id))
      },

      /**
       * @param {{ index?: number, columns?: number, widths?: number[] }} [init]
       */
      addSection(init = {}) {
        apply((current) => insertSectionOp(current, init))
      },

      /**
       * @param {string} sectionId
       * @param {number | number[]} [layout] A column count, or explicit widths.
       */
      addRow(sectionId, layout) {
        const init = Array.isArray(layout) ? { widths: layout } : { columns: layout }
        apply((current) => insertRowOp(current, { sectionId, ...init }))
      },

      /**
       * @param {string} rowId
       * @param {number} count
       */
      setRowColumns(rowId, count) {
        apply((current) => setRowColumnsOp(current, rowId, count))
      },

      /**
       * @param {string} rowId
       * @param {number[]} widths
       */
      setColumnWidths(rowId, widths) {
        apply((current) => setColumnWidthsOp(current, rowId, widths))
      },

      /**
       * Column count and widths together, as one undo step.
       *
       * @param {string} rowId
       * @param {number[]} widths
       */
      setRowLayout(rowId, widths) {
        apply((current) => setRowLayoutOp(current, rowId, widths))
      },

      /**
       * Set or clear a node's display condition.
       *
       * @param {string} id
       * @param {import('../core/types.js').Condition | null} showIf
       */
      setCondition(id, showIf) {
        apply((current) => setConditionOp(current, id, showIf))
      },

      /**
       * Set or clear a row's repeat.
       *
       * @param {string} rowId
       * @param {import('../core/types.js').Repeat | null} repeat
       */
      setRepeat(rowId, repeat) {
        apply((current) => setRepeatOp(current, rowId, repeat))
      },

      /**
       * @param {string} sectionId
       * @param {number} toIndex
       */
      moveSection(sectionId, toIndex) {
        apply((current) => moveSectionOp(current, sectionId, toIndex))
      },

      /**
       * @param {object} move
       * @param {string} move.rowId
       * @param {string} [move.toSectionId]
       * @param {number} [move.toIndex]
       */
      moveRow(move) {
        apply((current) => moveRowOp(current, move))
      },

      /**
       * Replace the whole template (used by import). Committed, not reset, so
       * undo brings the previous template back — the one thing you want after an
       * import you didn't like.
       *
       * @param {EmailDocument} next
       */
      replaceDocument(next) {
        apply(() => next)
        setSelectedId(null)
      },
    }),
    [apply, selectedId, setSelectedId],
  )

  return {
    doc,
    history,
    vars,
    lint,
    selectedId,
    selection,
    hoveredId,
    select: setSelectedId,
    setHovered: setHoveredId,
    apply,
    undo,
    redo,
    canUndo: canUndoHistory(history),
    canRedo: canRedoHistory(history),
    ...actions,
  }
}

/**
 * @param {EmailDocument} doc
 * @returns {string[]}
 */
function collectBlockIds(doc) {
  /** @type {string[]} */
  const ids = []
  for (const section of doc.sections ?? []) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const block of column.blocks ?? []) ids.push(block.id)
      }
    }
  }
  return ids
}
