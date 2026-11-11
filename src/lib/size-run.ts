// Task 30: the size columns of the measurement table. Clothing keeps XS to XL; gloves get hand sizes and footwear shoe
// sizes with a width and a size system (default "US men's"); an admin can change the labels. The values sit in the xs, s, m,
// l and xl fields of each measurement row, so older tech files read exactly as before. No imports (client-safe).
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The size columns of the measurement table (the values sit in the xs, s, m, l and xl fields of each row). */
export interface SizeRun { system: 'alpha' | 'glove' | 'shoe'; labels: string[]; width?: string; sizeSystem?: string }
export const ALPHA_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
export const SIZE_KEYS = ['xs', 's', 'm', 'l', 'xl'] as const;
export const SHOE_WIDTHS = ['B', 'C', 'D', 'E', 'EE', '3E', '4E'];
/** The default size columns for a template's sizing system: glove hand sizes, shoe sizes with a width and a size system. */
export function defaultSizeRun(sizingStyle: string | null | undefined): SizeRun | null {
  if (sizingStyle === 'glove') return { system: 'glove', labels: ['7', '8', '9', '10', '11'] };
  if (sizingStyle === 'shoe-width') return { system: 'shoe', labels: ['7', '8', '9', '10', '11'], width: 'D', sizeSystem: "US men's" };
  return null;
}
/** The column labels to show: the saved size run, else the clothing sizes (older tech files read exactly as before). */
export function sizeLabels(a: Row | null | undefined): string[] {
  const l = a?.sizeRun?.labels;
  return Array.isArray(l) && l.length === 5 ? l.map((x: unknown) => String(x ?? '').slice(0, 12)) : ALPHA_SIZES;
}
/** A short line under a footwear table: "US men's sizes, width D". */
export function sizeNote(a: Row | null | undefined): string {
  const r = a?.sizeRun;
  if (r?.system === 'shoe') return `${String(r.sizeSystem || "US men's").slice(0, 40)} sizes, width ${String(r.width || 'D').slice(0, 6)}`;
  if (r?.system === 'glove') return 'Hand sizes';
  return '';
}


/** The analysis with its size run filled in from the template family when it has none yet (gloves and footwear only). */
export function withDefaultSizes<T extends Row | null | undefined>(a: T, familyKey: string | null | undefined): T {
  if (!a || a.sizeRun) return a;
  const run = defaultSizeRun(familyKey === 'glove' ? 'glove' : familyKey === 'footwear' ? 'shoe-width' : null);
  return (run ? { ...a, sizeRun: run } : a) as T;
}
