---
'mailkiln': patch
---

Four fixes and a new test suite, all of it from driving the editor in a real browser.

**The canvas no longer executes markup it was handed.** `props.text` is inline HTML by design and a document is plain JSON, so the markup on the canvas can have arrived from an imported third-party email or a saved template rather than from the person looking at it. Writing it to `innerHTML` does not run a `<script>`, but it does attach every `on*` handler — `<img src=x onerror=…>` fired on render, and an anchor's `onclick` fired on the click that selects the block, both in the host application's origin. The new `stripUnsafeHtml` removes what executes without dropping a word of copy, and the canvas sanitizes on the way in. Exports are untouched: clients strip these anyway, and reporting them is the linter's job.

**Editing a block in place no longer destroys its merge variables.** The canvas resolves `{{order.total}}` against the sample data, and whatever is in the edited element on blur *becomes* `props.text` — so typing one character into a block committed one recipient's sample value over the variable, permanently. The block under the caret now renders with its tags intact; every other block still shows the email.

**Escape works wherever focus is.** 0.2.0 fixed this for the case where focus is inside the editor, which turned out to be the easy half: the handler lives on the root element, and focus leaves it routinely — one Tab out of quick insert, the blur that ends an inline edit, a click on chrome that takes no focus. From `<body>`, Escape reached nobody at all. There is now a document-level fallback for exactly that gap, and quick insert has a real focus trap, so `aria-modal` is no longer a claim it could not back up.

**Deleting the last section is no longer a dead end.** The document was then legal but had nowhere to insert into, and every entry point failed silently — the blank state's buttons, the palette, quick insert — leaving the Rows tab as the only way back. Inserting with no column to aim at now creates the section it needs.

**The linter reports an image source no recipient can fetch.** `image-src` only checked for an empty source, so a `blob:` URL (what an `onImageUpload` hook hands back before the file reaches storage), a relative path (what the HTML importer keeps when it finds one), a `data:` URI or a bare `//host/path` all passed in silence. They render perfectly on the canvas, which is the point: the canvas is a page and an email is not.
