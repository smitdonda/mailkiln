---
'mailkiln': patch
---

Two small fixes, both found by driving the editor in a browser.

**Escape now closes quick insert wherever focus is.** The dialog handles Escape on its own input, which is where focus starts — but it is not a focus trap, so one Tab was enough to leave Escape with nothing to close while the overlay still covered the canvas. The editor's own handler now closes the topmost surface first: quick insert, then the overlay panel, then the selection.

**The text width no longer follows you back to the design view.** `text` is a preview width, and the toolbar already hides it outside Preview — but the state stayed set, so returning to Design left the canvas in a mode it has no concept of, with the device toggle showing *nothing* selected. Leaving Preview now falls back to desktop. Mobile still carries over, because that is a design width.
