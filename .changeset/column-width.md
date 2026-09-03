---
'mailkiln': patch
---

**A column is now the width you typed.** Setting Width % to 70 beside a 50 gave you **58**, and typing 70 again gave 62 — the number crept towards the one you asked for and never arrived.

The field patched `width` like any other prop, which left the row summing to 120 for an instant. `normalize` repairs that by scaling every column proportionally, which is right for a malformed imported document and wrong as the answer to a deliberate edit of one column. The siblings now absorb the remainder instead — in proportion to what they had — and the whole row is written at once through `setColumnWidths`.

Asking for 100 gives 95, because every sibling keeps the field's own 5% minimum: a column at zero is one you cannot see, let alone click on to undo what you just did.
