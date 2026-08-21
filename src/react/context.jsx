/**
 * Editor context. One provider carries the store plus the handful of
 * environment concerns (upload hook, available blocks, drag state) that every
 * panel needs.
 *
 * @module mailkiln/react/context
 */

import { createContext, useContext } from 'react'

/**
 * @typedef {object} MailKilnContextValue
 * @property {import('./useMailKiln.js').EditorStore} store
 * @property {import('../core/types.js').BlockDef[]} blocks Palette contents, in order.
 * @property {(file: File) => Promise<string>} [onImageUpload]
 * @property {(payload: import('./panels/SendTestDialog.jsx').SendTestPayload) => Promise<void> | void} [onSendTest]
 * @property {Array<{ label: string, value: string }>} [specialLinks] Replaces the built-in
 *   list offered by every link field. An empty array removes the picker entirely.
 * @property {Record<string, import('./tools.js').ToolConfig>} [tools] Per-tool palette config.
 *   `blocks` is already filtered and ordered by it; this is here for `usageLimit`, which
 *   depends on the document and so has to be re-evaluated on every render.
 * @property {string} instanceId Unique per editor instance; used for DOM ids.
 * @property {{ activeDrag: any, dropTarget: any }} drag
 */

const MailKilnContext = createContext(/** @type {MailKilnContextValue | null} */ (null))

export const MailKilnProvider = MailKilnContext.Provider

/**
 * @returns {MailKilnContextValue}
 */
export function useMailKilnContext() {
  const value = useContext(MailKilnContext)
  if (!value) {
    throw new Error(
      'mailkiln: this component must be rendered inside <MailKiln>. If you are composing your own layout, wrap it in <MailKilnProvider>.',
    )
  }
  return value
}

/**
 * Shorthand — every panel wants the store and nothing else.
 *
 * @returns {import('./useMailKiln.js').EditorStore}
 */
export function useStore() {
  return useMailKilnContext().store
}
