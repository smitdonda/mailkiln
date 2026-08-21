/**
 * `mailkiln/core` — the headless half.
 *
 * Zero React, zero DOM assumptions (the importer asks for a parser rather than
 * requiring one), so this runs in Node, a CLI, a CI job or a Lambda. An ESLint
 * rule fails the build if anything under `src/core/` imports React, which is what
 * keeps a future Vue or Svelte port cheap.
 *
 * @module mailkiln/core
 */

// --- document model --------------------------------------------------------
export {
  SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  createDocument,
  createSection,
  createRow,
  createColumn,
  createBlock,
  cloneWithNewIds,
  createId,
  resetIds,
  reserveIds,
  evenWidths,
  spacing,
  deepClone,
  validateDocument,
  assertDocument,
} from './schema.js'

export { isDev } from './env.js'

export {
  findNode,
  nodeKind,
  listBlocks,
  listColumns,
  insertBlock,
  moveBlock,
  removeBlock,
  removeNode,
  duplicateNode,
  patchProps,
  patchSettings,
  insertSection,
  insertRow,
  moveSection,
  moveRow,
  setRowColumns,
  setColumnWidths,
  setRowLayout,
  setCondition,
  setRepeat,
  settleDrafts,
  updateSection,
  updateRow,
  updateColumn,
  updateBlocks,
  normalize,
} from './document.js'

// --- registry & blocks -----------------------------------------------------
export {
  defineBlock,
  registerBlock,
  unregisterBlock,
  validateBlockDef,
  getBlockDef,
  requireBlockDef,
  hasBlock,
  allBlocks,
  parsableBlocks,
  clearRegistry,
} from './registry.js'

export {
  builtinBlocks,
  textBlock,
  headingBlock,
  imageBlock,
  buttonBlock,
  dividerBlock,
  spacerBlock,
  socialBlock,
  htmlBlock,
  videoThumbBlock,
  PADDING_FIELD,
  ALIGN_FIELD,
  BACKGROUND_FIELD,
  FONT_FIELD,
  FONT_OPTIONS,
  WEIGHT_OPTIONS,
  commonProps,
  stripTags,
} from './blocks/index.js'

// --- history ---------------------------------------------------------------
export {
  createHistory,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  reset,
  patchTag,
  HISTORY_LIMIT,
  COALESCE_MS,
} from './history.js'

// --- merge variables (pillar 4) -------------------------------------------
export {
  defineVars,
  walkSample,
  getPath,
  findVarPaths,
  documentVarPaths,
  interpolate,
  documentLocalVars,
  varRoots,
  kindOf,
  tsTypeForRoot,
  emitPropsInterface,
  emitPropsJsdoc,
  foreignVarsToMailkiln,
  FOREIGN_VAR_SYNTAXES,
  VAR_PATTERN,
} from './vars.js'

// --- rich text -------------------------------------------------------------
export { normalizeRichText, normalizePastedHtml, RICHTEXT_TAGS } from './richtext.js'
export { SPECIAL_LINKS, SPECIAL_LINK_PATHS, isSpecialLink } from './links.js'

// --- display conditions & repeats -------------------------------------------
export {
  CONDITION_OPS,
  DEFAULT_PREVIEW_COUNT,
  coerceValue,
  conditionDraft,
  conditionExpression,
  conditionPaths,
  conditionSummary,
  evaluateCondition,
  normalizeCondition,
  normalizeRepeat,
  repeatDraft,
  repeatPaths,
  repeatScopes,
} from './conditions.js'

// --- theme -----------------------------------------------------------------
export { themeToCssVars, unknownThemeKeys, THEME_VARS } from './theme.js'

// --- renderers (pillar 1) --------------------------------------------------
export {
  renderToHtml,
  renderSectionsHtml,
  renderBlockHtml,
  renderBlockContent,
} from './render/html.js'
export {
  renderToJsx,
  renderToTsx,
  toComponentName,
  documentName,
  REACT_EMAIL_COMPONENTS,
} from './render/jsx.js'
export { renderToMjml } from './render/mjml.js'
export { renderToText, renderBlockText, wrap } from './render/text.js'
export { createRenderContext, withScope } from './render/context.js'
export {
  el,
  raw,
  guard,
  loop,
  isRaw,
  isElement,
  isGuard,
  isLoop,
  varsToChildren,
  varsToTemplate,
  varsToAttr,
  needsInnerHtml,
} from './render/jsxNode.js'
export {
  styleToString,
  styleAttr,
  mergeStyles,
  spacingToCss,
  escapeHtml,
  escapeAttr,
  attrs,
  tableOpen,
  TABLE_CLOSE,
  mso,
  px,
} from './render/inline.js'

// --- import (pillar 2) -----------------------------------------------------
export { importFromHtml, inferSettings } from './import/fromHtml.js'
export {
  createParseContext,
  matchBlock,
  parseBlocks,
  findSectionTables,
  sectionFromTable,
  walkTable,
  walkContainer,
  hasContent,
  isHidden,
} from './import/infer.js'
export { getParser, parseStyleAttribute, collapsedText, camelize } from './import/parseAdapter.js'

// --- lint (pillar 3) -------------------------------------------------------
export { lintDocument, builtinRules, groupByNode, byteLength, GMAIL_LIMIT } from './lint/index.js'
export { contrastRatio, parseColor, luminance } from './lint/color.js'
export { eachBlock, blocksOfType, effectiveBackground } from './lint/walk.js'

// --- starter templates -----------------------------------------------------
export {
  builtinTemplates,
  getTemplate,
  welcomeTemplate,
  receiptTemplate,
  newsletterTemplate,
  passwordResetTemplate,
} from './templates/index.js'

// --- the export bundle -----------------------------------------------------
export { exportDocument, exportFilenames } from './export.js'
