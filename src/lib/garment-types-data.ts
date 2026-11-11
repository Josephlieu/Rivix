// The product library that ships with the portal: the client's 9 categories and 83 types (task 27; first 35 from the client's guide).
// Used (1) as the starting list when the database table does not exist yet, (2) to show readable names on screens and in the
// tech file PDF, and (3) as the seed in audit-docs/deliverables/dev-patch-garment-types.sql. Safe to import in the browser.
// The first seven keys are the ones older requests already use (pants = Work Pants, overalls = Bib Overalls): do not rename them.

export interface GarmentCategory { key: string; label: string; sort: number; active?: boolean; baseTemplate?: string } // active false = switched off (task 31)

export interface GarmentType { key: string; label: string; category: string; sort: number; active: boolean; templateFamily?: string | null }

// Task 27: the client's 9 categories, in the client's words. Category keys of the 3 older categories are unchanged
// (outerwear, workwear, protective); their labels follow the client's names. Gloves, footwear and PPE use the product base template.
export const DEFAULT_GARMENT_CATEGORIES: GarmentCategory[] = [
  { key: 'workwear', label: 'General Workwear', sort: 10 },
  { key: 'hivis', label: 'High Visibility Workwear', sort: 20 },
  { key: 'fr-arc', label: 'Flame Resistant and Arc Rated Clothing', sort: 30 },
  { key: 'outerwear', label: 'Winter and Outdoor Workwear', sort: 40 },
  { key: 'protective', label: 'Specialized Protective Clothing', sort: 50 },
  { key: 'corporate', label: 'Corporate Apparel and Uniforms', sort: 60 },
  { key: 'gloves', label: 'Gloves and Hand Protection', sort: 70 },
  { key: 'footwear', label: 'Footwear', sort: 80 },
  { key: 'ppe', label: 'Other PPE and Accessories', sort: 90 },
];

