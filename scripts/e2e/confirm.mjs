// Test helper (2026-11-18): the explicit list of rows a person confirmed in a save. Since then only these rows are confirmed,
// stamped by the server with the signed-in admin and the time; `needsConfirmation: false` on its own confirms nothing.
// A checklist item is named by its key, every other row by its position (as in src/lib/checklist-confirm.ts).
export const CONFIRMABLE = ['checklist', 'measurements', 'markings', 'labelPlacements', 'construction'];

/** Every row of the confirmable lists (or only the lists given). */
export function confirmAll(analysis, lists = CONFIRMABLE) {
  const out = [];
  for (const list of lists) {
    (Array.isArray(analysis?.[list]) ? analysis[list] : []).forEach((row, i) => out.push({ list, ref: list === 'checklist' ? String(row?.key ?? i) : String(i) }));
  }
  return out;
}
