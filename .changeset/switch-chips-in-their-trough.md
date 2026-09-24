---
'mailkiln': patch
---

**The view and device switches no longer stand outside their own groove on a narrow window.** A segmented control is drawn as a sunken trough with the selected chip raised out of it, and the trough was a fixed `height` — 32px, which leaves its chips 26px of content box. A separate rule gave every toolbar button a 36px minimum below 640px, so the chips grew and the trough could not be told: they stood 2px clear of it, top and bottom, and the switch read as loose buttons with a grey sliver behind them. Measured at 360, 390, 430 and 480px.

The 36px minimum was the part that was wrong, not the size. It predates the `@media (pointer: coarse)` block that now sets the control tokens, and keying a touch target to viewport width is what caused this: on a coarse pointer the rule was already redundant, because `--mk-control-icon` is 36px there and every control it named was at or above the floor without it; on a *fine* pointer under 640px — a narrow desktop window, and Chrome's own responsive mode, which reports `pointer: fine` until you switch on touch emulation — it was pure damage. It also named `.mk-tile`, which is 64px tall and never needed it. So it is gone, and the pointer decides the size of a target while the width decides the layout, which is what that block already said in words.

`.mk-segmented` takes a `min-height` now rather than a `height`, so a taller child grows the trough instead of bursting it. Nothing moves at the current tokens — the chips are 6px shorter than their trough by construction — but this is the second time a fixed height on a trough has cost a visible bug, and `.mk-panel-switch` beside it already worked this way.

**The panel's tab trough sat above the middle of its own header band.** Below the panel breakpoint a `padding-bottom: 8px` was added on top of a base `padding: 4px 12px`, so the trough had 4px above it and 9px below. One declaration now, and the taller the trough gets the less it shows rather than the more. Left and right stay uneven on purpose: the close button's glyph is 14px in a 36px box, so 8px of padding puts the mark about as far in from the panel's edge as the trough's 12px reads on the other side.

Verified in Chrome at 320 through 1440px on both pointer types: every chip sits inside its trough with 3px to spare, and every trough is centred in its band to within a rounding error.
