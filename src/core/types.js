/**
 * mailkiln data model — types only, no runtime code.
 *
 * This file is the single readable description of every shape mailkiln passes
 * around, and it is what `tsc` reads to emit the `.d.ts` files we publish. If
 * you change a shape, change it here first.
 *
 * @module mailkiln/core/types
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Padding / margin, in px. Always all four sides — no shorthand, so renderers
 * and the Inspector never have to normalize.
 *
 * @typedef {object} Spacing
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 * @property {number} left
 */

/**
 * A CSS declaration map in camelCase, exactly like React's `style` prop.
 * Values are strings or numbers; numbers are treated as px by the inliner.
 *
 * @typedef {Record<string, string | number | undefined>} StyleObject
 */

/**
 * @typedef {'left' | 'center' | 'right'} Align
 */

// ---------------------------------------------------------------------------
// Document tree: EmailDocument > Section > Row > Column > Block
// ---------------------------------------------------------------------------

/**
 * Document-wide settings. `width` is the classic 600px email body width.
 *
 * @typedef {object} DocumentSettings
 * @property {string} name What *you* call this template ("Welcome email v2"). Never sent
 *   or rendered — it names the exported component and its files, and gives your app
 *   something to list. Distinct from `subject`, which the recipient reads.
 * @property {string} subject Subject line (never rendered into the body; used by lint + preview).
 * @property {string} preheader Inbox preview text, rendered as a hidden span.
 * @property {number} width Content width in px.
 * @property {string} backgroundColor Page background, outside the content column.
 * @property {string} contentBackgroundColor Background of the content column itself.
 * @property {string} fontFamily Font stack applied to every text block by default.
 * @property {string} textColor Default text colour.
 * @property {string} linkColor Default link colour.
 * @property {string} [language] BCP-47 tag emitted as `<html lang>`.
 * @property {boolean} [darkModeAware] Emit `color-scheme` + dark-mode meta.
 */

/**
 * A leaf of the tree: one editable unit (text, image, button, …). `type` must
 * resolve to a registered {@link BlockDef}.
 *
 * @typedef {object} Block
 * @property {string} id
 * @property {string} type
 * @property {Record<string, any>} props
 * @property {Condition} [showIf] Render only when this evaluates true. See core/conditions.js.
 */

/**
 * A display condition. Kept to a path, an operator and (sometimes) a value so it
 * can be both evaluated against sample data and emitted as a JSX expression.
 *
 * @typedef {object} Condition
 * @property {string} path Merge path, e.g. `user.isPro`.
 * @property {'truthy' | 'falsy' | 'empty' | 'notEmpty' | 'eq' | 'ne' | 'gt' | 'lt'} op
 * @property {string | number | boolean} [value] Required by eq/ne/gt/lt.
 */

/**
 * @typedef {object} ColumnProps
 * @property {number} width Percentage of the row, 1–100. Widths in a row are clamped to sum to 100.
 * @property {Spacing} padding
 * @property {string} [backgroundColor]
 * @property {'top' | 'middle' | 'bottom'} [verticalAlign]
 */

/**
 * @typedef {object} Column
 * @property {string} id
 * @property {'column'} type
 * @property {ColumnProps} props
 * @property {Block[]} blocks
 */

/**
 * @typedef {object} RowProps
 * @property {Spacing} padding
 * @property {string} [backgroundColor]
 * @property {boolean} [stackOnMobile] Default true — columns become full width under 600px.
 * @property {number} [gap] Gutter between columns in px.
 */

/**
 * @typedef {object} Row
 * @property {string} id
 * @property {'row'} type
 * @property {RowProps} props
 * @property {Column[]} columns
 * @property {Condition} [showIf]
 * @property {Repeat} [repeat] Render once per item of an array. See core/conditions.js.
 */

/**
 * Repeat a row over an array in the sample data.
 *
 * @typedef {object} Repeat
 * @property {string} path Merge path to an array, e.g. `order.items`.
 * @property {string} as Loop variable name, e.g. `item` — written as `{{item.title}}` inside the row.
 * @property {number} [previewCount] How many iterations the canvas and preview show. Default 3.
 */

