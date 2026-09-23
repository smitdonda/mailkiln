---
'mailkiln': patch
---

**The design canvas now stacks a row's columns when the paper is narrower than the email's content width** — the thing that made the editor look broken on a phone rather than merely cramped.

The exported HTML has always done this: `render/html.js` puts a stacking class on every column cell and a `@media (max-width: width - 1)` turns it into `display:block;width:100%`. The document model has always said so too — `stackOnMobile` on a row, "columns become full width under 600px". The canvas was the only one of the three that ignored it, at every width. So a two-column row on a 390px phone kept two columns of 170px: a heading wrapped one word per line, and a social row ran off the right edge of the paper and was clipped mid-word.

It was wrong on a desktop as well, at the **Mobile device width** — the one view whose entire job is to show what a phone will do, showing side-by-side columns that no phone will render.

The paper is a `container-type: inline-size` query container now, so the rule keys off the width of the paper itself rather than the window: it is right for a phone, right for the 375px device frame on a wide screen, and right for an editor embedded narrow in a wide page. A row with `stackOnMobile: false` keeps its columns side by side and squeezes — here and in the inbox both.

Three faults from the touch sizing in the previous release, all found by measuring rather than looking:

- **The inline formatting bar was over the words.** 36px buttons make it 42px tall, but it was still anchored at the `-30px` that suited a 28px bar, so it hung 12px into the first line of the text being edited. Anchored to its real height now.
- **The actions strip was over them too.** It is tucked into the block's top-right corner by design; a 22px badge grazes the corner, a 42px one covers the end of the first line. On touch it moves up into the band above the block beside the formatting bar. It cannot simply hide while editing instead: for a text or heading block `editing` *is* `selected`, so that would take duplicate and delete off the canvas for the two most common block types.
- **The headroom was sized for the wrong thing.** The previous release sized it for the 18px type label; the tallest chrome above a node is the formatting bar, at 30px on a mouse and 44px on a finger. So the bar was still clipped by 10px at every width below 1200px — with a mouse as well as a finger — the moment you edited the first block in a template. `--mk-chrome-headroom` covers the tallest of it and replaces five hand-tuned paddings.

And one bug in the fix for those: constraining the bar's width to fit beside the strip made its buttons *shrink* back to 28px rather than the bar scroll, because they are flex items. `flex-shrink: 0` — a 36px rule that silently does nothing is worse than no rule. Verified all seven formatting buttons are 36×36 and every one reachable.

Desktop is untouched throughout: verified at 1440px that the control tokens, the 22px canvas strip, the 32px canvas padding, the 52px toolbar and side-by-side 300px columns are all exactly as they were.
