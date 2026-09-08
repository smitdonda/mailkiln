---
'mailkiln': patch
---

The editor answers the pointer, and opens showing what it can do.

**The canvas draws the paper at `settings.width`.** It stretched to fill the working pane before, which made every line length, image crop and column split on screen wrong by about a third — in the one view people spend all their time in. The dead gutter that motivated the stretch is now the workspace: it carries the email's own background colour, so the framing an author picked is visible while they work rather than only in Preview.

**The palette opens on every block.** The active category defaulted to the group of whichever block sorted first, so a consumer writing `tools: { countdown: { position: 0 } }` to order their palette silently decided that everyone lands in "Advanced" — two blocks visible, the other nine behind a click. A leading "All" entry shows them all, and the rail becomes a filter rather than a gate.

**Properties is a fourth tab instead of a replacement.** Selecting a node used to swap the whole panel out, so every insert threw the block list away and getting back to it cost two clicks — one for the back button, one to re-pick the category it had forgotten. Content, Rows and Settings now stay on screen throughout, and deselecting returns to the tab you were on.

**Block chrome is revealed on hover.** Move, duplicate and delete used to appear only once a block was selected, so nothing on the canvas responded to the pointer and the only way to learn a block was draggable was to click it first. The strip stays out of the tab order until its block is selected, and is always visible where there is no hover to enter.

**The size chip prints its budget** — `8 / 100 KB` rather than `8 KB`. The threshold was only in the tooltip, which is the one place nobody reads before exceeding it.
