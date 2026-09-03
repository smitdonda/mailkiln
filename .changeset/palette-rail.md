---
'mailkiln': minor
---

**The Content tab is a category rail now.** One category open at a time, its blocks in a two-up grid beside a 72px rail of icons.

The arrangement it replaces stacked every group into one scroll, and the numbers were against it: eleven blocks in a three-up grid is 624px of content in a 572px panel body, so the last group was cut off before anyone had added a thing — and because block counts are not multiples of three, every group ended on a ragged row. The rail fixes both, and it is the only arrangement that still works for a consumer who registers a dozen custom blocks, which is the case this panel has to survive.

- Categories are the `group` on each block definition, in palette order, so `tools` position config still decides which leads.
- A group mailkiln does not recognise takes the icon of its first block, so a custom category never shows a placeholder.
- **Search spans every category.** Somebody typing "video" should not need to know which drawer it is in — so a query searches all blocks, and no category claims to be current while it runs.
