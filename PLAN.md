# mailforge — a drag & drop email builder that ejects to code

> **Language: plain JavaScript (ESM).** No `.ts`/`.tsx` source files anywhere in `src/`.
> Types for consumers come from JSDoc, not from TypeScript source. See [Language decisions](#language-decisions).

## Context

`C:\Users\HP\Desktop\Email Template` is **empty**. This is a greenfield npm library.

The first draft of this plan was a competent but generic block builder — effectively a re-implementation of packages that already exist. You pushed back: you want your own package with a real reason to exist. So this plan is built around a specific, verified gap in the npm ecosystem.

### What already exists (verified against the npm registry, Jul 2026)

| Package | dl/wk | What it is | Its weakness |
|---|---|---|---|
| `@react-email/components` | ~4.3M | Code-first JSX email primitives | **no visual builder at all** |
| `react-email` | ~3.2M | Code-first framework | same |
| `react-email-editor` (Unlayer) | 235k | Drag & drop editor | iframe wrapper around a **paid hosted SaaS**; not self-hosted |
| `grapesjs-preset-newsletter` | 138k | GrapesJS newsletter preset | generic web builder retrofitted; not React; imperative jQuery-era API |
| `@usewaypoint/email-builder` | 56k | Block editor | hard-locked to **Material UI**; insert-menus, not free nested DnD |
| `mjml-react` | 28k | MJML via JSX | code-first, no editor |
| `@maily-to/core` | 18k | Tiptap slash-command composer | not a drag-drop block canvas |
| `easy-email-editor` | 14k | MJML visual editor | locked to AntD/Arco, heavy, stalling |

### The gap mailforge fills

Two separate worlds that nobody has connected:

- **The code world** (`react-email`, ~4M dl/wk) is where developers actually are — but it has **no visual editor**, so non-technical teammates can't touch it.
- **The visual world** (Unlayer, Stripo, easy-email) locks every template into a **proprietary JSON blob**, ties you to a UI framework, and is **one-way only** — no builder on npm can import an existing email back into editable blocks.

**mailforge is the bridge.** Design visually, eject to real `react-email` code you own forever. Import the templates you already have. It is the only email builder where the visual editor is an *authoring convenience*, not a *lock-in*.

### The four pillars

1. **Eject to React Email code** — export clean, readable JSX. Not an opaque blob. Nobody does this.
2. **Import / round-trip existing HTML** — paste any email HTML and get editable blocks back. Hardest pillar, biggest unlock (migration off Unlayer/Stripo/Mailchimp).
3. **Built-in deliverability linter** — live warnings while designing: Gmail 102KB clipping, Outlook-unsafe CSS, missing alt text, dark-mode contrast, no unsubscribe link.
4. **Schema-safe merge variables** — declare the data shape once (as sample data); get `{{var}}` autocomplete in the editor, lint errors on unknown paths, previews with real values, and — when you ask for it — a typed `Props` interface on the exported component.

---

## Language decisions

The pillars are unchanged. Five things move:

| # | Concern | TS plan | **JS plan** |
|---|---|---|---|
| 1 | Source files | `.ts` / `.tsx`, `strict: true` | `.js` / `.jsx`, ESM only. **JSDoc** (`@typedef`, `@param`, `@returns`) on every exported function and on the schema types. |
| 2 | Editor experience | tsc | `jsconfig.json` with `"checkJs": true` + `"strict": true`. VS Code type-checks our JSDoc in-editor and `npm run typecheck` runs the same check in CI — we get most of TS's safety net with zero TS source. |
| 3 | Types shipped to consumers | `vite-plugin-dts` | `vite-plugin-dts` needs TS, so it's dropped. `npm run types` runs `tsc -p jsconfig.dts.json` (`allowJs` + `emitDeclarationOnly`) to generate `dist/*.d.ts` **from the JSDoc**. tsc is a build-time devDependency only — no TypeScript enters the repo's source or its published dep tree. If a generated `.d.ts` is ever wrong, we hand-write that one file instead; correctness of the shipped types is non-negotiable, the generator is not. |
| 4 | Runtime safety we no longer get for free | compiler | Compensate deliberately, and treat it as a feature rather than a patch: <br>• `defineBlock()` **validates its argument at registration** and throws a named, actionable error (`mailforge: block "countdown" is missing render.html`). Plugin authors in JS get a better failure mode than a silent TS-only error. <br>• `assertDocument(doc)` — a dev-only schema check behind `process.env.NODE_ENV !== 'production'`, so bad documents fail loudly at the seam instead of producing broken HTML. <br>• `normalize()` coerces and clamps defensively (already planned; now load-bearing). |
| 5 | Pillar 4, "type-safe merge vars" | `defineVars<T>({ sample })` — generic supplies the shape | **`defineVars({ sample })` — the sample object *is* the shape.** Paths are walked out of it at runtime, so autocomplete, lint and preview all work with no generic and no declaration step. This is genuinely simpler than the TS version. For the typed export we add an optional `types` map (`{ 'order.total': 'number' }`); when absent, types are inferred from the sample's `typeof`. |

**Export language is a separate question from source language.** mailforge is written in JS, but a `react-email` consumer may well be on TS. So `renderToJsx(doc, { lang })` takes `'jsx' | 'tsx'`:

- `lang: 'jsx'` (**default**) — plain `.jsx`, props destructured, no annotations, a JSDoc `@param` block carrying the merge-var shape so TS-less editors still autocomplete.
- `lang: 'tsx'` — same tree plus the `Props` interface from `defineVars`. Costs us ~30 lines in the emitter and makes the eject pillar land for the whole `react-email` audience.

The Export menu shows both. Nothing about this puts TS in our source.

---

## Target public API

```jsx
import { MailForge } from 'mailforge'
import 'mailforge/style.css'

const vars = defineVars({
  sample: { user: { name: 'Smit' }, order: { total: 4200 } },
  // optional — only needed to override inference for the tsx export
  types: { 'order.total': 'number' },
})

<MailForge
  value={doc} onChange={setDoc}
  vars={vars}                        // powers autocomplete + lint + preview + typed export
  blocks={[countdownBlock]}          // custom blocks via defineBlock()
  theme={{ accent: '#6366f1' }}
  locale="en"
  onImageUpload={async (f) => (await upload(f)).url}
  onExport={(out) => save(out.jsx)}  // { jsx, tsx, html, mjml, text, json }
/>
```

Headless — the whole point of the core subpath:

```js
import {
  renderToJsx, renderToHtml, renderToMjml, renderToText,  // eject
  importFromHtml,                                          // round-trip
  lintDocument,                                            // deliverability
  defineBlock, defineVars, createDocument, assertDocument,
} from 'mailforge/core'   // zero React, runs in Node/CLI/CI
```

### Locked-in decisions

| Decision | Choice |
|---|---|
| npm name | **`mailforge`** — verified available (404). `@mailforge/core` also reserved for later. |
| Language | **Plain JavaScript, ESM**, JSDoc-documented, `.d.ts` generated for consumers |
| Shape | Single React package + a React-free `mailforge/core` subpath |
| Drag & drop | `@dnd-kit/core@6.3.1` + `@dnd-kit/sortable@10.0.0` |
| Styling | Tailwind v4.3, **`mf-` prefixed**, single `dist/style.css`, **no** UI framework dependency |
| Exports | React Email JSX (+ optional TSX) · HTML+inline CSS · MJML · JSON · plain text |
| Scope | Full-featured v1: nested sections, plugin API, theming, i18n, upload hook, undo/redo, merge tags |
| License | MIT, no telemetry, no account, works offline |

### Flagged assumptions

1. **MJML export emits MJML *markup only*** — it does not bundle the `mjml` compiler (~30MB, Node-only, would wreck bundle size). Consumers run `mjml`/`mjml-browser` themselves. Documented prominently.
2. **No CSS inliner dependency** (no `juice`). We own the schema, so the HTML renderer writes `style=""` inline at emit time. Zero deps, deterministic.
3. **HTML import needs a DOM parser.** In the browser we use built-in `DOMParser` (zero deps). For Node, `linkedom@0.18` is an **optional** peer dep, injectable via a `parseHtml` adapter. The importer is browser-first.
4. **`@react-email/components` is a peer dep of the *consumer's output*, not of mailforge.** We emit JSX text; we never import react-email ourselves. Keeps our dep tree tiny.
5. **Node 20+, React 18/19**, ESM-first with a CJS fallback.
6. **`typescript` is a devDependency** (declaration generation + `checkJs`). It never appears in `dependencies` or `peerDependencies`.

---

## Repo layout

```
Email Template/
├─ PLAN.md                          # ← this plan, the living design doc
├─ package.json  jsconfig.json  jsconfig.dts.json
├─ vite.config.js  vitest.config.js  eslint.config.js  .prettierrc
├─ README.md  LICENSE(MIT)  CHANGELOG.md  .gitignore
├─ .github/workflows/{ci,release}.yml
├─ src/
│  ├─ index.js                      # React entry (public barrel)
│  ├─ styles.css                    # Tailwind entry, mf- prefix, no preflight
│  ├─ core/
│  │  ├─ index.js                   # React-FREE entry — enforced by lint rule
│  │  ├─ types.js                   # JSDoc @typedef hub: EmailDocument, Section, Row,
│  │  │                             # Column, Block, BlockDef, LintIssue, VarsDef…
│  │  │                             # (types only, no runtime code — one place to read
│  │  │                             #  the whole data model, and the d.ts source of truth)
│  │  ├─ schema.js                  # createDocument, assertDocument, node factories
│  │  ├─ document.js                # PURE ops: insert/move/remove/duplicate/patch/normalize
│  │  ├─ registry.js                # defineBlock() + registration-time validation
│  │  ├─ history.js                 # undo/redo, coalescing
│  │  ├─ vars.js                    # defineVars, {{path}} parse/interpolate, path walk
│  │  ├─ theme.js                   # theme tokens -> CSS vars
│  │  ├─ render/
│  │  │  ├─ inline.js               # style object -> inline style string
│  │  │  ├─ html.js                 # PILLAR: table HTML + MSO conditionals + VML
│  │  │  ├─ jsx.js                  # PILLAR 1: react-email emitter (jsx|tsx) + formatter
│  │  │  ├─ mjml.js                 # MJML markup emitter
│  │  │  └─ text.js                 # plain-text fallback
│  │  ├─ import/
│  │  │  ├─ parseAdapter.js         # DOMParser | injected (linkedom)
│  │  │  ├─ infer.js                # PILLAR 2: table structure -> block tree
│  │  │  └─ fromHtml.js             # importFromHtml() + confidence report
│  │  ├─ lint/
│  │  │  ├─ rules/*.js              # PILLAR 3: one file per rule
│  │  │  └─ index.js                # lintDocument()
│  │  └─ blocks/                    # text heading image button divider spacer
│  │                                # social html videoThumb section row
│  └─ react/
│     ├─ MailForge.jsx  useMailForge.js  context.jsx
│     ├─ dnd/                       # DndRoot PaletteDraggable SortableBlock
│     │                             # DropIndicator DragOverlayPreview
│     ├─ panels/                    # BlockPalette Canvas Inspector Toolbar
│     │                             # PreviewFrame CodePanel LintPanel ImportDialog
│     ├─ fields/                    # text number color select spacing align
│     │                             # image varInput (autocomplete)
│     └─ i18n/                      # I18nProvider, en.js, hi.js
├─ examples/demo/                   # Vite playground — NOT published
└─ tests/                           # incl. fixtures/ real-world email HTML
```

`src/core/types.js` is new and it matters: with no TS source, the data model needs one canonical readable home. It holds only `@typedef`s, is imported by nothing at runtime, and is what `tsc` reads to emit the shipped `.d.ts`.

---

## Milestones

### M0 — Scaffold & build pipeline

1. This plan lives at `PLAN.md` in the repo root.
2. `package.json`:
   - `"type": "module"`, `"sideEffects": ["**/*.css"]`, `"files": ["dist"]`
   - `exports`: `"."`, `"./core"`, `"./style.css"` (each with `types`/`import`/`require`)
   - `peerDependencies`: `react >=18`, `react-dom >=18`; `linkedom` optional via `peerDependenciesMeta`
   - `dependencies`: **only** `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10`, `@dnd-kit/utilities`
   - `devDependencies`: vite, `@vitejs/plugin-react`, vitest, jsdom, `@testing-library/react`, eslint (+ react/react-hooks/jsdoc plugins), prettier, tailwindcss v4, typescript *(declaration emit only)*, publint, `@arethetypeswrong/cli`, changesets
   - `scripts`: `dev`, `build` (vite build && npm run types), `types`, `typecheck` (`tsc -p jsconfig.json --noEmit`), `lint`, `test`, `test:watch`
   - `publishConfig: { access: "public", provenance: true }`
3. `vite.config.js` — library mode, two entries (`index`, `core/index`), ESM+CJS, `@vitejs/plugin-react` (handles `.jsx`), externalize `react`/`react-dom`/`react/jsx-runtime`. **No** `vite-plugin-dts`.
4. `jsconfig.json` — `{ checkJs: true, strict: true, allowJs: true, jsx: "preserve", noEmit: true, moduleResolution: "bundler" }`. `jsconfig.dts.json` extends it with `declaration: true, emitDeclarationOnly: true, checkJs: false, outDir: "dist"` so declaration emit can't be blocked by an in-progress JSDoc error.
5. `src/styles.css` — **critical:** do *not* import full Tailwind; its preflight would reset the consumer's page. Tailwind v4 layered + prefixed:
   ```css
   @layer theme, components, utilities;
   @import "tailwindcss/theme.css"     layer(theme)     prefix(mf);
   @import "tailwindcss/utilities.css" layer(utilities) prefix(mf);
   @theme { --color-mf-accent: #6366f1; }
   ```
   All chrome lives under one `.mf-root` wrapper carrying theme vars + `data-mf-theme="light|dark"`.
6. `eslint.config.js` (flat) — `eslint-plugin-react`, `react-hooks`, `eslint-plugin-jsdoc` (require JSDoc on exported functions), and the two rules that keep the architecture honest:
   - `no-restricted-imports` banning `react`/`react-dom` inside `src/core/`
   - `import/extensions: always` — ESM in Node needs the `.js` in relative specifiers, and without TS's rewriting nothing else catches a missing one
7. Vitest + jsdom + `@testing-library/react`; Prettier; `examples/demo` Vite app.

### M1 — Core document model (no UI yet)

- **`types.js` + `schema.js`** — `EmailDocument { version, settings, sections[] }` → `Section { rows[] }` → `Row { columns[] }` → `Column { blocks[] }`. Stable `id` on every node. `settings`: width (600px), background, font stack, preheader. `assertDocument()` validates shape, ids, and unknown block types in dev.
- **`document.js`** — every mutation is a **pure function returning a new document**: `insertBlock`, `moveBlock` (cross-column *and* cross-section), `removeNode`, `duplicateNode`, `patchProps`, `normalize` (prune empty rows, clamp column widths to 100%). This is the seam that makes drag & drop unit-testable with no DOM.
- **`registry.js`** — `defineBlock()`; **built-in blocks use the identical API**, no privileged path. That's what makes the plugin API credible. Now also the validation gate:
  ```js
  defineBlock({
    type: 'countdown', label: 'Countdown', icon: ClockIcon,
    defaultProps: { endsAt: '', tz: 'UTC' },
    schema: [{ key: 'endsAt', type: 'text', label: 'Ends at' }],  // auto-generates the Inspector
    render: { html(p, ctx), jsx?(p, ctx), mjml?(p, ctx), text?(p, ctx) },
    lint?(p),                        // -> LintIssue[]
    parse?(el),                      // -> props | null; lets custom blocks join HTML import
  })
  ```
  Registration throws on: missing `type`, duplicate `type`, missing `render.html`, `schema` keys absent from `defaultProps`, non-function renderers. Each message names the block and the fix.
- **`history.js`** — snapshot stack, cap 50, coalesce `patchProps` on the same node within ~500ms so typing is one undo step.

### M2 — Renderers, incl. **Pillar 1: eject to code**

- `render/inline.js` → `render/html.js`: nested `<table role="presentation" cellpadding="0" cellspacing="0" border="0">`, inline styles only, `<!--[if mso]>` conditionals for buttons/spacers, VML fallback for background images, preheader span, mobile media queries in a `<style>` head block.
- **`render/jsx.js` — the flagship.** Emits a real `react-email` component. Default (`lang: 'jsx'`):
  ```jsx
  import { Html, Body, Container, Text, Button } from '@react-email/components'

  /**
   * @param {{ user: { name: string }, order: { total: number } }} props
   */
  export function Welcome({ user, order }) {
    return (
      <Html><Body style={{ backgroundColor: '#f6f6f6' }}>
        <Container style={{ maxWidth: 600 }}>
          <Text style={{ fontSize: 16 }}>Hi {user.name}</Text>
          <Button href="https://…">Track order (${order.total})</Button>
        </Container>
      </Body></Html>
    )
  }
  ```
  With `lang: 'tsx'`, the same tree plus `export interface WelcomeProps { … }` and `({ user, order }: WelcomeProps)`.

  Requirements: merge tags become **real JSX props** derived from `defineVars`; deterministic output (stable key order) so it diffs cleanly in git; a tiny built-in indent/wrap formatter — **no `prettier` dependency**; blocks with no `jsx` renderer degrade to `<div dangerouslySetInnerHTML>` so export is never blocked.
- `render/mjml.js`, `render/text.js` — same registry, different emitters.

### M3 — **Pillar 2: HTML import / round-trip**

The hardest and most valuable piece. Build it as a scored inference pass, not a rigid parser:

- **`parseAdapter.js`** — `DOMParser` when `globalThis.DOMParser` exists; else the injected `parseHtml` (docs show `linkedom`).
- **`infer.js`** — walk the DOM, match block signatures with a confidence score:
  | Signature | → block |
  |---|---|
  | `<td>` with a single `<img>` | Image |
  | `<a>` with padding + background-color (or MSO button wrapper) | Button |
  | `<hr>`, or `<td>` with `border-top` and no text | Divider |
  | `<td>` with fixed height and only `&nbsp;`/empty | Spacer |
  | `<h1>`–`<h6>` | Heading |
  | text-bearing `<td>` | Text |
  | `<table>` → `<tr>` → N×`<td>` | Section / Row / Columns |
  | run of `<a>` wrapping icon images | Social |
- **Lossless fallback is the core guarantee:** anything unmatched becomes a **raw `html` block** with its markup preserved. Import can degrade in editability but must **never lose content**. This is what makes it trustworthy where competitors don't even try.
- Reverse-detect `{{tags}}` / `*|MERGE|*` / `%recipient:x%` into mailforge vars.
- Return an **import report**: `{ document, confidence, unrecognized[], warnings[] }` so the UI can say "9 of 11 blocks fully editable, 2 kept as raw HTML."
- `ImportDialog` in the UI: paste HTML or drop a `.html` file → preview → confirm.

### M4 — **Pillar 3: deliverability linter** + **Pillar 4: merge vars**

- `lint/rules/` — one file per rule, each `{ id, level, check(doc, ctx) }` returning `LintIssue[]`:
  - Gmail clips at **102KB** (measure rendered HTML)
  - Outlook-unsafe CSS: `flex`, `grid`, `position`, `float`-heavy layout
  - image missing `alt` or explicit `width`
  - background-image with no VML fallback
  - dark-mode contrast risk (compute contrast ratio)
  - missing plain-text version / preheader / `{{unsubscribe_url}}`
  - `font-size < 12px` (iOS auto-zoom)
  - `.webp` with no fallback
  - spam-trigger phrases in subject/preheader (small curated list, `warn` only)
  - unresolved merge var not present in `defineVars`
- `LintPanel` shows issues live, grouped by severity, click-to-select the offending node.
- **`vars.js`** — `defineVars({ sample, types? })`. Walk `sample` into a flat path list (`user.name`, `order.total`) with values and inferred kinds; arrays expose `[0]` plus a `length`. `{{` in any text field opens autocomplete over those paths; unknown paths lint as errors; sample values drive the preview; the same path list drives the `Props` emit in the tsx export. **In JS the sample data is the schema** — one object, four features, no declaration step.

### M5 — Editor UI & drag-drop

**The DnD design (highest-risk part — nested drop targets are where these builders break):** one root `DndContext`.

- **Sensors:** `PointerSensor` with `activationConstraint: { distance: 4 }` (so clicks still select) + `KeyboardSensor` with `sortableKeyboardCoordinates`.
- **Two drag sources, distinguished by `data`:** palette → `useDraggable({ data: { kind: 'palette', blockType } })`; canvas block → `useSortable({ data: { kind: 'block', id, columnId, index } })`.
- **Droppables:** every `Column` is a `useDroppable` container; every block is a sortable item; plus an explicit section end-zone so you can drop *below* the last block.
- **Collision detection: custom — `pointerWithin` first, falling back to `closestCenter`.** Plain `closestCenter` misbehaves with nested containers of differing heights.
- **`measuring: { droppable: { strategy: MeasuringStrategy.Always } }`** — required, since inserting a block reflows the canvas mid-drag.
- `onDragOver` only computes target column+index and moves the `<DropIndicator/>` — **never mutates**. `onDragEnd` commits through `core/document.js` (`insertBlock` for palette drags, `moveBlock` for reorders). This keeps drags cheap and gives exactly **one undo entry per drop**.
- `<DragOverlay>` renders a light ghost, not the real block.
- **A11y:** `announcements` + `screenReaderInstructions` wired to i18n so keyboard dragging speaks correctly.

Panels: `BlockPalette` (grouped, searchable, includes custom blocks) · `Canvas` (selection outline, hover toolbar: drag/duplicate/delete) · `Inspector` (**auto-generated from each block's `schema`**, so custom blocks get a property panel free) · `Toolbar` (undo/redo ⌘Z/⇧⌘Z, desktop/mobile/text preview, import, export menu) · **`CodePanel`** (live JSX with a JSX/TSX toggle, copy and download — the pillar made visible) · `LintPanel` · `PreviewFrame` (`<iframe srcDoc>` at 600/375px — an iframe is **mandatory**, unsandboxed email HTML would leak styles into the host app).

Also: `onImageUpload` wired to the image field with progress and a URL-input fallback; every string via `useI18n()` (ship `en` + `hi`); `theme` prop → CSS vars on `.mf-root`, plus `prefers-color-scheme` dark mode.

### M6 — Tests, docs, release

Tests carry more weight here than they would in TS — they are now the only mechanical guarantee of the schema contract, so coverage of `document.js` and the renderers is not optional.

- **Unit:** `document.js` ops incl. cross-column moves and `normalize` edges; snapshot each renderer per block, **both `jsx` and `tsx`**; `defineBlock` validation errors (each throw path asserted); `assertDocument` rejecting malformed docs; vars path walking; **every lint rule**; history coalescing.
- **Round-trip property test (the signature test):** `html → import → export → import` must be **stable/idempotent**, and no text content may be lost. Run it over `tests/fixtures/` containing real-world emails (a Mailchimp export, an Unlayer export, a hand-written table email).
- **Component:** palette→canvas drop, cross-column reorder, delete, undo/redo, Inspector edits. Drive dnd-kit via the **keyboard sensor** — far more reliable in jsdom than synthetic pointer events.
- **Types check:** a `tests/types/` fixture that imports `dist/index.d.ts` and `dist/core/index.d.ts` under a real `tsc` run, asserting the generated declarations are usable (not `any` soup). This is the guard that a JS library needs and a TS one gets free.
- **README:** quickstart, prop table, `defineBlock` guide, **an honest comparison table vs Unlayer/easy-email/react-email**, the MJML caveat, import limitations, client support matrix, and a short "written in plain JS, ships hand-verified `.d.ts`" note.
- **CI:** `typecheck` (checkJs) + lint + test + build on Node 20/22; `release.yml` publishes on tag with npm provenance; `changesets` for versioning. Start at **`0.1.0`** — signal pre-1.0 while the API settles.

---

## Verification

1. `npm run build` → `dist/` has ESM + CJS + `.d.ts` + `style.css`; confirm `react`/`react-dom` are **not** bundled.
2. `npx publint && npx @arethetypeswrong/cli --pack .` → validates the `exports` map and type resolution. Catches the classic "works locally, broken on install" failure — and for a JS package it is the check that proves the JSDoc-generated declarations actually resolve.
3. **Prove Pillar 1 end-to-end:** design a template in the demo, copy the emitted JSX into a scratch `react-email` project, `npm run dev` there, confirm it renders. Repeat with the `tsx` output in a TS project and confirm it **typechecks** — **the exported code must actually compile and run.**
4. **Prove Pillar 2:** import each `tests/fixtures/` email, confirm the report's block count, edit an imported block, re-export, re-import → assert stability. Screenshot before/after.
5. **Prove Pillar 3:** build a deliberately bad email (110KB, flexbox, alt-less images, no unsubscribe) and confirm every rule fires with the right severity and node link.
6. **Prove Pillar 4:** `defineVars` with nested sample data, confirm `{{` autocomplete lists every path, that an unknown path lints, that preview uses sample values, and that the tsx export's `Props` matches the sample shape.
7. `npm run dev` in `examples/demo` → drag every block, reorder within *and across* columns, nest a row in a section, undo/redo, toggle dark mode + locale, switch previews. Drive with the Playwright MCP tools, screenshot each state.
8. **Keyboard-only pass:** Tab to a block, Space to lift, arrows to move, Space to drop. Must work with no mouse.
9. **Real email clients — the only verification that counts.** `npm pack`, install the tarball in a scratch app, export a template using every block, send via Litmus/Email-on-Acid (or manually to Outlook desktop, Gmail web + iOS, Apple Mail). **Every breakage found becomes a new lint rule.**
10. Consumer-clash check: install the tarball into an app that already uses Tailwind; confirm zero style bleed in either direction. Also install it into a **plain-JS, no-TS** consumer and confirm nothing in the package assumes a TS toolchain.

## Out of scope for v1

Real-time collaboration, AI copy generation, ESP send integrations (SendGrid/Mailchimp APIs), a hosted template marketplace, and Vue/Svelte ports. `core/` is deliberately React-free so a port stays cheap later.
