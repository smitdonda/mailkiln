---
'mailkiln': minor
---

Add a Menu block, and fix the canvas selection paths that made multi-column rows hard to build.

**New: the Menu block.** A row of navigation links — the thing most footers need and that a text block full of hand-written `<a>` tags served poorly. Items are label + URL pairs with merge-variable support; layout is horizontal or vertical, with an optional separator character and its own colour. The HTML target emits two paths: a one-row table for Outlook, whose engine ignores `inline-block` and would otherwise stack every link, and plain anchors for every other client, so a long menu wraps on a narrow screen. MJML exports as `mj-navbar` (or `mj-text` when vertical), and HTML import recognises a container of text links as a menu, inferring the separator and link colour. Two lint rules cover an item with no link and a link with no label.

**Columns are selectable.** Clicking a column used to bubble to its row, so a column's Width, Padding, Background and Vertical align could not be reached from the canvas at all.

**The palette remembers which column you were in.** Opening the palette means deselecting, because the panel shows the selected node's properties instead of the tabs — so every append after the first landed in the document's last column. The store now keeps a `focusColumnId` alongside the selection, and `targetColumnId` prefers it.

**Breadcrumbs in the property panel.** Columns fill their row, so once a column takes the click there is nothing left to click on a row with no padding. `Section › Row › Column` in the panel header is the route back up.

**A drop commits where the indicator drew it.** `handleDragEnd` recomputed the target from a rect captured after the pointer was released rather than committing the position on screen.

**Divider and spacer gained the Background field** every other block already had; both renderers already emitted the colour, so only the panel control was missing. The spacer's MJML output now carries `container-background-color` too.

**The empty-image placeholder no longer ships.** An image block with no source rendered a dashed "No image selected" box, and a video block with no thumbnail a dark "No thumbnail selected" one — in the canvas *and* in the exported HTML, so an unfinished template posted that box to every recipient. Both are now editor-only; outside the canvas such a block renders as nothing, and a new `image-src` lint rule says so before you send.

**Clicking a check now shows the block.** The Checks panel's issue button is titled "Show the block this affects", but it only selected the node — and the properties panel exists only in the design view, so from the Checks tab the click looked inert. `<MailKiln>` now switches back to the canvas with the block selected; `LintPanel` takes an `onShowBlock` prop for consumers assembling their own layout.
