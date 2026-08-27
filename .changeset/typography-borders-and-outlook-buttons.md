---
'mailkiln': minor
---

Close the gaps a real-world rebuild found: link colour, heading weight, borders, Outlook-shaped buttons, and a formatting bar in the property panel.

**Links take `settings.linkColor`.** It previously reached nothing but the video block's caption. The head stylesheet is stripped by several clients and ignored by Outlook, and an anchor does not inherit the colour of the `<div>` it sits in — so a link typed into a text block rendered in the client's default blue-violet no matter what the template said. Every anchor inside a text or heading block now carries the colour inline, in HTML, JSX and MJML alike, and an anchor that already has its own `color` is left alone. Text and heading blocks gained a **Link colour** field for the common case of a footer whose links differ from the body's, and the contrast rule now checks link colour as well as text colour.

**Heading weight is editable.** `headingBlock` carried `fontWeight` in its defaults from the start and exposed no control for it, so every heading exported bold and a regular-weight display heading was unreachable. Bold is still the default.

**Rows and columns take borders.** Four per-side fields under a Borders group, drawn on the canvas and emitted by all three renderers. Per side rather than one shorthand because the common case is a single edge — the hairline gutter between two cards — which a shorthand cannot express.

**Rounded buttons render round in Outlook.** The Word engine ignores `border-radius`, so a pill was a rectangle there. A rounded, non-full-width button now emits a VML `<v:roundrect>` twin for Outlook and hides the HTML button from it, so exactly one of the two ever shows. Square and full-width buttons are unchanged.

**A formatting bar on rich-text fields.** The canvas has had an inline toolbar for a while; the property panel offered a bare textarea, so editing copy there meant typing `<b>`, `<a href>` and `<li>` by hand. Bold, italic, underline, link, bulleted list and clear-formatting now wrap the selection. `textarea` fields — the preheader — stay plain.

**Paragraph spacing.** Clients disagree on the default `<p>` margin, so a template with paragraphs had different rhythm depending on where it was opened. Text blocks gained a **Paragraph spacing** field; empty keeps the client default, and a margin the author wrote wins.

**A pixel width for Outlook alongside a percentage.** An image can now be fluid *and* carry the `width` attribute Outlook needs, which is what a hand-written email does. The `image-width` lint rule stops asking once it is set.

**Letter spacing on buttons and menus**, matching the field text and heading blocks already had.

**`lintDisable` on `<MailKiln>`.** `lintDocument` has always taken a `disable` list and nothing in React passed one, so a rule that is wrong for a particular template — brand-blue contrast, a deliberate 700px width — sat in the panel forever with no way to acknowledge it.