/**
 * @typedef {object} SectionProps
 * @property {Spacing} padding
 * @property {string} [backgroundColor]
 * @property {string} [backgroundImage] URL. Gets a VML fallback in the HTML renderer.
 * @property {boolean} [fullWidth] Stretch the background edge-to-edge, keep content at `settings.width`.
 * @property {string} [borderTop] CSS border shorthand.
 * @property {string} [borderBottom]
 */

/**
 * @typedef {object} Section
 * @property {string} id
 * @property {'section'} type
 * @property {SectionProps} props
 * @property {Row[]} rows
 * @property {Condition} [showIf]
 */

/**
 * The whole template. This is the only thing a consumer needs to persist, and
 * it is plain JSON — no classes, no functions, no proprietary encoding.
 *
 * @typedef {object} EmailDocument
 * @property {number} version Schema version. Bumped only on breaking shape changes.
 * @property {DocumentSettings} settings
 * @property {Section[]} sections
 */

/**
 * Any addressable node in the tree.
 *
 * @typedef {EmailDocument | Section | Row | Column | Block} AnyNode
 */

/**
 * @typedef {'document' | 'section' | 'row' | 'column' | 'block'} NodeKind
 */

/**
 * The result of resolving an id against a document. Everything the callers of
 * `document.js` need in order to act on a node without re-walking the tree.
 *
 * Modelled as a discriminated union so `if (loc.kind === 'column')` narrows
 * `loc.node` to a `Column` — without that, every caller has to cast, and a cast
 * is exactly where a JS codebase loses the guarantee it just paid for.
 *
 * @typedef {{ kind: 'section', node: Section, parent: EmailDocument, index: number, path: string[] }} SectionLocation
 */

/**
 * @typedef {{ kind: 'row', node: Row, parent: Section, index: number, path: string[] }} RowLocation
 */

/**
 * @typedef {{ kind: 'column', node: Column, parent: Row, index: number, path: string[] }} ColumnLocation
 */

/**
 * @typedef {{ kind: 'block', node: Block, parent: Column, index: number, path: string[] }} BlockLocation
 */

/**
 * @typedef {SectionLocation | RowLocation | ColumnLocation | BlockLocation} NodeLocation
 */

// ---------------------------------------------------------------------------
// Block registry
// ---------------------------------------------------------------------------

/**
 * One row of the auto-generated Inspector. `type` picks the field component.
 *
 * @typedef {object} FieldDef
 * @property {string} key Key inside the block's `props`. Dotted paths are supported (`padding.top`).
 * @property {'text' | 'textarea' | 'richtext' | 'number' | 'color' | 'select' | 'spacing'
 *   | 'align' | 'image' | 'toggle' | 'url' | 'link' | 'font' | 'range' | 'list'} type
 *   `url` and `link` are the same control — a text box with merge-variable
 *   autocomplete plus a picker for the ESP's special links.
 * @property {string} label
 * @property {string} [help]
 * @property {string} [placeholder]
 * @property {Array<{ value: string | number, label: string }>} [options] For `select`.
 * @property {FieldDef[]} [itemSchema] For `list` — the fields of a single item.
 * @property {string} [addLabel] For `list` — the add-button label.
 * @property {Record<string, any>} [itemDefaults] For `list` — a new item's starting props.
 * @property {number} [min] For `number` / `range`.
 * @property {number} [max]
 * @property {number} [step]
 * @property {string} [group] Optional Inspector grouping label.
 * @property {boolean} [vars] Enable `{{` merge-var autocomplete on this field.
 * @property {(props: Record<string, any>) => boolean} [when] Show conditionally.
 */

