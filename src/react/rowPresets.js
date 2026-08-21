/**
 * Column layout presets, shared by the Rows tab (which adds a row) and the row
 * property panel (which converts an existing one).
 *
 * Both surfaces showing the same eight thumbnails is the point: "two columns"
 * should look the same whether you are creating it or changing to it. The panel
 * used to show bare numbers — `1 2 3 4` — which said nothing about the result and
 * could not express an uneven split at all.
 *
 * @module mailkiln/react/rowPresets
 */

/**
 * Widths as percentages, summing to 100 — the shape `createRow({ widths })` and
 * `setRowLayout` both take.
 *
 * @type {Array<{ id: string, widths: number[] }>}
 */
export const ROW_PRESETS = [
  { id: '1', widths: [100] },
  { id: '2', widths: [50, 50] },
  { id: '3', widths: [34, 33, 33] },
  { id: '4', widths: [25, 25, 25, 25] },
  { id: '2-1', widths: [67, 33] },
  { id: '1-2', widths: [33, 67] },
  { id: '3-1', widths: [75, 25] },
  { id: '1-3', widths: [25, 75] },
]

/**
 * Which preset a row currently matches, if any. Compared with a tolerance
 * because normalize() rounds widths to integers that sum to 100.
 *
 * @param {number[]} widths
 * @returns {string | null}
 */
export function matchPreset(widths) {
  for (const preset of ROW_PRESETS) {
    if (preset.widths.length !== widths.length) continue
    const same = preset.widths.every((value, index) => Math.abs(value - widths[index]) <= 2)
    if (same) return preset.id
  }
  return null
}
