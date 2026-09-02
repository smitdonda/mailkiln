/**
 * `mailkiln` — a drag & drop email builder that ejects to React Email code.
 *
 * The React entry point. Everything headless is also re-exported here for
 * convenience, but `mailkiln/core` is the import to use in Node, a CLI or CI: it
 * carries no React and no DOM assumptions.
 *
 * @module mailkiln
 */

// --- the editor ------------------------------------------------------------
export { MailKiln } from './react/MailKiln.jsx'
export { useMailKiln } from './react/useMailKiln.js'
export { MailKilnProvider, useMailKilnContext, useStore } from './react/context.jsx'

// --- panels, for consumers assembling their own layout ---------------------
export { Toolbar } from './react/panels/Toolbar.jsx'
export { BlockPalette } from './react/panels/BlockPalette.jsx'
export { Canvas } from './react/panels/Canvas.jsx'
export { StructureTree } from './react/panels/StructureTree.jsx'
export { SidePanel } from './react/panels/SidePanel.jsx'
export { RowLayouts } from './react/panels/RowLayouts.jsx'
export { LayoutPicker } from './react/panels/LayoutPicker.jsx'
export { ROW_PRESETS, matchPreset } from './react/rowPresets.js'
export { BlankState, isPristine } from './react/panels/BlankState.jsx'
export { QuickInsert } from './react/panels/QuickInsert.jsx'
export { Inspector, NodeFields, DocumentFields } from './react/panels/Inspector.jsx'
export { PreviewFrame, DEVICE_WIDTHS } from './react/panels/PreviewFrame.jsx'
export { LintPanel } from './react/panels/LintPanel.jsx'

// --- drag & drop pieces ----------------------------------------------------
export { DndRoot, useDragState } from './react/dnd/DndRoot.jsx'
export { SortableBlock } from './react/dnd/SortableBlock.jsx'
export { PaletteDraggable } from './react/dnd/PaletteDraggable.jsx'
export { DropIndicator } from './react/dnd/DropIndicator.jsx'
export { DragOverlayPreview } from './react/dnd/DragOverlayPreview.jsx'
export { resolveDropTarget, isNoopDrop, activeCenterY } from './react/dnd/resolveDrop.js'

// --- fields ----------------------------------------------------------------
export { Field, getIn, VarInput, ImageField, ListField } from './react/fields/index.jsx'

// --- i18n ------------------------------------------------------------------
export { I18nProvider, useI18n, locales } from './react/i18n/index.jsx'

// --- icons -----------------------------------------------------------------
export * from './react/icons.jsx'

// --- everything headless ---------------------------------------------------
export * from './core/index.js'
