---
'mailkiln': patch
---

**Mobile chrome, measured in a browser at 360, 390, 430 and 820px rather than reasoned about.** Four things were wrong, and all four were only wrong on a phone.

**A node's label was cut in half at the top of the canvas.** The badge naming a block is drawn 18px *above* the box it names, and the canvas scroller clips — but the narrow breakpoints had shrunk the top padding to 18px, 14px and 10px, so the first node's label lost 1px, 5px or 9px of itself depending on the screen. The headroom is a token now (`--mk-label-headroom`), the same at every width, because the label does not get smaller when the screen does.

**Touch targets were desktop-sized.** The editor had declared its own floor — 36px — and applied it to toolbar buttons, tabs and palette tiles at 640px only. Everything else stayed as it was on a mouse: the per-block drag/duplicate/delete strip and the inline formatting bar at **22px**, the panel's close/back/duplicate/delete and the breadcrumbs at 26px, undo and redo 26px wide. The three buttons that delete things were the smallest controls in the editor. There is now a `@media (pointer: coarse)` block that lifts the control tokens together — keyed on the pointer and not the width, because a finger is the same size on a 390px phone as on an 820px tablet, while a narrow desktop window is still being driven by a mouse.

**Every block's label was pinned on over the document.** With one block that reads as "this is an editor"; with three it puts `Text` inside the heading above it and `Button` inside the paragraph, because stacked blocks have no gap and nothing on a phone reveals one label at a time. Chrome now follows the selection on touch, as the tool strips already did — and tapping a block opens Properties, whose header names it anyway. (The old rule also listed `.mk-node .mk-node-tools`, which never took effect: a more specific rule above it already tied the strips to the selection.)

**The toolbar got the space back that the bigger controls cost it.** Three rows is structural at 360px, so the gaps went from 6px to 4px and the ends from 8px to 6px: 149px instead of 157px, against 133px before any of this.

Nothing above changes at a fine pointer: verified at 1440px that the control tokens, the 22px canvas strip, the 32px canvas padding and the 52px toolbar are exactly as they were.
