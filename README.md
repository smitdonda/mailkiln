# mailkiln

**A drag & drop email builder that ejects to real React Email code.**

Design visually. Export a component you own. Import the templates you already have.

[![npm](https://img.shields.io/npm/v/mailkiln.svg)](https://www.npmjs.com/package/mailkiln)
[![license](https://img.shields.io/npm/l/mailkiln.svg)](./LICENSE)

```bash
npm install mailkiln
```

---

## Why this exists

Email tooling is split in two, and nothing connects the halves.

- **The code world** — [`react-email`](https://react.email) has ~4M downloads/week and is where developers already are. It has **no visual editor**, so a marketer or designer can't touch a template without a pull request.
- **The visual world** — Unlayer, Stripo, easy-email. Every one of them stores your template as a **proprietary JSON blob**, requires a specific UI framework, and is **export-only**. None of them can read an email back in.

mailkiln is the bridge. The visual editor is an *authoring convenience*; the code is the artefact you keep. Delete mailkiln from your `package.json` tomorrow and your templates still build.

## The four pillars

### 1. Eject to React Email code

Not a rendered HTML string, and not a JSON blob — an actual component, with your merge variables as real props:

```jsx
import { Body, Button, Container, Head, Heading, Html, Section, Text } from '@react-email/components'

/**
 * @param {{ user: { name: string }, order: { id: string, total: number } }} props
 */
export function OrderShipped({ user, order }) {
  return (
    <Html lang="en">
      <Head />
      <Body style={{ backgroundColor: '#f4f5f7', margin: 0, padding: 0 }}>
        <Section style={{ padding: '24px 0px 24px 0px', backgroundColor: '#eef2f7' }}>
          <Container style={{ maxWidth: 600, width: '100%', backgroundColor: '#ffffff' }}>
            <Section style={{ padding: '12px 24px 4px 24px' }}>
              <Heading as="h2" style={{ margin: 0, fontSize: 26 }}>Thanks, {user.name}!</Heading>
            </Section>
            <Section style={{ padding: '16px 24px 16px 24px', textAlign: 'center' }}>
              <Button href="https://example.com/track" style={{ backgroundColor: '#4f46e5' }}>
                Track order
              </Button>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  )
}

OrderShipped.PreviewProps = { user: { name: 'Smit' }, order: { id: 'MK-2291', total: 4200 } }
```

Output is **deterministic** — same document in, byte-identical file out, with stable prop order — so it diffs cleanly in your git history. Ask for `lang: 'tsx'` and you get the same tree plus a generated `Props` interface.

### 2. Import / round-trip existing HTML

Paste any email HTML and get editable blocks back:

```js
import { importFromHtml } from 'mailkiln/core'

const report = importFromHtml(html)
// {
//   document,            // editable EmailDocument
//   confidence: 0.82,    // share of blocks fully recognised
//   blockCount: 11,
//   recognized: 9,
//   unrecognized: [...], // ids kept as raw HTML
//   warnings: [...],     // what we knowingly did not carry over
//   detectedVars: ['fname'],
// }
```

The guarantee is narrow and absolute:

> **Import may degrade in editability. It never loses content.**

Anything unrecognised becomes a raw `html` block holding its original markup. Mailchimp `*|FNAME|*`, Mailgun `%recipient:name%` and `%%NAME%%` tags are converted to mailkiln variables on the way in. No other builder on npm attempts this.

### 3. Built-in deliverability linter

Sixteen rules, running live while you design:

| Rule | What it catches |
|---|---|
| `gmail-clipping` | Rendered HTML over 102KB — Gmail truncates it, footer and all |
| `unsubscribe` | No unsubscribe link (legally required; Gmail/Yahoo bulk rules) |
| `unknown-var` | `{{user.nmae}}` — with a "did you mean" suggestion |
| `links` | Relative URLs and leftover `#` placeholders |
| `outlook-unsafe-css` | flex, grid, position, transform, gap — Word's engine ignores them |
| `contrast` | Below WCAG AA, with the measured ratio |
| `dark-mode` | Palettes that break when a client force-inverts them |
| `image-alt` / `image-width` / `image-format` | Blocked-image copy, Outlook sizing, webp/avif/svg |
| `background-image` | Missing VML fallback or fallback colour |
| `plain-text` | Thin or missing `text/plain` alternative |
| `preheader` | Missing, or too long to show |
| `font-size` | Under 12px, which iOS auto-zooms |
| `spam-phrases` | Curated list, plus ALL CAPS and `!!` in the subject |
| `structure` | Over-wide templates, too many columns, non-stacking rows |

Every issue carries a `nodeId`, so clicking it selects the block at fault.

### 4. Schema-safe merge variables

Declare your data once. The sample object *is* the schema:

```js
const vars = defineVars({
  sample: {
    user: { name: 'Smit', email: 'smit@example.com' },
    order: { id: 'MK-2291', total: 4200 },
  },
})
```

That one object drives four things: `{{` autocomplete in every text field, the `unknown-var` lint rule, the preview render, and the `Props` interface on the exported component.

---

## Quickstart

```jsx
import { useState } from 'react'
import { MailKiln } from 'mailkiln'
import { createDocument, defineVars } from 'mailkiln/core'
import 'mailkiln/style.css'

const vars = defineVars({
  sample: { user: { name: 'Smit' }, order: { total: 4200 } },
})

export function Editor() {
  const [doc, setDoc] = useState(() => createDocument())

  return (
    <MailKiln
      value={doc}
      onChange={setDoc}
      vars={vars}
      theme={{ accent: '#6366f1' }}
      onImageUpload={async (file) => (await uploadSomewhere(file)).url}
      onExport={(out) => save(out.jsx)}
    />
  )
}
```

`<MailKiln>` fills its container — give it a parent with a height.

## Headless usage

Everything except the editor UI is available React-free, for a CLI, a build step or a CI check:

```js
import {
  renderToJsx, renderToHtml, renderToMjml, renderToText, // eject
  importFromHtml,                                        // round-trip
  lintDocument,                                          // deliverability
  defineBlock, defineVars, createDocument, exportDocument,
} from 'mailkiln/core'
```

An ESLint rule fails our build if anything under `src/core/` imports React, so this stays true.

**In Node, the importer needs a DOM.** In a browser it uses the built-in `DOMParser`; in Node, install [`linkedom`](https://github.com/WebReflection/linkedom) (an optional peer dependency) and inject it:

```js
import { parseHTML } from 'linkedom'
importFromHtml(html, { parseHtml: (h) => parseHTML(h).document })
```

Fail deliverability checks in CI:

```js
const { errors, issues } = lintDocument(JSON.parse(await readFile('welcome.mailkiln.json')), { vars })
if (errors > 0) {
  console.error(issues.filter((i) => i.level === 'error'))
  process.exit(1)
}
```

## Props

| Prop | Type | Description |
|---|---|---|
| `value` | `EmailDocument` | Controlled document. |
| `defaultValue` | `EmailDocument` | Initial document when uncontrolled. |
| `onChange` | `(doc) => void` | Called on every committed change. |
| `vars` | `VarsDef` | From `defineVars`. Powers autocomplete, lint, preview and typed export. |
| `blocks` | `BlockDef[]` | Custom blocks from `defineBlock`. |
| `tools` | `Record<string, ToolConfig>` | Per-tool palette config — `enabled`, `position`, `usageLimit`. See below. |
| `specialLinks` | `Array<{ label, value }>` | Replaces the built-in unsubscribe / preferences / view-in-browser entries. |
| `lintDisable` | `string[]` | Lint rule ids to stop reporting — `['contrast']`, or `['block:html']` for a block type's own rules. |
| `theme` | `Theme` | Editor chrome colours. Applied as CSS variables on this instance only. |
| `appearance` | `'light' \| 'dark' \| 'auto'` | Chrome appearance. Default `'light'`; `'auto'` follows `prefers-color-scheme`. There is no in-editor toggle — your app owns the setting. |
| `locale` | `string` | `'en'` or `'hi'` ship built in. |
| `messages` | `Record<string, string>` | Per-key string overrides. |
| `onImageUpload` | `(file: File) => Promise<string>` | Enables the upload button. A URL field is always available regardless. |
| `onExport` | `(bundle) => void` | Called by the Export button with all six formats. |
| `views` | `Array<'design' \| 'preview' \| 'code' \| 'checks'>` | Which toolbar tabs to offer, in the order given. Defaults to `['design', 'preview', 'checks']` — the Code tab is opt-in; add `'code'` to show it. |
| `showPalette` / `showInspector` | `boolean` | Hide either panel to build your own layout. |
| `className` / `style` | — | Applied to the root element. |

## Starter documents

Four ready-made documents ship with the headless core — Welcome, Receipt, Newsletter, Password reset. There is no template gallery in the editor UI; these are a **headless API** you can use as a starting `value`:

```js
import { builtinTemplates, getTemplate } from 'mailkiln/core'

const doc = getTemplate('welcome').create() // fresh node ids on every call
```

They bundle no images and no ESP-specific markup, and every one passes this package's own linter with **zero errors** — enforced by a test, because shipping a starter that trips the deliverability rules we advertise would be indefensible.

## Editing text

Click a text or heading block and a formatting bar floats above it: **bold, italic,
underline, link, bulleted list, numbered list, clear formatting**. The link button opens a
popover that takes a URL *or* a merge variable — `{{unsubscribe_url}}` is a valid answer.
List buttons are hidden on headings, because a `<ul>` inside an `<h2>` is invalid HTML.

Editing happens in the element the block marked `data-mk-edit`, never the rendered block
as a whole, and nothing reaches your document unfiltered:

```js
import { normalizeRichText } from 'mailkiln/core'

normalizeRichText('<div class="MsoNormal"><span style="font-weight:700">Hi</span></div>')
// → '<b>Hi</b>'
```

`normalizeRichText` allows `b/strong, i/em, u, s, a, br, ul, ol, li` and `span` with a
narrow style whitelist (`color`, `background-color`, `text-decoration`). Two rules govern
the rest, both chosen so editing can never cost you content:

- **Unwrap, never drop.** A disallowed element loses its tag and keeps its text — the same
  guarantee the HTML importer makes. A `javascript:` link loses the anchor, not the words.
- **Map before discarding.** `font-weight:bold` becomes `<b>`, `font-style:italic` becomes
  `<i>`, `<div>` and `<p>` become `<br>`. Formatting survives even when the browser
  expressed it in a way email cannot use.

It runs on every commit *and* on every paste, so pasting from Word or Google Docs — the
main way `mso-` properties and nested tables get into an email template — lands as clean
inline markup. It is idempotent, and it is in `mailkiln/core`, so you can run it in Node
over content that never went near the editor.

It is built on `document.execCommand`. That API is deprecated but universally implemented,
and every alternative (Slate, ProseMirror, Lexical) is larger than the whole of this
package. The risk is contained: the calls live in one file, and because the normalizer runs
afterwards we depend on the browser producing *something* reasonable, never something
exact.

## Display conditions and repeats

The part where ejecting to *code* pays for itself.

Every builder can hide a block conditionally. Unlayer does it by baking its customer's ESP
template syntax into the exported HTML — `{% if user.isPro %}` — which welds the output to
one platform. Because mailkiln ejects a component, a condition can be a real expression
instead:

```jsx
{user.isPro && (
  <Section style={{ padding: "8px 24px" }}>…</Section>
)}
{order.items.map((item, itemIndex) => (
  <Section key={itemIndex}>…</Section>
))}
```

Your bundler type-checks it. Your ESP never sees it.

**Conditions** live on any section, row or block, in the Inspector's **Visibility** group:
a merge path, an operator, and a value when the operator needs one.

```js
import { setCondition } from 'mailkiln/core'
doc = setCondition(doc, block.id, { path: 'order.total', op: 'gt', value: 100 })
```

Operators: `truthy`, `falsy`, `empty`, `notEmpty`, `eq`, `ne`, `gt`, `lt`. `empty` and
`notEmpty` are not redundant with the first two — an empty array is truthy in JavaScript, so
"show this when the cart has items" written as `truthy` renders the section for an empty
cart. That bug earned its own operator.

**Repeats** live on a row:

```js
import { setRepeat } from 'mailkiln/core'
doc = setRepeat(doc, row.id, { path: 'order.items', as: 'item' })
```

Inside that row, `{{item.title}}` resolves per iteration and exports as `{item.title}`. The
loop variable is in scope for the linter too, so it is never reported as an undeclared
merge variable — and `{{user.name}}` still works alongside it, because the loop scope is
layered over the outer one rather than replacing it.

Both resolve against your `defineVars` sample data, so the HTML export, the Preview tab and
the plain-text alternative all show the real branch and the real list.

**On the canvas they are marked, never hidden.** A node the editor refuses to draw is a node
you cannot select, and a condition you cannot select is one you cannot remove — the same
reasoning as "hide on mobile". A conditional node gets a dashed outline and a badge; when the
condition is false for your sample data the badge greys out and the content dims. A repeated
row is drawn once, scoped to the first item: three copies would be three DOM nodes sharing
one set of ids, and drag-and-drop could not tell them apart. The Preview tab shows all of
them.

An unfinished condition — the switch is on but you have not typed a path yet — is kept while
you edit and treated as "always show" by every renderer. `exportDocument` strips it, so it
never reaches a saved template.

## Configuring the palette

```jsx
<MailKiln
  tools={{
    image: { enabled: false },        // gone from the palette
    button: { position: 0, usageLimit: 1 },
  }}
/>
```

The shape is react-email-editor's, deliberately — a config from there works here.

- **`enabled: false`** removes the tile. It does **not** unregister the block: a template
  that already contains one still renders, exports and can be edited. Turning a tool off is
  not allowed to break work someone already did.
- **`position`** is an index into the flat palette order, not a sort key. Tools without one
  keep their declared order around those that have one. Groups are derived from the
  resulting order, so moving a tool to position 0 also moves its group to the top.
- **`usageLimit`** greys out the tile — with a tooltip saying why — once the document holds
  that many. Quick insert drops the entry instead of greying it, because that list is
  arrow-key driven and a dead entry you can land on is worse than one that is absent.

All of this is UI policy, so it lives in the React layer. `mailkiln/core` stays
policy-free: `insertBlock` always inserts, and a headless script is never bound by a palette
rule someone set for their editor.

## Mobile controls

Every block has a **Mobile** group in the Inspector:

- **Hide on mobile** — the block disappears below the breakpoint. It stays in the markup, so
  Outlook and every desktop client still show it. On the design canvas it is *dimmed* rather
  than hidden, because a block you cannot select is a block whose setting you cannot undo.
- **Mobile font size** — text, heading and button blocks only, scoped to that one block via a
  stable `mk-b-<id>` class. Empty means "same as desktop".

Both reach the ejected component too: `renderToJsx` writes the matching media query into
`<Head>`, so a setting you turned on in the editor does not quietly stop working the moment
you eject.

The breakpoint is one pixel *below* the content width — `max-width:599px` for a 600px
email. At exactly 600px the content still fits, and treating that as "mobile" made the
editor's own 600px desktop preview hide anything marked hidden.

## Typography and layout controls

Fields that exist because a real rebuild needed them and the editor could not express them:

- **Link colour** (text, heading) — email clients do not inherit a `<div>`'s colour into an
  `<a>`, and the head stylesheet is stripped by several of them, so every anchor inside copy
  is given the colour inline. Empty falls back to `settings.linkColor`; an anchor that
  already carries its own `color` is never overwritten. The contrast rule checks it too.
- **Weight** (heading) — headings were locked to bold for as long as the block existed.
- **Paragraph spacing** (text) — clients disagree on the default `<p>` margin. Empty keeps
  whatever the client does; a margin you wrote yourself wins over this field.
- **Letter spacing** (button, menu) — the field text and heading already had.
- **Outlook width (px)** (image) — Outlook cannot compute a percentage against a table cell,
  so a fluid image needs a pixel `width` attribute as well. Setting it silences the
  `image-width` rule.
- **Borders** (row, column) — four per-side CSS shorthands, e.g. `5px solid #1d1d1f`. Per
  side because the common case is one edge: the gutter between two cards.

## Buttons in Outlook

The Word rendering engine ignores `border-radius`. A rounded button that is not full width
therefore ships twice: a VML `<v:roundrect>` inside `<!--[if mso]>`, and the ordinary anchor
table inside `<!--[if !mso]><!-->`, so exactly one of the two is ever visible. The VML width
is estimated from the label, since VML has no shrink-to-fit. Square buttons and full-width
ones emit the plain table only — the first has nothing to round, the second no width to give.

## Silencing a check

Some rules are wrong for a particular template: brand colours that miss WCAG AA by a hair, a
deliberately wide layout. `lintDisable` takes rule ids and the panel stops reporting them.

```jsx
<MailKiln lintDisable={['contrast', 'structure']} />
```

Headless, the same list goes to `lintDocument(doc, { disable: [...] })`.

## Special links

Every link field — the inline toolbar's popover, and the `href` on button, image, social and
video blocks — offers the three links that come from your sending platform rather than from
your data:

```
{{unsubscribe_url}}   {{preferences_url}}   {{view_in_browser_url}}
```

This closes a genuinely silly gap: the `unsubscribe` lint rule told you the link was
missing, and the editor gave you no way to add one short of knowing your ESP's merge-tag
spelling. The picker and the unknown-variable rule read the same list from
`mailkiln/core`, so anything you can insert from the UI is guaranteed not to be reported as
undeclared.

```jsx
<MailKiln specialLinks={[{ label: 'Refer a friend', value: '{{referral_url}}' }]} />
```

The list you pass replaces the defaults — pass `[]` to remove the picker.

## Naming a template

`settings.name` is what *you* call the template — distinct from `settings.subject`, which the recipient reads. It is never sent or rendered. It names the exported component and its files:

```js
doc.settings.name = 'Order shipped'
exportDocument(doc).jsx   // export function OrderShipped(…)
exportFilenames(documentName(doc)).html   // order-shipped.html
```

Edit it inline in the toolbar, or in the Settings tab. With no name, `documentName(doc)` falls back to the subject and then to `EmailTemplate` — so a subject like "50% off — today only!" no longer has to double as a component name.

## Custom blocks

`defineBlock` is the same API the ten built-in blocks use — there is no privileged path. One definition gives you a palette entry, a generated Inspector, four render targets, a lint rule and HTML-import support:

```js
import { defineBlock, spacing } from 'mailkiln/core'

export const countdown = defineBlock({
  type: 'countdown',
  label: 'Countdown',
  group: 'Advanced',
  icon: 'spacer',

  defaultProps: { label: 'Ends in', endsAt: '', color: '#b91c1c', padding: spacing(12, 24) },

  // The Inspector is generated from this. No component to write.
  schema: [
    { key: 'label', type: 'text', label: 'Label', vars: true },
    { key: 'endsAt', type: 'text', label: 'Ends at (ISO)' },
    { key: 'color', type: 'color', label: 'Colour' },
    { key: 'padding', type: 'spacing', label: 'Padding' },
  ],

  render: {
    html: (p, ctx) => `<div style="color:${p.color}">${ctx.resolve(p.label)}: ${days(p.endsAt)}</div>`,
    jsx: (p, ctx) => el('Text', { style: { color: p.color } }, [`${ctx.resolve(p.label)}`]),
    text: (p, ctx) => `${ctx.resolve(p.label)}: ${days(p.endsAt)} days`,
  },

  lint: (p) => (Number.isFinite(Date.parse(p.endsAt)) ? [] : [
    { id: 'countdown-date', level: 'error', message: 'Unparseable end date.' },
  ]),

  // Optional: lets your block be recognised by HTML import too.
  parse: (el, ctx) => (el.dataset?.countdown ? { endsAt: el.dataset.countdown } : null),
})
```

Only `render.html` is required. Missing `jsx`, `mjml` or `text` renderers degrade gracefully, so a third-party block can never block an export.

**Field types:** `text` `textarea` `richtext` `number` `range` `color` `select` `spacing` `align` `image` `toggle` `url` `font` `list`.

Definitions are validated at registration with actionable errors:

```
mailkiln: block "countdown" schema[1] ("endsAt") edits "endsAt" but
`defaultProps.endsAt` does not exist. Add it so the field has a value to edit.
```

## Honest comparison

| | mailkiln | Unlayer (`react-email-editor`) | `easy-email-editor` | `@usewaypoint/email-builder` | `react-email` |
|---|---|---|---|---|---|
| Visual drag & drop editor | ✅ nested, free-form | ✅ | ✅ | insert menus only | ❌ |
| **Exports editable code** | ✅ react-email JSX/TSX | ❌ HTML only | ❌ HTML only | ❌ | n/a |
| **Imports existing HTML** | ✅ with a confidence report | ❌ | ❌ | ❌ | ❌ |
| Deliverability linter | ✅ 17 rules | ❌ | ❌ | ❌ | ❌ |
| Typed merge variables | ✅ | partial | ❌ | ❌ | via your own props |
| Conditions & loops | ✅ real JSX expressions | ESP syntax baked into the HTML | ❌ | ❌ | write them yourself |
| Self-hosted / offline | ✅ | ❌ hosted SaaS iframe | ✅ | ✅ | ✅ |
| UI framework lock-in | none | n/a (iframe) | AntD/Arco | Material UI | none |
| Runtime dependencies | 2 (dnd-kit) | iframe + service | many | MUI tree | few |
| Document format | plain JSON you own | proprietary | MJML JSON | proprietary | n/a |
| Licence | MIT | proprietary tiers | MIT | MIT | MIT |

Where the others are genuinely ahead: Unlayer has a template marketplace, AI copy tools and ESP integrations; easy-email has a mature MJML pipeline. mailkiln has none of those, on purpose (see [Not in v1](#not-in-v1)).

## Known limitations

Read these before adopting.

**MJML export emits markup only.** mailkiln does not bundle the MJML compiler — it is ~30MB and Node-only, and bundling it would wreck the install size of a browser library for a feature most consumers never use. Run `mjml` or `mjml-browser` on the output yourself.

**HTML import is inference, not parsing.** There is no grammar for "an email"; every ESP nests tables differently and none of them label what a `<td>` means. So:

- Source `<style>` blocks (including media queries) are **not** imported. mailkiln writes styles inline and regenerates responsive CSS on export.
- Outlook conditional comments are dropped; mailkiln emits its own.
- A layout table nested inside a column has no schema equivalent and is kept as a raw HTML block.
- Everything unrecognised is preserved verbatim, never dropped. The report tells you exactly how much.

**The canvas is an approximation.** Blocks are rendered with the real HTML renderer, but the surrounding chrome uses flex for columns. The Preview tab (a sandboxed iframe) is the accurate view; real clients are the only authority.

**Mobile controls reach HTML and JSX only.** `hideOnMobile` and `mobileFontSize` are media queries, and the MJML target has no equivalent — an MJML export silently keeps the block visible at every width. The HTML export, the preview and the ejected component all honour them.

**No CSS inliner.** We own the schema, so styles are written inline at emit time. Deterministic and dependency-free — but if you hand-write a raw HTML block with a `<style>` element, nothing will inline it for you.

## Client support

What the output is built and tested for:

| Client | Status | Notes |
|---|---|---|
| Gmail (web, iOS, Android) | ✅ | Media-query stacking; 102KB clipping linted |
| Apple Mail / iOS Mail | ✅ | `font-size < 12px` linted to avoid auto-zoom |
| Outlook 2016–2021, Windows | ✅ | Ghost tables, VML backgrounds, cell-padded buttons, `mso-` fixes |
| Outlook.com / new Outlook | ✅ | Dark-mode inversion linted |
| Yahoo / AOL | ✅ | |
| Samsung Mail, Thunderbird | ✅ | |
| Outlook for Mac | ⚠️ | WebKit-based; generally better than Windows |

Every client-specific hack in the renderer has a comment saying which client it is for and what breaks without it.

## Written in JavaScript

mailkiln is plain JavaScript (ESM) — there are no `.ts` files in `src/`. That is deliberate, and it does not mean untyped:

- Every export is documented with JSDoc, checked by `tsc --checkJs --strict` in CI.
- Published `.d.ts` files are generated from that JSDoc, and a strict consumer-style fixture (`tests/types/check.js`) fails the build if they degrade into `any`.
- Where a compiler would have caught a mistake, there is a runtime check instead: `defineBlock()` validates at registration, and `assertDocument()` fails loudly at load, import and `value` boundaries in development.

TypeScript consumers are first-class: the shipped types are real, and `renderToJsx(doc, { lang: 'tsx' })` emits a typed component.

## Not in v1

Real-time collaboration, AI copy generation, a hosted template marketplace, Vue/Svelte ports.

**ESP integrations specifically**: there are none and there will be none. mailkiln never talks to SendGrid, Mailchimp, Resend or anyone else — `exportDocument()` hands you the rendered HTML and text and your app owns the transport. That is the difference between a hook and an integration, and it is why this still works offline with no account.

`core/` is React-free so a port stays cheap later.

## Development

```bash
npm install
npm run dev          # playground at http://localhost:5180
npm test             # 297 tests
npm run typecheck    # tsc --checkJs over the JSDoc
npm run lint
npm run build        # dist/: ESM + CJS + .d.ts + style.css
npm run verify:pack  # publint + are-the-types-wrong
```

## Licence

MIT. No telemetry, no account, works offline.
