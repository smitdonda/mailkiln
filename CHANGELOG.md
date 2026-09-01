# Changelog

All notable changes to mailkiln are documented here. This project follows
[semantic versioning](https://semver.org/); versions are managed with
[changesets](https://github.com/changesets/changesets).

## 0.1.1

### Fixed

- **Server rendering no longer breaks hydration in Next.js.** `@dnd-kit` names its
  accessibility elements from a module-global counter, so every draggable's
  `aria-describedby` pointed at `DndDescribedBy-0` in the server HTML and
  `DndDescribedBy-1` once the client re-rendered — React discarded the server
  markup and Next.js logged a hydration error on every mount. The editor's
  `DndContext` now carries the instance's own `useId()`, which is stable across
  both renders. A test renders the editor twice in one process, which advances
  the counter exactly as server-then-client does.

## 0.1.0

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
  unknown-variable lint rule read one list from `mailkiln/core`, so a link you insert from
  the UI can never be reported as undeclared. Previously the linter told you the
  unsubscribe link was missing and offered no way to add it.
- **Mobile controls.** A "Mobile" group on every block: `hideOnMobile` (the renderer already
  emitted a `.mk-hide-sm` rule that nothing could ever set) and `mobileFontSize` on text,
  heading and button blocks, scoped by a stable `mk-b-<id>` class. Honoured by the HTML
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
  platform; because mailkiln ejects a component, a condition becomes a **real JSX
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
- **Typography and layout controls that email needs and CSS cannot express.**
  `settings.linkColor` is written inline onto every `<a>` in a text or heading block,
  because clients strip the head stylesheet and an anchor never inherits the colour of
  the `<div>` around it — without this a link rendered in the client's default
  blue-violet no matter what the template said. Both blocks also take a per-block **Link
  colour**, headings take a **Weight** (they were locked to bold), text takes
  **Paragraph spacing** (clients disagree on the default `<p>` margin), buttons and menus
  take **Letter spacing**, and rows and columns take **per-side borders** — per side
  because the common case is one edge, the hairline gutter between two cards.
- **Rounded buttons stay rounded in Outlook.** The Word engine ignores `border-radius`,
  so a rounded, non-full-width button ships a VML `<v:roundrect>` twin inside
  `<!--[if mso]>` with the ordinary anchor table hidden from it — exactly one of the two
  is ever visible.
- **An image can be fluid and Outlook-safe at once.** An **Outlook width (px)** field
  emits the `width` attribute alongside a percentage style, which is what a hand-written
  email does; the `image-width` rule stops asking once it is set.
- **A formatting bar on rich-text fields in the property panel**, not just on the canvas:
  bold, italic, underline, link, bulleted list and clear formatting wrap the selection, so
  editing copy there no longer means typing `<b>` and `<a href>` by hand. `textarea`
  fields — the preheader — stay plain.
- **`lintDisable`** on `<MailKiln>`: `lintDocument` has always accepted a `disable` list
  and nothing in React passed one, so a rule that is wrong for one template — brand-blue
  contrast, a deliberate 700px width — sat in the panel with no way to acknowledge it.
  The contrast rule now also checks link colour, so moving copy onto that field does not
  quietly drop it from the check.
- **Fixed:** clicking the canvas left focus on `<body>` in Chrome, so `/`, Delete, Escape
  and Ctrl+Z did nothing until you happened to tab into a control. Focus is re-claimed a
  frame after the pointer event's own default action.
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

Text, Heading, Image, Button, Divider, Spacer, Social, **Menu**, Video thumbnail, Raw
HTML — all ten declared through the public `defineBlock` API.

The Menu block is the one most footers need and that a text block full of hand-written
`<a>` tags served badly: label + URL pairs with merge variables, horizontal or vertical
layout, an optional separator with its own colour. The HTML target emits two paths — a
one-row table for Outlook, whose engine ignores `inline-block` and would otherwise stack
every link, and plain anchors everywhere else so a long menu wraps on a narrow screen.
MJML exports as `mj-navbar`, and the importer recognises a container of text links as a
menu, inferring the separator and link colour.

### Packaging

- ESM + CJS, `mailkiln` and `mailkiln/core` subpath exports, one shared registry
  across both entries and both formats.
- Written in plain JavaScript; `.d.ts` generated from JSDoc and guarded by a strict
  consumer-style fixture.
- Two runtime dependencies: `@dnd-kit/core` and `@dnd-kit/sortable`. `linkedom` is
  an optional peer dependency, needed only for HTML import in Node.
- Tailwind v4 utilities are `mk:`-prefixed with no preflight, and every chrome class
  is scoped under `.mk-root` — zero style bleed in either direction.
