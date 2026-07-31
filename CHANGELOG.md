# Changelog

All notable changes to mailforge are documented here. This project follows
[semantic versioning](https://semver.org/); versions are managed with
[changesets](https://github.com/changesets/changesets).

## 0.1.0 — unreleased

First release. Pre-1.0 on purpose: the document schema and the `defineBlock` API
are settling, and a breaking change to either is likely before 1.0.

### The four pillars

- **Eject to React Email code.** `renderToJsx(doc, { lang: 'jsx' | 'tsx' })` emits a
  deterministic, readable component with merge variables as real props, plus
  `PreviewProps` from your sample data. No `prettier` dependency — the formatter
  is built in.
- **HTML import / round-trip.** `importFromHtml()` infers a block tree from
  arbitrary email HTML and returns a confidence report. Unrecognised markup is
  preserved as a raw `html` block: import can degrade in editability, never in
  content. Mailchimp, Mailgun and `%%NAME%%` merge tags are converted on the way in.
- **Deliverability linter.** 16 built-in rules (Gmail 102KB clipping, unsubscribe,
  Outlook-unsafe CSS, WCAG contrast, dark-mode inversion, image alt/width/format,
  VML fallbacks, plain-text, preheader, font size, spam phrases, structure,
  undeclared merge variables). Every issue links to the block at fault.
- **Schema-safe merge variables.** One `defineVars({ sample })` drives `{{`
  autocomplete, the unknown-variable rule, preview data and the exported `Props`
  interface.

### Editor

- **One tabbed side panel** — Content / Rows / Settings — that swaps to the selected
  node's properties with a back button, rather than a separate always-on inspector
  at the far edge of the screen.
- **A Rows tab** with visual column presets (1, 2, 3, 4, 2:1, 1:2, 3:1, 1:3), so
  layout is a first-class choice instead of a column-count field buried in a
  property panel. The row property panel uses the same thumbnails to *convert* an
  existing row, via `setRowLayout` — count and widths in a single undo step.
- **A blank state** on an empty template: one obvious action per common first move,
  instead of an empty dashed column in an invisible section.
- **Quick insert** — press `/` anywhere on the canvas for a searchable block list.
- **Inline rich-text editing.** Selecting a text or heading block floats a formatting
  bar over it — bold, italic, underline, link, bulleted and numbered lists, clear
  formatting — so bolding a word no longer means typing `<b>` into a textarea. The
  link popover accepts a merge variable as readily as a URL. Every commit and every
  paste passes through `normalizeRichText` in the headless core, which reduces markup
  to an email-safe subset: disallowed elements are *unwrapped* rather than dropped,
  `<span style="font-weight:700">` becomes `<b>` instead of vanishing, `<div>` and
  `<p>` become `<br>`, unsafe `href` schemes lose the anchor but keep the words, and
  a Word or Google Docs paste arrives as clean inline markup.
- **Special links.** Every `url` field — button, image, social, video, and the inline
  toolbar's link popover — offers `{{unsubscribe_url}}`, `{{preferences_url}}` and
  `{{view_in_browser_url}}`, replaceable via the `specialLinks` prop. The picker and the
  unknown-variable lint rule read one list from `mailforge/core`, so a link you insert from
  the UI can never be reported as undeclared. Previously the linter told you the
  unsubscribe link was missing and offered no way to add it.
- **Mobile controls.** A "Mobile" group on every block: `hideOnMobile` (the renderer already
  emitted a `.mf-hide-sm` rule that nothing could ever set) and `mobileFontSize` on text,
  heading and button blocks, scoped by a stable `mf-b-<id>` class. Honoured by the HTML
  export, the preview *and* the ejected JSX, whose `<Head>` now carries the matching media
  query. Dimmed rather than hidden on the design canvas, so the setting stays undoable.
- **Per-tool configuration.** `tools={{ image: { enabled: false }, button: { position: 0,
  usageLimit: 1 } }}` — react-email-editor's shape, so a config from there works unchanged.
  Filters and orders the palette and greys a tile (with a reason) once its limit is reached.
  A disabled tool is only hidden from the palette, never unregistered, so an existing
  template that uses one still renders and exports.
- **Display conditions.** `showIf` on any section, row or block — a merge path, an operator
  (`truthy`, `falsy`, `empty`, `notEmpty`, `eq`, `ne`, `gt`, `lt`) and a value. Unlayer bakes
  its customer's ESP template syntax into the exported HTML, which welds the output to one
  platform; because mailforge ejects a component, a condition becomes a **real JSX
  expression** — `{user.isPro && (…)}` — that the consumer's own bundler type-checks. HTML,
  MJML and the plain-text alternative all resolve it against the sample data, so the text
  part can never disagree with the HTML one.
- **Merge-tag loops.** `repeat` on a row (`{ path: 'order.items', as: 'item' }`). Inside it,
  `{{item.title}}` resolves per iteration and exports as `{order.items.map((item, itemIndex)
  => …)}` with a key. The loop variable is in scope for the linter, so it is never reported
  as undeclared, and the outer scope stays reachable — `{{user.name}}` still works alongside
  `{{item.title}}`.
  Both are marked rather than hidden on the design canvas, and a repeated row is drawn once
  scoped to the first item: three copies would be three DOM nodes sharing one set of ids.
- **Fixed:** the mobile breakpoint was `max-width:<content width>px`, which matches at
  exactly the content width — so a 600px viewport got the stacked mobile layout even though
  the content fits. It is now one pixel below.
- **Template names** — `settings.name`, edited inline in the toolbar or in Settings,
  distinct from the subject line. It names the exported component and its files, so a
  subject no longer has to double as an identifier. An imported `.html` file inherits
  its filename as the name.
- **Four starter documents** (Welcome, Receipt, Newsletter, Password reset) in the
  headless core, each passing the built-in linter with zero errors — enforced by a
  test. There is no template gallery in the editor UI; use them as a starting `value`.
- **Send a test email** via an `onSendTest` hook: mailforge renders the HTML and text
  and hands them over — it has no transport of its own. The dialog validates
  recipients and shows lint errors before sending.
- Section and row action strips (move up/down, duplicate, delete), plus the same
  actions in the panel header. Reordering sections previously had no UI at all.
- Mobile framing in the *design* view, not just in preview — you can lay out at
  375px rather than guessing.
- Block affordances modelled on the builders people already know: hover outline, a
  floating vertical action strip on the block's edge, a type-label tab, and a drop
  indicator with a leading dot.
- Collapsible property groups, so a text block opens with its text field rather
  than fourteen inputs.
- Nested drag & drop on `@dnd-kit`: palette → canvas, reorder within a column, and
  moves across columns *and* sections. Custom collision detection
  (`pointerWithin` then `closestCenter`) and always-on measuring, because nested
  droppables of differing heights are where these builders break.
- Full keyboard support: every block is a keyboard-reachable draggable, and palette
  entries append on Enter so drag is never the only way in.
- Undo/redo with coalescing — typing a sentence is one undo step, and a drop is
  exactly one.
- Inspector generated entirely from each block's `schema`, built-ins included.
- Sandboxed iframe preview at 600px/375px, plus a plain-text view.
- Live code panel with JSX/TSX/HTML/MJML/text/JSON, copy and download.
- Import dialog that reports before it replaces.
- Theming via CSS variables, `prefers-color-scheme` support, and `en` + `hi` locales.

### Blocks

Text, Heading, Image, Button, Divider, Spacer, Social, Video thumbnail, Raw HTML —
all nine declared through the public `defineBlock` API.

### Packaging

- ESM + CJS, `mailforge` and `mailforge/core` subpath exports, one shared registry
  across both entries and both formats.
- Written in plain JavaScript; `.d.ts` generated from JSDoc and guarded by a strict
  consumer-style fixture.
- Two runtime dependencies: `@dnd-kit/core` and `@dnd-kit/sortable`. `linkedom` is
  an optional peer dependency, needed only for HTML import in Node.
- Tailwind v4 utilities are `mf:`-prefixed with no preflight, and every chrome class
  is scoped under `.mf-root` — zero style bleed in either direction.
