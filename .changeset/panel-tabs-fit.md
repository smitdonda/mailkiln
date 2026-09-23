---
'mailkiln': patch
---

**The selected panel tab no longer sits on top of the tab beside it.** With a node selected the panel carries four tabs — Content, Rows, Settings, Properties — and they are equal quarters of the trough, so the widest label sets what all four get. On a narrow trough "Properties" did not fit its quarter and, being `white-space: nowrap` with visible overflow, its label simply spilled over the neighbouring tab. Measured: 4px past its slot on each side at 257px of trough, 7px at 229px, where "Content" and "Settings" overran by 2px as well.

Not a mobile bug, though that is where it shows worst. The trough is 229px in a 300px overlay on a 360px phone — and 233px in the 264px panel a **1024px desktop** gets, 257px in the 288px panel at **1100px**. Both desktop widths had the same overlap. The panel width alone does not predict it either: a 320px desktop panel holds four tabs while a 328px phone overlay does not, because below the panel breakpoint the header also carries the close button. So the trough is now its own `container-type: inline-size` query container, and the rule keys off the box that actually runs out of room.

Below 270px of trough the tabs take a real third-of-a-row basis: three to a row, the fourth wrapping to a full-width row of its own, every label whole and every tap target intact. At 289px and above — a 320px desktop panel, a 360px overlay on a 430px phone — nothing changes. With three tabs it is the same single row as before at every width, so this needs no `:has()`.

Truncation was tried first and rejected: `overflow: hidden` on the button does nothing, because the label is an anonymous flex item and `text-overflow` never applies to it; moving the label into a span to make it work turns a 56px slot into "Cont… Rows Setti… Prop…".

`.mk-panel-tabs` had a fixed 48px height, which clipped the second row, so it grows with the switch now.

Verified in Chrome at 360, 390, 430, 1024, 1100 and 1440px, in every view, with each tab selected in turn: no tab overruns its slot, overlaps a neighbour on its row, or clips its label. The 1440px desktop header is unchanged at 48px and one row.
