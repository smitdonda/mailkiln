# mailkiln vs. react-email-editor (Unlayer) — gap analysis & roadmap

_Compared 31 July 2026 against Unlayer's live documentation, not from memory._

Two caveats before the tables: Unlayer gates much of this behind a paid hosted project (`projectId`
plus domain whitelisting), so "they have it" often means "they host it". And their docs do not publish
an exhaustive tool list, so two rows below are marked unverified.

**Sources:**
[tools](https://docs.unlayer.com/builder/tools) ·
[custom tools](https://docs.unlayer.com/builder/tools/custom) ·
[appearance](https://docs.unlayer.com/builder/appearance) ·
[images](https://docs.unlayer.com/builder/images) ·
[merge tags](https://docs.unlayer.com/builder/dynamic-content/merge-tags) ·
[display conditions](https://docs.unlayer.com/builder/1.248.0/dynamic-content/display-conditions) ·
[export HTML](https://docs.unlayer.com/builder/export-html) ·
[export plain text](https://docs.unlayer.com/builder/export-plain-text) ·
[AI assistant](https://docs.unlayer.com/ai/assistant) ·
[react-email-editor README](https://github.com/unlayer/react-email-editor)

---

## 1. Where mailkiln already wins

Listing these so we don't accidentally "fix" them:

| | mailkiln | Unlayer |
|---|---|---|
| Ejects editable code | react-email JSX **and** TSX, deterministic | HTML only |
| Imports existing HTML | yes, with a confidence report | no |
| Deliverability linter | 16 rules, click-to-fix | none |
| Headless usage | full React-free core (Node/CLI/CI) | none — iframe + hosted service |
| Document format | plain JSON you own | proprietary |
| Runs offline, no account | yes | no |
| Licence | MIT | proprietary tiers |
| Block search / `/` quick-insert | yes | no |
| Full keyboard operation | yes | partial |

---

## 2. What's missing

| Capability | Unlayer | mailkiln today | Verdict |
|---|---|---|---|
| **Rich-text toolbar** (bold, italic, link, lists) | yes | **none** — you must type raw HTML | **Build — biggest gap** |
| **Per-tool config** (enable/disable, order, usage limit, icon) | yes | no | **Build** |
| **Mobile controls** (hide on mobile, mobile font size) | yes | CSS emitted but no UI | **Build** |
| **Special links** (unsubscribe / view-in-browser picker) | yes | no | **Build** |
| **Display conditions** (conditional blocks) | yes, ESP syntax | no | **Build — and beat it** |
| **Merge-tag loops** (repeat over an array) | yes, ESP syntax | no | **Build — and beat it** |
| Saved / reusable blocks ("My blocks") | yes | no | Later |
| Custom fonts (webfont + fallback) | yes | fixed list of 9 | Later |
| RTL output | yes | no | Later |
| Image editing / stock images / media library | yes (hosted) | `onImageUpload` only | Expose a hook |
| Social icon set | bundled icons | you supply URLs | Expose a hook |
| Menu / navigation block | yes | no | Later |
| Auto video thumbnail from a URL | yes (network call) | manual URL | Skip |
| Export to image / PDF | yes (cloud API) | no | **Out of scope** |
| AI assistant | yes | no | **Out of scope** |
| Real-time collaboration / comments | yes | no | **Out of scope** |
| Page & popup builder modes | yes | email only | **Out of scope** |
| Hosted template gallery, version history | yes | no | **Out of scope** — consumer's job |
| Form tool | yes (page mode) | no | **Out of scope** — no forms in email |

_Unverified: whether Unlayer still ships an "audit" tool, and their complete built-in tool list._

---

## 3. Proposed work

> **Status, 31 July 2026: Tier 1 and Tier 2 are built.** Items 1–6 below all shipped; the
> tables above describe the gap as it stood *before* that work. Tier 3 and the "not doing"
> list are unchanged. Two things came out differently from the plan and are documented in the
> README: the special-links picker upgraded the existing `url` field type instead of adding a
> new `link` one (so every href in the package got it for free), and conditional nodes are
> *marked* on the design canvas rather than hidden — a node the editor refuses to draw is a
> node you cannot select, and a condition you cannot select is one you cannot remove.

### Tier 1 — the editor is hard to use without these

#### 1. Rich-text toolbar
**New:** `src/core/richtext.js`, `src/react/dnd/InlineToolbar.jsx`

A floating toolbar over the selected text/heading block: **bold, italic, underline, link, bullet and
numbered lists, clear formatting**. The link button opens a small popover accepting a URL *or* a merge
variable.

The risk isn't the toolbar — it's what `contentEditable` produces. `execCommand` emits `<span style>`,
`<font>` and `<div>`, none of which are clean or safe in email. So every commit runs through a
**normalizer in core**: allow only `b/strong, i/em, u, a[href], br, ul, ol, li` plus `span` with a
whitelisted style set; unwrap everything else; drop empty nodes. Putting it in `core/` makes it
headlessly testable and lets the HTML importer reuse it. Setting `styleWithCSS(false)` and
`defaultParagraphSeparator = 'br'` gets `<b>` rather than styled spans.

Hooks into the existing `data-mk-edit` mechanism in `SortableBlock.jsx` — no new editing model.

## 4. Prioritised roadmap

Based on what drives adoption, ordered by effort/impact:

### Phase 1 — Quick wins (high impact, low risk)

1. **Rich-text inline editing**
   - When a text block is selected, render a minimal inline toolbar (Bold, Italic, Underline, Link, Unlink, Clear Formatting) positioned above it.
   - Use `contentEditable` on the block's editable element only while selected, serialising back to the block's `text` property on blur / change.
   - Preserves HTML formatting while typing.

2. **Mobile visibility & font sizing**
   - `.mk-hide-sm` is **already emitted** by the HTML renderer and nothing ever applies it. Wire a
     `hideOnMobile: true` toggle to any block, section, or row.
   - Add a `mobileFontSize` field to text/heading blocks that emits a `@media (max-width: 599px)` rule
     in the `<style>` head keyed on a stable `mk-b-<id>` class. Adds a "Mobile" group to the Inspector.

#### 4. Special links
**New:** `src/react/fields/LinkField.jsx`

A `link` field type offering `{{unsubscribe_url}}`, `{{preferences_url}}`,
`{{view_in_browser_url}}` alongside free URL entry, extensible via a `specialLinks` prop. Pairs
directly with the `unsubscribe` lint rule — today the linter tells you the link is missing and gives
you no way to add it.

### Tier 2 — where we can be *better*, not just equal

#### 5. Display conditions  ·  6. Merge-tag loops
**New:** `src/core/conditions.js` · **Modified:** `render/html.js`, `render/jsx.js`, `vars.js`

Unlayer bakes ESP-specific template syntax (`{% if %}`, `{% for %}`) into the HTML, which locks the
output to one platform. We can emit **real JSX**:

```jsx
{user.isPro && (<Section>…</Section>)}
{order.items.map((item, index) => (<Row key={index}>…</Row>))}
```

Schema: `showIf` on any node, `repeat` on a row. HTML and the canvas resolve against the sample data,
so you see a real branch and a real three-item list while designing; the JSX/TSX export emits the
conditional and the `.map()`.

The fiddly part is per-iteration scope: `{{item.title}}` inside a repeat needs a scoped resolver in
`vars.js`, and the linter must know `item` is in scope so it doesn't report it as undeclared.

This is the most differentiated item on the list — it extends pillars 1 and 4 instead of copying a
competitor.

### Tier 3 — if wanted later

Saved blocks (needs `savedBlocks` + `onSaveBlock` hooks), custom fonts, RTL via
`settings.direction`, an `onPickImage` hook so consumers can plug in their own media library or stock
provider, and a menu/navigation block.

---

## 4. Explicitly not doing

AI assistant · real-time collaboration · image/PDF export · page and popup modes · hosted template
gallery · version history · form tool.

Each one either needs a backend we deliberately don't have, or belongs to the consuming app. Better to
say so in the README than to half-ship them.

---

## 5. Verification for whatever we build

1. `npm test` — unit tests for the richtext normalizer (every disallowed tag and attribute), tool
   filtering, condition/loop rendering across all four targets, scoped variable resolution.
2. `npm run typecheck && npm run lint && npm run build && npx publint`.
3. Browser pass on `npm run dev`: bold a word, insert a merge-variable link, confirm `props.text`
   holds only whitelisted markup; toggle hide-on-mobile and find the media query in the Code panel;
   add a repeat over `order.items` and see three rows on canvas and a `.map()` in the JSX tab.
4. Round-trip: new markup must survive `html → import → export → import` unchanged.

---

## 6. Suggested order

Tier 1 items 1–4 first — they're what makes the editor usable day to day. Then Tier 2 as a separate
pass. Item 1 alone is roughly half of Tier 1's effort, because of the normalizer and its tests.
