---
'mailkiln': patch
---

**The panel's tabs are sized to their labels now, so none of them sits on top of the one beside it.** With a node selected the panel carries four tabs — Content, Rows, Settings, Properties — and they used to be equal quarters of the trough, which means every quarter has to be wide enough for the widest label. On a narrow trough "Properties" did not fit its quarter and, being `white-space: nowrap` with visible overflow, its label spilled over the tab next to it. Measured: 4px past its slot on each side at 257px of trough, 7px at 229px, where "Content" and "Settings" overran by 2px as well.

Not a mobile bug, though that is where it shows worst. The trough is 229px in the 264px panel a **1024px desktop** gets and 257px in the 288px panel at **1100px**, and both had the same overlap.

Equal quarters cannot be made to fit. Four of the widest label come to 282px against the 258px of trough a 360px phone has, so the only ways out were to break the row or to break the words — and both were tried. Truncation does nothing useful: `overflow: hidden` on the button never applies, because the label is an anonymous flex item that `text-overflow` cannot reach, and moving the label into a span to make it work turns a 56px slot into "Cont… Rows Setti… Prop…". Wrapping the fourth tab to a row of its own left it stretched by `flex-grow` to the full width of the trough: one 258px chip under three 85px ones, which reads as a broken layout rather than a switch.

So the tabs take their labels' width and share out what is left over. The same four labels cost 220px that way, which fits one row at every width down to 320px with room to spare — no wrapped row, no clipped word, every tap target intact. It also retires a `@container (max-width: 270px)` threshold that had been tuned against the pixel width of the English word "Properties", and so was wrong in any other language.

What equal widths were protecting is kept: the row does not move when you pick a tab. The selected label is semibold, and a word is not the same width at 400 and at 600, so each tab reserves both widths in every state — the same text, hidden, in two collapsed grid rows sharing the label's column. Reserving only the bold width is not enough; in the stack this editor asks for, semibold "Content" measures 1px *narrower* than regular, so the row twitched the other way. The hidden copies use `overflow: clip`, never `hidden`: `hidden` makes a scroll container, a scroll container contributes zero to intrinsic width, and the whole reservation silently becomes a no-op.

`.mk-panel-tabs` had a fixed 48px height, which clipped a 42px trough on a touch device. It is a floor now.

Verified in Chrome at 320, 360, 390, 412, 430, 480, 540, 640, 768, 820, 900, 1024, 1100, 1280 and 1440px, with three tabs and with four, on a coarse and a fine pointer, in English and in Hindi, with each tab selected in turn: 120 cases, no label wider than the box drawn around it, nothing on a second row, nothing clipped, and not one tab that moves when the selection does.
