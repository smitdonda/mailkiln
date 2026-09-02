---
'mailkiln': minor
---

**A structure pane, and the type and space tokens the palette never had.**

The editor gains a third column: the document as a tree, down the left. It is the same JSON
a consumer owns — a section is a section, and a row carrying a `repeat` says which path it
repeats over. It answers what the canvas could not: where you are in a long template, how to
reach a row whose columns fill it, and which block a lint rule is complaining about (a dot on
the node, coloured by the worst level reported against it). Each column ends with an **Add
block** row that opens quick insert against that column, so an insert lands where you asked
rather than where the palette guessed. `showStructure={false}` leaves it out; below 1024px it
hides itself, because three columns of chrome around a 600px document do not fit.

`StructureTree` is exported for consumers assembling their own layout.

The chrome around it changed too. Colour was the only tokenised layer in the stylesheet, and
the only emphasis lever in use; type, space, size and shape were 45 hand-written values.
Now:

- **Type** is six steps carrying their own line-heights, replacing eleven sizes between
  9.5px and 19px — four of which differed from a neighbour by half a pixel.
- **Space** is a 4px grid of six steps, replacing eleven gap values including 5px and 7px.
- **Size** is three control heights instead of one: 36px for the primary action, 32px for
  ordinary controls, 26px for icon-only ones. Export is no longer the same size as undo.
- **Shape** is two radii with a visible difference — 6px for controls, 14px for anything
  that floats — instead of three radii three pixels apart.
- **Containment** is spent by role: the canvas paper and floating surfaces are raised;
  palette tiles lose their boxes for a hover fill; field groups separate by a hairline and
  16px rather than a card each. The view tabs and panel tabs carry selection with weight and
  a rule instead of a filled accent pill, which leaves the accent for the two things that
  should have it — the selected node and Export.
- Group headings are sentence case at the size the panel reads at, not 10.5px uppercase grey.

The palette is unchanged: its contrast ratios were already measured.

Also fixed: a count of one issue read "1 errors" in the Checks summary.