/**
 * What a renderer is handed. `resolve` interpolates merge variables using the
 * sample data, so renderers never deal with `{{…}}` themselves unless they
 * want to (the JSX emitter does, deliberately).
 *
 * @typedef {object} RenderContext
 * @property {EmailDocument} doc
 * @property {DocumentSettings} settings
 * @property {VarsDef | null} vars
 * @property {(text: string) => string} resolve Interpolate `{{path}}` with sample values.
 * @property {Record<string, any>} scope What `resolve` and display conditions read. Normally
 *   `vars.sample`; inside a repeated row it also carries the loop variable.
 * @property {boolean} [raw] True when `{{tags}}` are left intact (the JSX emitter).
 * @property {'html' | 'jsx' | 'mjml' | 'text'} target
 * @property {Record<string, any>} [options] Target-specific options.
 */

/**
 * A block's renderers. Only `html` is required — every other target degrades
 * gracefully, so a third-party block can never block an export.
 *
 * @typedef {object} BlockRenderers
 * @property {(props: Record<string, any>, ctx: RenderContext) => string} html
 * @property {(props: Record<string, any>, ctx: RenderContext) => JsxNode | string} [jsx]
 * @property {(props: Record<string, any>, ctx: RenderContext) => string} [mjml]
 * @property {(props: Record<string, any>, ctx: RenderContext) => string} [text]
 */

/**
 * A block definition. Built-in blocks are declared with this exact API — there
 * is no privileged path — which is what makes the plugin API trustworthy.
 *
 * @typedef {object} BlockDef
 * @property {string} type Unique, kebab or camel; used in the document JSON.
 * @property {string} label Human label for the palette.
 * @property {string} [group] Palette grouping, e.g. 'Content' / 'Layout'.
 * @property {any} [icon] Anything your palette can render (React node, string, URL).
 * @property {Record<string, any>} defaultProps
 * @property {FieldDef[]} [schema] Drives the Inspector. Keys must exist in `defaultProps`.
 * @property {BlockRenderers} render
 * @property {(props: Record<string, any>, ctx: LintContext) => LintIssue[]} [lint]
 * @property {(el: Element, ctx: ParseContext) => Record<string, any> | null} [parse]
 * @property {number} [importPriority] Higher wins when several blocks match the same element.
 * @property {boolean} [void] True if the block renders nothing editable inline (spacer, divider).
 * @property {string} [inlineEdit] Prop key that canvas inline editing writes to. The
 *   block's `render.html` must mark the element holding that value with
 *   `data-mk-edit` when `ctx.options.editable` is set — only the block knows which
 *   element that is, and guessing at it corrupts the prop.
 */

// ---------------------------------------------------------------------------
// JSX emitter
// ---------------------------------------------------------------------------

/**
 * A minimal JSX AST. The emitter formats these; blocks may return one instead
 * of a string so indentation and prop ordering stay consistent.
 *
 * @typedef {object} JsxElement
 * @property {string} tag
 * @property {Record<string, any>} [props] Values are emitted as literals; wrap in `raw()` for expressions.
 * @property {JsxNode[]} [children]
 * @property {boolean} [selfClose]
 * @property {string[]} [imports] Component names to add to the react-email import.
 */

/**
 * @typedef {{ __raw: string }} JsxRaw A pre-formatted expression, emitted verbatim.
 */

/**
 * `{expression && (child)}` — a display condition in the ejected component.
 *
 * @typedef {{ __guard: string, child: any }} JsxGuard
 */

/**
 * `{expression.map((params) => (child))}` — a repeated row in the ejected component.
 *
 * @typedef {{ __loop: string, params: string, child: any }} JsxLoop
 */

/**
 * @typedef {JsxElement | JsxRaw | JsxGuard | JsxLoop | string | number | null | undefined} JsxLeaf
 */

/**
 * Split into leaf + array rather than a self-referential alias: a recursive
 * `@typedef` is a TS2456 error in JSDoc, and `el()` flattens its children anyway
 * so one level of nesting is all the emitter ever sees.
 *
 * @typedef {JsxLeaf | JsxLeaf[]} JsxNode
 */

// ---------------------------------------------------------------------------
// Merge variables (pillar 4)
// ---------------------------------------------------------------------------

/**
 * One declared variable path, derived by walking the sample object.
 *
 * @typedef {object} VarPath
 * @property {string} path Dotted path, e.g. `order.total`.
 * @property {'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown'} kind
 * @property {any} sample The value found at that path.
 * @property {boolean} leaf True when it is directly interpolatable.
 */

