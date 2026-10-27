// The garment library that ships with the portal: 3 categories and 35 garment types (from the client's guide).
// Used (1) as the starting list when the database table does not exist yet, (2) to show readable names on screens and in the
// tech file PDF, and (3) as the seed in audit-docs/deliverables/dev-patch-garment-types.sql. Safe to import in the browser.
// The first seven keys are the ones older requests already use (pants = Work Pants, overalls = Bib Overalls): do not rename them.

export interface GarmentCategory { key: string; label: string; sort: number }
export interface GarmentType { key: string; label: string; category: string; sort: number; active: boolean }

export const DEFAULT_GARMENT_CATEGORIES: GarmentCategory[] = [
  { key: 'outerwear', label: 'Outerwear', sort: 10 },
  { key: 'workwear', label: 'Workwear and Uniforms', sort: 20 },
  { key: 'protective', label: 'Specialized Protective Clothing', sort: 30 },
];

const t = (category: string, rows: [string, string][]): Omit<GarmentType, 'sort' | 'active'>[] => rows.map(([key, label]) => ({ key, label, category }));

export const DEFAULT_GARMENT_TYPES: GarmentType[] = [
  ...t('outerwear', [
    ['jacket', 'Jacket'], ['parka', 'Parka'], ['coat', 'Coat'], ['bomber-jacket', 'Bomber Jacket'], ['softshell-jacket', 'Softshell Jacket'],
    ['rain-jacket', 'Rain Jacket'], ['winter-jacket', 'Winter Jacket'], ['fleece-jacket', 'Fleece Jacket'], ['vest', 'Vest'], ['high-visibility-vest', 'High Visibility Vest'],
  ]),
  ...t('workwear', [
    ['work-shirt', 'Work Shirt'], ['polo-shirt', 'Polo Shirt'], ['t-shirt', 'T Shirt'], ['hoodie', 'Hoodie'], ['sweatshirt', 'Sweatshirt'],
    ['pants', 'Work Pants'], ['cargo-pants', 'Cargo Pants'], ['work-shorts', 'Work Shorts'], ['coveralls', 'Coveralls'], ['overalls', 'Bib Overalls'],
    ['insulated-coveralls', 'Insulated Coveralls'], ['fr-coveralls', 'FR Coveralls'], ['lab-coat', 'Lab Coat'], ['scrubs', 'Scrubs'],
  ]),
  ...t('protective', [
    ['firefighter-turnout-coat', 'Firefighter Turnout Coat'], ['firefighter-turnout-pants', 'Firefighter Turnout Pants'], ['firefighter-station-wear', 'Firefighter Station Wear'],
    ['chemical-protective-suit', 'Chemical Protective Suit'], ['disposable-coveralls', 'Disposable Coveralls'], ['welding-jacket', 'Welding Jacket'],
    ['welding-apron', 'Welding Apron'], ['protective-apron', 'Protective Apron'], ['rain-suit', 'Rain Suit'],
    ['high-visibility-clothing', 'High Visibility Clothing'], ['arc-rated-clothing', 'Arc Rated Clothing'],
  ]),
].map((g, i) => ({ ...g, sort: (i + 1) * 10, active: true }));

/** Readable name for a stored key ("high-visibility-vest" -> "High Visibility Vest"). Unknown keys are tidied up instead of shown raw. */
export function garmentTypeLabel(key: string | null | undefined, types: GarmentType[] = DEFAULT_GARMENT_TYPES): string {
  if (!key) return '';
  const hit = types.find((x) => x.key === key);
  if (hit) return hit.label;
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