// The 41 older types keep their key and label (older requests use them); only their category and sort change. Sort =
// category position x 1000 + position in the category x 10. NEW marks the 42 types added in task 27.
const NEW = true;
const LIBRARY: Record<string, Array<[string, string, boolean?]>> = {
  workwear: [
    ['jacket', 'Jacket'], ['coat', 'Coat'], ['pants', 'Work Pants'], ['cargo-pants', 'Cargo Pants'], ['coveralls', 'Coveralls'],
    ['overalls', 'Bib Overalls'], ['work-shirt', 'Work Shirt'], ['work-shorts', 'Work Shorts'], ['vest', 'Vest'], ['jacket-trouser-set', 'Jacket and Trouser Set'],
  ],
  hivis: [
    ['high-visibility-vest', 'High Visibility Vest'], ['hi-vis-jacket', 'Hi-Vis Jacket', NEW], ['hi-vis-pants', 'Hi-Vis Pants', NEW],
    ['hi-vis-coveralls', 'Hi-Vis Coveralls', NEW], ['reflective-shirt', 'Reflective Shirt', NEW], ['reflective-hoodie', 'Reflective Hoodie', NEW],
    ['hi-vis-rainwear', 'Hi-Vis Rainwear', NEW], ['high-visibility-clothing', 'High Visibility Clothing'],
  ],
  'fr-arc': [
    ['fr-coveralls', 'FR Coveralls'], ['fr-jacket', 'FR Jacket', NEW], ['fr-shirt', 'FR Shirt', NEW], ['fr-pants', 'FR Pants', NEW],
    ['inherent-fr-garment', 'Inherent FR Garment', NEW], ['arc-rated-clothing', 'Arc Rated Clothing'], ['arc-flash-suit', 'Arc Flash Suit', NEW],
    ['arc-flash-hood', 'Arc Flash Hood', NEW], ['welding-jacket', 'Welding Jacket'], ['welding-apron', 'Welding Apron'],
  ],
  outerwear: [
    ['winter-jacket', 'Winter Jacket'], ['parka', 'Parka'], ['four-in-one-jacket', '4-in-1 Jacket'], ['insulated-coveralls', 'Insulated Coveralls'],
    ['winter-bib-pants', 'Winter Bib Pants', NEW], ['softshell-jacket', 'Softshell Jacket'], ['fleece-jacket', 'Fleece Jacket'], ['rain-jacket', 'Rain Jacket'],
    ['waterproof-pants', 'Waterproof Pants', NEW], ['rain-suit', 'Rain Suit'], ['thermal-base-layer', 'Thermal Base Layer', NEW],
  ],
  protective: [
    ['chemical-protective-suit', 'Chemical Protective Suit'], ['disposable-coveralls', 'Disposable Coveralls'], ['disposable-gown', 'Disposable Visitor Gown'],
    ['aluminized-suit', 'Aluminized Heat Protection Suit'], ['firefighter-turnout-coat', 'Firefighter Turnout Coat'], ['firefighter-turnout-pants', 'Firefighter Turnout Pants'],
    ['firefighter-station-wear', 'Firefighter Station Wear'], ['survival-suit', 'Immersion / Survival Suit'], ['protective-apron', 'Protective Apron'],
    ['protective-sleeves', 'Protective Sleeves', NEW],
  ],
  corporate: [
    ['t-shirt', 'T Shirt'], ['polo-shirt', 'Polo Shirt'], ['hoodie', 'Hoodie'], ['sweatshirt', 'Sweatshirt'], ['dress-shirt', 'Dress Shirt or Blouse'],
    ['uniform-shirt-pants', 'Uniform Shirt and Pants', NEW], ['security-uniform', 'Security Uniform', NEW], ['corporate-jacket', 'Corporate Jacket', NEW],
    ['bomber-jacket', 'Bomber Jacket'], ['lab-coat', 'Lab Coat'], ['scrubs', 'Scrubs'], ['branded-apparel', 'Branded Apparel', NEW], ['hats-caps', 'Hats and Caps', NEW],
  ],
  gloves: [
    ['leather-work-gloves', 'Leather Work Gloves', NEW], ['cut-resistant-gloves', 'Cut Resistant Gloves', NEW], ['impact-resistant-gloves', 'Impact Resistant Gloves', NEW],
    ['welding-gloves', 'Welding Gloves', NEW], ['chemical-resistant-gloves', 'Chemical Resistant Gloves', NEW], ['disposable-gloves', 'Disposable Gloves', NEW],
    ['thermal-gloves', 'Thermal Gloves', NEW], ['general-purpose-gloves', 'General Purpose Work Gloves', NEW],
  ],
  footwear: [
    ['safety-boots', 'Safety Boots', NEW], ['work-shoes', 'Work Shoes', NEW], ['rubber-boots', 'Rubber Boots', NEW],
    ['chemical-resistant-boots', 'Chemical Resistant Boots', NEW], ['insulated-safety-boots', 'Insulated Safety Boots', NEW],
    ['industrial-footwear-other', 'Other Industrial Footwear', NEW],
  ],
  ppe: [
    ['protective-hood', 'Protective Hood', NEW], ['balaclava', 'Balaclava', NEW], ['face-covering', 'Face Covering', NEW],
    ['safety-harness', 'Safety Harness', NEW], ['back-support', 'Back Support', NEW], ['protective-accessory', 'Protective Accessory', NEW],
    ['custom-ppe-product', 'Custom PPE Product', NEW],
  ],
};

export const DEFAULT_GARMENT_TYPES: GarmentType[] = DEFAULT_GARMENT_CATEGORIES.flatMap((c, ci) =>
  LIBRARY[c.key].map(([key, label], i) => ({ key, label, category: c.key, sort: (ci + 1) * 1000 + (i + 1) * 10, active: true })));

/** The 42 types added in task 27 (the rest are the client's first 35 and the 6 catalogue types from 2026-10-30). */
export const ADDED_TYPE_KEYS: string[] = Object.values(LIBRARY).flatMap((rows) => rows.filter((r) => r[2]).map((r) => r[0]));
/** The 6 types from RIVIX's own catalogue (2026-10-30). */
export const CATALOGUE_TYPE_KEYS = ['four-in-one-jacket', 'jacket-trouser-set', 'dress-shirt', 'survival-suit', 'aluminized-suit', 'disposable-gown'];

/** Readable name for a stored key ("high-visibility-vest" -> "High Visibility Vest"). Unknown keys are tidied up instead of shown raw. */
export function garmentTypeLabel(key: string | null | undefined, types: GarmentType[] = DEFAULT_GARMENT_TYPES): string {
  if (!key) return '';
  const hit = types.find((x) => x.key === key);
  if (hit) return hit.label;
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
