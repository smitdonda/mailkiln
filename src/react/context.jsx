/**
 * Editor context. One provider carries the store plus the handful of
 * environment concerns (upload hook, available blocks, drag state) that every
 * panel needs.
 *
 * @module mailforge/react/context
 */

import { createContext, useContext } from 'react'

/**
 * @typedef {object} MailForgeContextValue
 * @property {import('./useMailForge.js').EditorStore} store
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

const MailForgeContext = createContext(/** @type {MailForgeContextValue | null} */ (null))

export const MailForgeProvider = MailForgeContext.Provider

/**
 * @returns {MailForgeContextValue}
 */
export function useMailForgeContext() {
  const value = useContext(MailForgeContext)
  if (!value) {
    throw new Error(
      'mailforge: this component must be rendered inside <MailForge>. If you are composing your own layout, wrap it in <MailForgeProvider>.',
    )
  }
  return value
}

/**
 * Shorthand — every panel wants the store and nothing else.
 *
 * @returns {import('./useMailForge.js').EditorStore}
 */
export function useStore() {
  return useMailForgeContext().store
}
