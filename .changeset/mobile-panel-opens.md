---
'mailkiln': patch
---

**The properties panel now opens when you select something on a narrow viewport.** Below the panel breakpoint the side panel is an overlay, and nothing but the toolbar's Panel button ever slid it in — so tapping a block switched the panel to Properties *off-screen* and the tap read as doing nothing at all. On a phone the Inspector was effectively unreachable: below 640px the structure pane hides itself too, which left no other route to a block's properties. A selection now brings the panel with it.

Only where the panel is an overlay. Above the breakpoint it is already a column beside the canvas, and marking a column "open" would have cost Escape a press — it would have dismissed a panel nobody can see move instead of clearing the selection. The editor now knows which of the two it is, so the Panel and Close buttons are rendered only where they do something, and widening the window forgets the open state rather than leaving it to spring back on the next resize.

The overlay's width was also `min(340px, 86vw)`, a viewport unit on a panel positioned inside the editor — an editor that is not flush with the viewport got a panel hanging off its own side, clipped by the root. It is a percentage now, matching the rule that already handled this below 480px.