/**
 * The value returned by `defineVars`. In JS the sample object *is* the schema.
 *
 * @typedef {object} VarsDef
 * @property {Record<string, any>} sample
 * @property {VarPath[]} paths
 * @property {Record<string, string>} types Explicit type overrides, `{ 'order.total': 'number' }`.
 * @property {(path: string) => boolean} has
 * @property {(path: string) => any} get
 */

// ---------------------------------------------------------------------------
// Lint (pillar 3)
// ---------------------------------------------------------------------------

/**
 * @typedef {'error' | 'warn' | 'info'} LintLevel
 */

/**
 * @typedef {object} LintIssue
 * @property {string} id Rule id, e.g. `gmail-clipping`.
 * @property {LintLevel} level
 * @property {string} message What is wrong, in one sentence.
 * @property {string} [hint] How to fix it.
 * @property {string} [nodeId] Node to select when the user clicks the issue.
 * @property {Record<string, any>} [data] Rule-specific detail (measured size, contrast ratio…).
 */

/**
 * @typedef {object} LintContext
 * @property {EmailDocument} doc
 * @property {VarsDef | null} vars
 * @property {string} html Rendered HTML, computed once and shared by every rule.
 * @property {string} text Rendered plain text.
 * @property {(id: string) => NodeLocation | null} locate
 */

/**
 * @typedef {object} LintRule
 * @property {string} id
 * @property {LintLevel} level Default level for issues this rule reports.
 * @property {string} title
 * @property {string} [docs] One-line rationale, shown in the panel.
 * @property {(ctx: LintContext) => LintIssue[]} check
 */

/**
 * @typedef {object} LintResult
 * @property {LintIssue[]} issues
 * @property {number} errors
 * @property {number} warnings
 * @property {number} infos
 * @property {number} sizeBytes Rendered HTML size, the number the Gmail rule cares about.
 */

// ---------------------------------------------------------------------------
// Import (pillar 2)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ParseContext
 * @property {(el: Element) => StyleObject} style Parsed inline styles of an element.
 * @property {(el: Element) => string} text Collapsed text content.
 * @property {(html: string) => string} detectVars Rewrite foreign merge syntax to `{{path}}`.
 * @property {Document} document
 */

/**
 * @typedef {object} ImportWarning
 * @property {string} code
 * @property {string} message
 * @property {string} [nodeId]
 */

/**
 * What `importFromHtml` returns. The report is the honest part: it says what
 * mailkiln understood and what it kept as raw markup.
 *
 * @typedef {object} ImportReport
 * @property {EmailDocument} document
 * @property {number} confidence 0–1, share of blocks that were recognized.
 * @property {number} blockCount
 * @property {number} recognized
 * @property {string[]} unrecognized Node ids kept as raw `html` blocks.
 * @property {ImportWarning[]} warnings
 * @property {string[]} detectedVars Merge-var paths found in the source.
 */

/**
 * @typedef {object} ImportOptions
 * @property {(html: string) => Document} [parseHtml] Required outside the browser (e.g. linkedom).
 * @property {boolean} [keepUnknownAsHtml] Default true. Turning it off drops unmatched markup — don't.
 * @property {DocumentSettings} [settings] Override inferred settings.
 */

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/**
 * @typedef {object} History
 * @property {EmailDocument[]} past
 * @property {EmailDocument} present
 * @property {EmailDocument[]} future
 * @property {string | null} lastTag Coalescing key of the last commit.
 * @property {number} lastAt Timestamp of the last commit.
 * @property {number} limit
 */

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ExportBundle
 * @property {string} jsx React Email component, plain JSX.
 * @property {string} tsx Same component with a typed `Props` interface.
 * @property {string} html Table-based HTML with inline styles.
 * @property {string} mjml MJML markup (not compiled — see README).
 * @property {string} text Plain-text alternative.
 * @property {string} json The document, pretty-printed.
 */

export {}
