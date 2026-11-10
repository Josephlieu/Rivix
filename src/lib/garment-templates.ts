// Template structure for every garment type (Phase 1, milestone M2 of the client's guide).
// A garment type is built from: a FAMILY (the base shape: its measurement points, construction checklist, sizing structure and drawing views)
// plus optional MODULES (add-ons such as insulation, waterproofing, hi-vis, FR or arc rating that add checklist items and protective notes).
// Types such as scrubs, rain suit or arc rated clothing are COMPOSED of several families (a top and pants, and so on).
// This is plain data: nothing here is a measurement value. Target sizes, tolerances and grading come later from approved charts and samples.
// Client-safe (no server imports). Relative imports only.
// Since task 26 this is version 1 of the templates: the database is seeded from it, and it is the fallback when the
// database cannot be read. Changing it does NOT change the database; templates change by adding a version there (task 31).

/** Where a value usually comes from: 'photo' = often readable from a photo (still confirm), 'document' = needs a spec sheet, sample or supplier data. */
export type Source = 'photo' | 'document';

export interface MeasurementPoint {
  code: string; // letter used on the points-of-measure diagram
  name: string;
  definition: string; // how it is measured, so every factory measures the same way
  kind: 'flat' | 'length'; // flat = straight across the garment laid flat (half circumference); length = along the garment
}

export interface ChecklistItem {
  key: string;
  label: string;
  source: Source;
  required: boolean; // a required item must be filled in or confirmed before the tech file can be approved (used in M3)
}

export interface SizingStructure {
  style: 'alpha' | 'numeric' | 'waist-inseam' | 'height-based' | 'custom' | 'one-size';
  note: string; // sizes offered always come from an approved size chart, never assumed (no default XS to 6XL)
}

export interface ProtectiveInfo {
  standards: string[]; // standards to check for this kind of garment (verify the current edition and the product scope)
  evidence: string; // what must be on file before any claim is made
}

export interface Family {
  key: string;
  label: string;
  description: string;
  points: MeasurementPoint[];
  construction: ChecklistItem[];
  sizing: SizingStructure;
  views: Array<'front' | 'back' | 'side'>; // drawings the tech file needs (the drawings themselves are milestone M4)
  composedOf?: string[]; // for kits (scrubs, rain suit...): the families that make up the set
}

export interface Module {
  key: string;
  label: string;
  construction: ChecklistItem[];
  protective?: ProtectiveInfo;
}

export interface TypeTemplate { family: string; modules?: string[] }

const p = (code: string, name: string, kind: MeasurementPoint['kind'], definition: string): MeasurementPoint => ({ code, name, kind, definition });
const c = (key: string, label: string, source: Source, required = true): ChecklistItem => ({ key, label, source, required });

// ---- Checklist items every garment needs ------------------------------------------------------------------
export const COMMON_ITEMS: ChecklistItem[] = [
  c('fabric', 'Main fabric: composition, weight and construction', 'document'),
  c('colour', 'Colour and colour placement', 'photo'),
  c('thread-trims', 'Thread, zippers, buttons, snaps and other trims', 'document'),
  c('labels', 'Labels: main, care, size, and where each is placed', 'photo'),
  c('branding', 'Logo and branding placement, size and method (embroidery, print)', 'photo', false),
  c('seams', 'Seam types, stitching and reinforcement', 'photo'),
  c('measurements', 'Finished garment measurements for every size', 'document'),
  c('packaging', 'Folding, packing and carton instructions', 'document', false),
];

const LEN = 'Along the garment laid flat';

// ---- Families -----------------------------------------------------------------------------------------------
export const FAMILIES: Family[] = [
  {
    key: 'shirt', label: 'Shirt, polo and tee', description: 'Work shirts, polos and T shirts.',
    points: [
      p('A', 'Chest', 'flat', 'Straight across, 1 in (2.5 cm) below the armhole, seam to seam'),
      p('B', 'Shoulder', 'flat', 'Across the back from shoulder point to shoulder point'),
      p('C', 'Body length', 'length', 'From the high point of the shoulder (next to the neck) to the hem'),
      p('D', 'Sleeve length', 'length', 'From the shoulder point to the end of the sleeve or cuff'),
      p('E', 'Armhole', 'length', 'Straight line from the shoulder point to the underarm seam'),
      p('F', 'Bicep', 'flat', 'Straight across the sleeve, 1 in below the underarm'),
      p('G', 'Sleeve opening', 'flat', 'Straight across the end of the sleeve or cuff, relaxed'),
      p('H', 'Neck opening', 'flat', 'Straight across the collar or neck opening, seam to seam'),
      p('I', 'Hem width', 'flat', 'Straight across the bottom hem, relaxed'),
      p('J', 'Collar or placket length', 'length', 'Length of the collar stand or the front placket, as the style has one'),
    ],
    construction: [
      c('collar', 'Collar or neckline construction', 'photo'),
      c('front-closure', 'Placket and front closure (buttons, snaps, zip)', 'photo'),
      c('pockets', 'Pockets: number, position and construction', 'photo', false),
      c('sleeves-cuffs', 'Sleeve and cuff construction', 'photo'),
      c('hem', 'Hem finish', 'photo'),
    ],
    sizing: { style: 'alpha', note: 'Alpha sizes (and tall or regular where offered), taken from an approved chart.' },
    views: ['front', 'back'],
  },
  {
    key: 'hoodie', label: 'Hoodie and sweatshirt', description: 'Pullover and zip hoodies, crew sweatshirts.',
    points: [
      p('A', 'Chest', 'flat', 'Straight across, 1 in below the armhole, seam to seam'),
      p('B', 'Shoulder', 'flat', 'Across the back from shoulder point to shoulder point'),
      p('C', 'Body length', 'length', 'From the high point of the shoulder to the hem'),
      p('D', 'Sleeve length', 'length', 'From the shoulder point to the end of the cuff'),
      p('E', 'Bicep', 'flat', 'Straight across the sleeve, 1 in below the underarm'),
      p('F', 'Cuff opening', 'flat', 'Across the ribbed cuff, relaxed'),
      p('G', 'Hem or waistband width', 'flat', 'Across the ribbed hem, relaxed'),
      p('H', 'Neck opening', 'flat', 'Across the neck opening, seam to seam'),
      p('I', 'Hood height', 'length', 'From the neck seam to the top of the hood'),
      p('J', 'Hood width', 'flat', 'Across the widest part of the hood'),
    ],
    construction: [
      c('hood', 'Hood construction, lining and drawcord', 'photo', false),
      c('front', 'Front: zip, kangaroo pocket or plain', 'photo'),
      c('ribbing', 'Cuff, hem and waistband ribbing', 'photo'),
      c('pockets', 'Pocket construction', 'photo', false),
    ],
    sizing: { style: 'alpha', note: 'Alpha sizes from an approved chart.' },
    views: ['front', 'back'],
  },
  {
    key: 'jacket', label: 'Jacket, parka and coat', description: 'Jackets, parkas, coats and outerwear with sleeves.',
    points: [
      p('A', 'Chest', 'flat', 'Straight across, 1 in below the armhole, seam to seam'),
      p('B', 'Waist', 'flat', 'Straight across at the natural waist (halfway between the shoulder and the hem), closed'),
      p('C', 'Hem sweep', 'flat', 'Straight across the bottom hem, closed'),
      p('D', 'Shoulder', 'flat', 'Across the back from shoulder point to shoulder point'),
      p('E', 'Body length', 'length', 'From the high point of the shoulder to the hem'),
      p('F', 'Sleeve length', 'length', 'From the shoulder point to the end of the cuff'),
      p('G', 'Armhole', 'length', 'Straight line from the shoulder point to the underarm seam'),
      p('H', 'Bicep', 'flat', 'Straight across the sleeve, 1 in below the underarm'),
      p('I', 'Cuff opening', 'flat', 'Across the cuff, relaxed'),
      p('J', 'Neck opening', 'flat', 'Across the neck opening, seam to seam'),
      p('K', 'Hood height', 'length', 'From the neck seam to the top of the hood (if there is a hood)'),
      p('L', 'Hood width', 'flat', 'Across the widest part of the hood (if there is a hood)'),
      p('M', 'Pocket opening', 'length', 'Length of the main pocket opening'),
    ],
    construction: [
      c('front-closure', 'Front closure: zipper, snaps or buttons, and any storm flap', 'photo'),
      c('pockets', 'Pockets: chest, hand, inner. Position and construction', 'photo'),
      c('collar-hood', 'Collar and hood: adjusters, detachable or fixed', 'photo'),
      c('sleeves-cuffs', 'Sleeve construction and cuff finish (rib, elastic, tab)', 'photo'),
      c('hem', 'Hem finish and drawcord', 'photo'),
      c('lining', 'Lining and body panels (yokes, back vents)', 'document'),
      c('reflective', 'Reflective tape or trims: placement and width, if any', 'photo', false),
    ],
    sizing: { style: 'alpha', note: 'Alpha sizes from an approved chart; outerwear needs a layering allowance (see fit profile).' },
    views: ['front', 'back'],
  },
  {
    key: 'vest', label: 'Vest', description: 'Sleeveless outer garments.',
    points: [
      p('A', 'Chest', 'flat', 'Straight across, 1 in below the armhole, seam to seam'),
      p('B', 'Waist', 'flat', 'Straight across at the natural waist, closed'),
      p('C', 'Hem width', 'flat', 'Straight across the bottom hem, closed'),
      p('D', 'Shoulder', 'flat', 'Across the back from shoulder point to shoulder point'),
      p('E', 'Armhole', 'length', 'Straight line from the shoulder point to the underarm seam'),
      p('F', 'Body length', 'length', 'From the high point of the shoulder to the hem'),
      p('G', 'Neck opening', 'flat', 'Across the neck opening, seam to seam'),
    ],
    construction: [
      c('front-closure', 'Front closure: zipper, hook and loop or snaps', 'photo'),
      c('pockets', 'Pockets: number, position and construction', 'photo', false),
      c('armhole-neck', 'Armhole and neck finish (binding or facing)', 'photo'),
      c('hem', 'Hem finish', 'photo'),
      c('reflective', 'Reflective tape or trims: placement and width, if any', 'photo', false),
    ],
    sizing: { style: 'alpha', note: 'Alpha sizes from an approved chart; adjustable vests may be one size.' },
    views: ['front', 'back'],
  },
  {
    key: 'trousers', label: 'Pants and trousers', description: 'Work pants and cargo pants.',
    points: [
      p('A', 'Waist', 'flat', 'Straight across the top of the waistband, closed and relaxed'),
      p('B', 'Hip', 'flat', 'Straight across 7 in (18 cm) below the top of the waistband'),
      p('C', 'Seat', 'flat', 'Straight across at the crotch seam level'),
      p('D', 'Thigh', 'flat', 'Straight across the leg, 1 in below the crotch'),
      p('E', 'Knee', 'flat', 'Straight across the leg at the knee, halfway between the crotch and the hem'),
      p('F', 'Leg opening', 'flat', 'Straight across the bottom of the leg'),
      p('G', 'Front rise', 'length', 'From the crotch seam to the top of the waistband, front'),
      p('H', 'Back rise', 'length', 'From the crotch seam to the top of the waistband, back'),
      p('I', 'Inseam', 'length', 'From the crotch seam to the hem, along the inside of the leg'),
      p('J', 'Outseam', 'length', 'From the top of the waistband to the hem, along the outside of the leg'),
    ],
    construction: [
      c('waistband', 'Waistband, belt loops and closure (button, zip, hook)', 'photo'),
      c('fly', 'Fly construction', 'photo'),
      c('pockets', 'Pockets: front, back, cargo. Position and construction', 'photo'),
      c('knees', 'Knee reinforcement or knee pad pockets', 'photo', false),
      c('hem', 'Leg hem finish, cuffs or adjusters', 'photo'),
      c('reflective', 'Reflective tape or trims: placement and width, if any', 'photo', false),
    ],
    sizing: { style: 'waist-inseam', note: 'Waist and inseam are independent (for example 32 x 30); approved size chart required.' },
    views: ['front', 'back'],
  },
  {
    key: 'shorts', label: 'Shorts', description: 'Work shorts.',
    points: [
      p('A', 'Waist', 'flat', 'Straight across the top of the waistband, closed and relaxed'),
      p('B', 'Hip', 'flat', 'Straight across 7 in (18 cm) below the top of the waistband'),
      p('C', 'Seat', 'flat', 'Straight across at the crotch seam level'),
      p('D', 'Thigh', 'flat', 'Straight across the leg, 1 in below the crotch'),
      p('E', 'Leg opening', 'flat', 'Straight across the bottom of the leg'),
      p('F', 'Front rise', 'length', 'From the crotch seam to the top of the waistband, front'),
      p('G', 'Back rise', 'length', 'From the crotch seam to the top of the waistband, back'),
      p('H', 'Inseam', 'length', 'From the crotch seam to the hem'),
      p('I', 'Outseam', 'length', 'From the top of the waistband to the hem, along the outside'),
    ],
    construction: [
      c('waistband', 'Waistband and closure', 'photo'),
      c('pockets', 'Pockets: number, position and construction', 'photo'),
      c('hem', 'Leg hem finish', 'photo'),
    ],
    sizing: { style: 'waist-inseam', note: 'Waist sizes with a fixed or chosen inseam; approved size chart required.' },
    views: ['front', 'back'],
  },
  {
    key: 'coverall', label: 'Coverall', description: 'One-piece coveralls (plain, insulated, FR or disposable add-ons).',
    points: [
      p('A', 'Chest', 'flat', 'Straight across, 1 in below the armhole, seam to seam'),
      p('B', 'Waist', 'flat', 'Straight across at the natural waist, closed'),
      p('C', 'Hip', 'flat', 'Straight across the fullest part of the hip, closed'),
      p('D', 'Shoulder', 'flat', 'Across the back from shoulder point to shoulder point'),
      p('E', 'Torso length', 'length', 'From the high point of the shoulder to the crotch seam'),
      p('F', 'Crotch depth', 'length', 'From the waist seam down to the crotch seam'),
      p('G', 'Sleeve length', 'length', 'From the shoulder point to the end of the cuff'),
      p('H', 'Armhole', 'length', 'Straight line from the shoulder point to the underarm seam'),
      p('I', 'Thigh', 'flat', 'Straight across the leg, 1 in below the crotch'),
      p('J', 'Knee', 'flat', 'Straight across the leg at the knee'),
      p('K', 'Inseam', 'length', 'From the crotch seam to the hem, along the inside of the leg'),
      p('L', 'Leg opening', 'flat', 'Straight across the bottom of the leg'),
      p('M', 'Cuff opening', 'flat', 'Across the sleeve cuff, relaxed'),
      p('N', 'Neck opening', 'flat', 'Across the collar or neck opening'),
    ],
    construction: [
      c('front-closure', 'Front closure: zipper, storm flap, snaps', 'photo'),
      c('collar', 'Collar construction', 'photo'),
      c('pockets', 'Pockets: chest, hip, leg. Position and construction', 'photo'),
      c('waist-back', 'Waist treatment and back (elastic, belt, action back)', 'photo'),
      c('sleeves-cuffs', 'Sleeve and cuff finish', 'photo'),
      c('leg-hem', 'Leg opening: zipper, snaps or plain, and boot access', 'photo'),
      c('reflective', 'Reflective tape or trims: placement and width, if any', 'photo', false),
    ],
    sizing: { style: 'alpha', note: 'Alpha sizes with regular, short and tall lengths where offered; approved size chart required.' },
    views: ['front', 'back'],
  },
  {
    key: 'bib', label: 'Bib overall', description: 'Bib overalls (no sleeves, with straps).',
    points: [
      p('A', 'Waist', 'flat', 'Straight across the waist seam, closed and relaxed'),
      p('B', 'Seat', 'flat', 'Straight across at the crotch seam level'),
      p('C', 'Bib height', 'length', 'From the waist seam to the top edge of the bib'),
      p('D', 'Bib width', 'flat', 'Straight across the top of the bib'),
      p('E', 'Strap length', 'length', 'Total strap length from the bib to the back attachment, adjusted to the middle'),
      p('F', 'Front rise', 'length', 'From the crotch seam to the waist seam, front'),
      p('G', 'Back rise', 'length', 'From the crotch seam to the waist seam, back'),
      p('H', 'Thigh', 'flat', 'Straight across the leg, 1 in below the crotch'),
      p('I', 'Knee', 'flat', 'Straight across the leg at the knee'),
      p('J', 'Inseam', 'length', 'From the crotch seam to the hem, along the inside of the leg'),
      p('K', 'Leg opening', 'flat', 'Straight across the bottom of the leg'),
    ],
    construction: [
      c('bib-pocket', 'Bib pocket(s): position and construction', 'photo'),
      c('straps', 'Straps: material, adjusters and buckles', 'photo'),
      c('waist-sides', 'Waist and side closures (buttons, snaps, zip)', 'photo'),
      c('leg-pockets', 'Leg pockets, hammer loop, knee reinforcement', 'photo', false),
      c('leg-hem', 'Leg hem and any side zip or boot access', 'photo'),
    ],
    sizing: { style: 'waist-inseam', note: 'Waist and inseam sizes or alpha with length variants; approved size chart required.' },
    views: ['front', 'back'],
  },
  {
    key: 'labcoat', label: 'Lab coat', description: 'Lab coats and similar knee-length coats.',
    points: [
      p('A', 'Chest', 'flat', 'Straight across, 1 in below the armhole, seam to seam'),
      p('B', 'Waist', 'flat', 'Straight across at the natural waist, closed'),
      p('C', 'Hip', 'flat', 'Straight across 7 in below the waist, closed'),
      p('D', 'Shoulder', 'flat', 'Across the back from shoulder point to shoulder point'),
      p('E', 'Back length', 'length', 'From the high point of the shoulder to the hem'),
      p('F', 'Sleeve length', 'length', 'From the shoulder point to the end of the cuff'),
      p('G', 'Bicep', 'flat', 'Straight across the sleeve, 1 in below the underarm'),
      p('H', 'Cuff opening', 'flat', 'Across the cuff, relaxed'),
      p('I', 'Hem width', 'flat', 'Straight across the bottom hem, closed'),
    ],
    construction: [
      c('collar', 'Collar and lapel', 'photo'),
      c('front-closure', 'Front closure (buttons, snaps) and overlap', 'photo'),
      c('pockets', 'Pockets: chest and hip, position and construction', 'photo'),
      c('back', 'Back: vent, belt or plain', 'photo', false),
    ],
    sizing: { style: 'alpha', note: 'Alpha sizes, men and women charts separate; approved size chart required.' },
    views: ['front', 'back'],
  },
  {
    key: 'scrub-top', label: 'Scrub top', description: 'The top half of scrubs.',
    points: [
      p('A', 'Chest', 'flat', 'Straight across, 1 in below the armhole, seam to seam'),
      p('B', 'Shoulder', 'flat', 'Across the back from shoulder point to shoulder point'),
      p('C', 'Body length', 'length', 'From the high point of the shoulder to the hem'),
      p('D', 'Sleeve length', 'length', 'From the shoulder point to the end of the sleeve'),
      p('E', 'Neck opening', 'flat', 'Across the neck opening, seam to seam'),
      p('F', 'Hem width', 'flat', 'Straight across the bottom hem'),
      p('G', 'Pocket size', 'length', 'Width and depth of the main pocket'),
    ],
    construction: [
      c('neckline', 'Neckline style (V neck, crew) and finish', 'photo'),
      c('pockets', 'Pockets: chest and waist, position and construction', 'photo'),
      c('side-vents', 'Side vents and hem finish', 'photo'),
    ],
    sizing: { style: 'alpha', note: 'Alpha sizes, men and women charts separate; approved size chart required.' },
    views: ['front', 'back'],
  },
  {
    key: 'scrub-pants', label: 'Scrub pants', description: 'The pants half of scrubs.',
    points: [
      p('A', 'Waist', 'flat', 'Straight across the waistband, relaxed (and stretched if elastic)'),
      p('B', 'Hip', 'flat', 'Straight across 7 in below the top of the waistband'),
      p('C', 'Front rise', 'length', 'From the crotch seam to the top of the waistband, front'),
      p('D', 'Back rise', 'length', 'From the crotch seam to the top of the waistband, back'),
      p('E', 'Thigh', 'flat', 'Straight across the leg, 1 in below the crotch'),
      p('F', 'Knee', 'flat', 'Straight across the leg at the knee'),
      p('G', 'Leg opening', 'flat', 'Straight across the bottom of the leg'),
      p('H', 'Inseam', 'length', 'From the crotch seam to the hem'),
      p('I', 'Outseam', 'length', 'From the top of the waistband to the hem'),
    ],
    construction: [
      c('waistband', 'Waistband: elastic, drawcord or both', 'photo'),
      c('pockets', 'Pockets: side, back, cargo. Position and construction', 'photo'),
      c('leg-hem', 'Leg hem or cuff', 'photo'),
    ],
    sizing: { style: 'alpha', note: 'Alpha sizes with regular, petite and tall lengths where offered; approved size chart required.' },
    views: ['front', 'back'],
  },
  {
    key: 'apron', label: 'Apron', description: 'Welding and protective aprons.',
    points: [
      p('A', 'Width (top)', 'flat', 'Straight across the top of the apron'),
      p('B', 'Width (bottom)', 'flat', 'Straight across the bottom of the apron'),
      p('C', 'Length', 'length', 'From the top edge to the bottom edge'),
      p('D', 'Neck strap length', 'length', 'Total length of the neck strap, adjusted to the middle'),
      p('E', 'Waist strap length', 'length', 'Total length of the waist ties or straps'),
      p('F', 'Chest coverage', 'length', 'Height of the chest section'),
    ],
    construction: [
      c('straps', 'Straps, ties and fastening', 'photo'),
      c('edges', 'Edge binding and reinforcement', 'photo'),
      c('pockets', 'Pockets, if any', 'photo', false),
    ],
    sizing: { style: 'one-size', note: 'Usually one size or a small set of lengths; confirm with the wearer dimensions.' },
    views: ['front', 'back'],
  },
  {
    key: 'turnout-coat', label: 'Firefighter turnout coat', description: 'Structural firefighting coat (layered ensemble).',
    points: [
      p('A', 'Chest', 'flat', 'Straight across, 1 in below the armhole, seam to seam'),
      p('B', 'Waist', 'flat', 'Straight across at the natural waist, closed'),
      p('C', 'Hip', 'flat', 'Straight across 7 in below the waist, closed'),
      p('D', 'Shoulder', 'flat', 'Across the back from shoulder point to shoulder point'),
      p('E', 'Body length', 'length', 'From the high point of the shoulder to the hem'),
      p('F', 'Sleeve length', 'length', 'From the shoulder point to the end of the cuff'),
      p('G', 'Armhole', 'length', 'Straight line from the shoulder point to the underarm seam'),
      p('H', 'Cuff opening', 'flat', 'Across the cuff, relaxed'),
      p('I', 'Collar height', 'length', 'Height of the collar at the back'),
      p('J', 'Front overlap', 'length', 'Width the two fronts overlap when closed'),
    ],
    construction: [
      c('layers', 'Layers: outer shell, moisture barrier, thermal liner (and how they attach)', 'document'),
      c('closure', 'Closure system and storm flap', 'photo'),
      c('collar', 'Collar and throat tab', 'photo'),
      c('wristlets', 'Sleeve wristlets and cuffs', 'photo'),
      c('trim', 'Reflective trim layout', 'photo'),
      c('hardware', 'Drag rescue device, hardware and radio pockets', 'photo', false),
    ],
    sizing: { style: 'custom', note: 'Made to measure or from the maker\'s own chart (for example by chest and length); ensemble compatibility matters.' },
    views: ['front', 'back'],
  },
  {
    key: 'turnout-pants', label: 'Firefighter turnout pants', description: 'Structural firefighting pants (layered ensemble).',
    points: [
      p('A', 'Waist', 'flat', 'Straight across the top of the waistband, closed'),
      p('B', 'Hip', 'flat', 'Straight across 7 in below the top of the waistband'),
      p('C', 'Seat', 'flat', 'Straight across at the crotch seam level'),
      p('D', 'Thigh', 'flat', 'Straight across the leg, 1 in below the crotch'),
      p('E', 'Knee', 'flat', 'Straight across the leg at the knee'),
      p('F', 'Leg opening', 'flat', 'Straight across the bottom of the leg (must fit over the boot)'),
      p('G', 'Rise', 'length', 'From the crotch seam to the top of the waistband'),
      p('H', 'Inseam', 'length', 'From the crotch seam to the hem'),
      p('I', 'Outseam', 'length', 'From the top of the waistband to the hem'),
    ],
    construction: [
      c('layers', 'Layers: outer shell, moisture barrier, thermal liner', 'document'),
      c('suspenders', 'Suspender attachment and waist closure', 'photo'),
      c('knees', 'Knee reinforcement and articulation', 'photo'),
      c('boot', 'Boot compatibility and cuff reinforcement', 'document'),
      c('trim', 'Reflective trim layout', 'photo'),
    ],
    sizing: { style: 'custom', note: 'Made to measure or from the maker\'s own chart; boot compatibility matters.' },
    views: ['front', 'back'],
  },
  {
    key: 'chemical-suit', label: 'Chemical protective suit', description: 'Encapsulating or hooded chemical protective suits.',
    points: [
      p('A', 'Height range', 'length', 'The wearer height range the suit is made for'),
      p('B', 'Chest', 'flat', 'Straight across, 1 in below the armhole, seam to seam'),
      p('C', 'Waist', 'flat', 'Straight across at the natural waist, relaxed'),
      p('D', 'Hip', 'flat', 'Straight across the fullest part of the hip'),
      p('E', 'Torso length', 'length', 'From the high point of the shoulder to the crotch seam'),
      p('F', 'Sleeve length', 'length', 'From the shoulder point to the end of the sleeve'),
      p('G', 'Inseam', 'length', 'From the crotch seam to the hem'),
      p('H', 'Hood opening', 'flat', 'Across the face opening of the hood, relaxed'),
      p('I', 'Cuff and ankle openings', 'flat', 'Across the elastic or sealed openings, relaxed'),
    ],
    construction: [
      c('barrier', 'Barrier material and what it protects against', 'document'),
      c('seams', 'Seam type (stitched, taped, welded) and sealing', 'document'),
      c('closure', 'Zipper and storm flap closure', 'photo'),
      c('hood-gloves-boots', 'Hood, gloves and boots: attached or separate', 'photo'),
    ],
    sizing: { style: 'height-based', note: 'Sized by wearer height and chest from the maker\'s chart.' },
    views: ['front', 'back'],
  },
  {
    key: 'generic', label: 'General garment', description: 'Used when a garment type has no template yet. Fill in the key dimensions yourself.',
    points: [
      p('A', 'Width', 'flat', 'The main width of the garment laid flat'),
      p('B', 'Length', 'length', 'The main length of the garment'),
      p('C', 'Other key dimension', 'length', 'Add the dimension that matters for this garment'),
    ],
    construction: [c('construction', 'Main construction details', 'photo')],
    sizing: { style: 'custom', note: 'Confirm the size structure with the client.' },
    views: ['front', 'back'],
  },
  {
    key: 'survival-suit', label: 'Immersion / survival suit', description: 'Cold-water immersion and survival suits (marine, fisheries).',
    points: [
      p('A', 'Height range', 'length', 'The wearer height range the suit is made for'),
      p('B', 'Chest', 'flat', 'Straight across, 1 in below the armhole, seam to seam, closed'),
      p('C', 'Torso length', 'length', 'From the high point of the shoulder to the crotch seam'),
      p('D', 'Sleeve length', 'length', 'From the shoulder point to the end of the sleeve (before the mitt)'),
      p('E', 'Inseam', 'length', 'From the crotch seam to the ankle seam'),
      p('F', 'Hood opening', 'flat', 'Across the face opening of the hood, relaxed'),
      p('G', 'Wrist seal opening', 'flat', 'Across the wrist seal, relaxed'),
      p('H', 'Foot length', 'length', 'Inside length of the attached foot or boot'),
    ],
    construction: [
      c('closure', 'Waterproof zipper and storm flap', 'photo'),
      c('seals', 'Face, neck and wrist seals', 'photo'),
      c('hood-hands-feet', 'Hood, mitts and feet: attached or separate', 'photo'),
      c('flotation', 'Flotation material, rating and placement', 'document'),
      c('lifting', 'Lifting loop, whistle and light attachments', 'photo', false),
    ],
    sizing: { style: 'height-based', note: 'Sized by wearer height and weight range from the maker\'s chart; universal sizes are common.' },
    views: ['front', 'back'],
  },
  {
    key: 'gown', label: 'Disposable gown', description: 'Single-use visitor and protective gowns (non-woven).',
    points: [
      p('A', 'Chest width', 'flat', 'Straight across the body at the underarm, seam to seam'),
      p('B', 'Body length', 'length', 'From the high point of the shoulder to the hem'),
      p('C', 'Sleeve length', 'length', 'From the shoulder point to the end of the cuff'),
      p('D', 'Neck opening', 'flat', 'Across the neck opening, relaxed'),
      p('E', 'Cuff opening', 'flat', 'Across the elastic cuff, relaxed'),
      p('F', 'Tie length', 'length', 'Length of each tie (neck and waist)'),
    ],
    construction: [
      c('material', 'Non-woven material, layers and weight (gsm)', 'document'),
      c('neck-closure', 'Neck closure (tie-neck or snap)', 'photo'),
      c('waist-ties', 'Waist ties: position and length', 'photo'),
      c('cuffs', 'Cuffs: elastic or knit', 'photo'),
      c('sterility', 'Sterile or non-sterile, single use', 'document'),
      c('box-packing', 'Pieces per box, boxes per pallet', 'document', false),
    ],
    sizing: { style: 'alpha', note: 'Alpha sizes (for example S to XXL) from the maker\'s chart; the fabric weight may be offered in several options.' },
    views: ['front', 'back'],
  },
  // ---- Kits: made of several families ---------------------------------------------------------------------------
  { key: 'scrubs', label: 'Scrubs (top and pants)', description: 'A scrub set: top and pants, each with its own measurements.', points: [], construction: [], sizing: { style: 'alpha', note: 'See the top and the pants.' }, views: ['front', 'back'], composedOf: ['scrub-top', 'scrub-pants'] },
  { key: 'rain-suit', label: 'Rain suit (jacket and pants)', description: 'A rain jacket with rain pants.', points: [], construction: [], sizing: { style: 'alpha', note: 'See the jacket and the pants.' }, views: ['front', 'back'], composedOf: ['jacket', 'trousers'] },
  { key: 'station-wear', label: 'Station wear (shirt and pants)', description: 'Firefighter station wear: shirt and pants.', points: [], construction: [], sizing: { style: 'alpha', note: 'See the shirt and the pants.' }, views: ['front', 'back'], composedOf: ['shirt', 'trousers'] },
  { key: 'two-piece-set', label: 'Jacket and trouser set', description: 'A matching two-piece set: jacket and trousers, each with its own measurements.', points: [], construction: [], sizing: { style: 'alpha', note: 'See the jacket and the trousers.' }, views: ['front', 'back'], composedOf: ['jacket', 'trousers'] },
  { key: 'aluminized-set', label: 'Aluminized suit (jacket and trousers)', description: 'Heat-reflective aluminized jacket and trousers (hood, gloves and boots are separate products).', points: [], construction: [], sizing: { style: 'alpha', note: 'See the jacket and the trousers.' }, views: ['front', 'back'], composedOf: ['jacket', 'trousers'] },
  { key: 'protective-set', label: 'Protective clothing set', description: 'Hi-vis or arc rated clothing: a shirt, pants, jacket, coverall or vest chosen per project.', points: [], construction: [], sizing: { style: 'alpha', note: 'See the chosen garment.' }, views: ['front', 'back'], composedOf: ['shirt', 'trousers', 'jacket', 'coverall', 'vest'] },
];

// ---- Modules (add-ons) ---------------------------------------------------------------------------------------
const WARN = 'A reference brand\'s certification does not transfer to a RIVIX garment: keep the test report and certificate for the actual product on file before any claim is made.';

export const MODULES: Module[] = [
  { key: 'insulation', label: 'Insulated', construction: [
    c('insulation', 'Insulation: type, weight and where it is placed', 'document'),
    c('lining-layers', 'Lining and layering (shell, insulation, lining)', 'document'),
    c('fit-allowance', 'Layering allowance in the fit (room for clothing underneath)', 'document'),
  ] },
  { key: 'waterproof', label: 'Waterproof', construction: [
    c('membrane', 'Waterproof fabric or membrane and its rating', 'document'),
    c('seam-sealing', 'Sealed or taped seams', 'document'),
    c('weather-closures', 'Storm flaps, adjustable hood, cuffs and hem for weather protection', 'photo'),
  ] },
  { key: 'hivis', label: 'High visibility', construction: [
    c('background', 'Fluorescent background fabric: colour and area', 'photo'),
    c('tape-layout', 'Reflective tape: material, width, horizontal and vertical positions', 'photo'),
    c('garment-class', 'Garment class or type claimed (to be checked against the standard)', 'document'),
  ], protective: { standards: ['CSA Z96', 'ANSI/ISEA 107', 'ISO 13688'], evidence: WARN } },
  { key: 'fr', label: 'Flame resistant', construction: [
    c('fr-fabric', 'FR fabric, rating and supplier test data', 'document'),
    c('fr-trims', 'FR thread, zippers and trims', 'document'),
    c('fr-testing', 'Required tests and test reports', 'document'),
  ], protective: { standards: ['NFPA 2112', 'ASTM F1506', 'ISO 13688'], evidence: WARN } },
  { key: 'arc', label: 'Arc rated', construction: [
    c('arc-rating', 'Arc rating (value and test method) of the fabric system', 'document'),
    c('arc-coverage', 'Protective overlap, closures and coverage', 'photo'),
    c('arc-testing', 'Required tests and test reports', 'document'),
  ], protective: { standards: ['ASTM F1506', 'NFPA 70E (for workplace selection)', 'ISO 13688'], evidence: WARN } },
  { key: 'welding', label: 'Welding protection', construction: [
    c('weld-material', 'Protective material (leather or FR fabric) and weight', 'document'),
    c('weld-coverage', 'Coverage: collar, sleeves, front and closure design', 'photo'),
  ], protective: { standards: ['ISO 13688', 'Standard for welding clothing that applies in the destination market'], evidence: WARN } },
  { key: 'firefighter', label: 'Firefighter ensemble', construction: [
    c('ensemble', 'Ensemble compatibility with helmet, hood, gloves and boots', 'document'),
    c('thermal', 'Thermal performance and test data', 'document'),
    c('overlap', 'Protective overlap between coat and pants', 'document'),
  ], protective: { standards: ['NFPA 1970 (check the current edition)'], evidence: WARN } },
  { key: 'chemical', label: 'Chemical protection', construction: [
    c('compat', 'Chemical compatibility and permeation data', 'document'),
    c('suit-seams', 'Seam and closure sealing tested', 'document'),
  ], protective: { standards: ['ISO 13688', 'The chemical protective clothing standard that applies to the intended use'], evidence: WARN } },
  { key: 'immersion', label: 'Immersion protection', construction: [
    c('buoyancy', 'Buoyancy: material, rating and test data', 'document'),
    c('cold-water', 'Thermal insulation for cold water and how it was tested', 'document'),
    c('marking', 'Retroreflective material, whistle and light', 'photo', false),
  ], protective: { standards: ['CAN/CGSB 65.16 (check the edition)', 'IMO LSA Code, where it applies', 'Transport Canada approval for the exact model and the vessel requirements'], evidence: WARN } },
  { key: 'heat-reflective', label: 'Heat reflective (aluminized)', construction: [
    c('outer-layer', 'Aluminized outer layer and the base fabric it is bonded to', 'document'),
    c('thermal-layers', 'Thermal liner and layers', 'document'),
    c('heat-data', 'Radiant heat performance data from a test report', 'document'),
    c('sealing', 'Closures and overlaps at collar, wrists, legs and front', 'photo'),
  ], protective: { standards: ['The standard for aluminized proximity or heat protective clothing that applies to the intended use (verify the edition)', 'ISO 13688'], evidence: WARN } },
  { key: 'disposable', label: 'Disposable', construction: [
    c('barrier', 'Material barrier (particles, liquids) and rating', 'document'),
    c('hood-cuffs', 'Hood, cuffs and ankles (elastic) and zipper', 'photo'),
    c('single-use', 'Single use: pack size and labelling', 'document', false),
  ] },
];

// ---- Which family and modules each garment type uses (keys match garment-types-data.ts) -----------------------
export const TYPE_TEMPLATES: Record<string, TypeTemplate> = {
  jacket: { family: 'jacket' },
  parka: { family: 'jacket', modules: ['insulation'] },
  coat: { family: 'jacket' },
  'bomber-jacket': { family: 'jacket' },
  'softshell-jacket': { family: 'jacket' },
  'rain-jacket': { family: 'jacket', modules: ['waterproof'] },
  'winter-jacket': { family: 'jacket', modules: ['insulation'] },
  'fleece-jacket': { family: 'jacket' },
  vest: { family: 'vest' },
  'high-visibility-vest': { family: 'vest', modules: ['hivis'] },
  'work-shirt': { family: 'shirt' },
  'polo-shirt': { family: 'shirt' },
  't-shirt': { family: 'shirt' },
  hoodie: { family: 'hoodie' },
  sweatshirt: { family: 'hoodie' },
  pants: { family: 'trousers' },
  'cargo-pants': { family: 'trousers' },
  'work-shorts': { family: 'shorts' },
  coveralls: { family: 'coverall' },
  overalls: { family: 'bib' },
  'insulated-coveralls': { family: 'coverall', modules: ['insulation'] },
  'fr-coveralls': { family: 'coverall', modules: ['fr'] },
  'lab-coat': { family: 'labcoat' },
  scrubs: { family: 'scrubs' },
  'firefighter-turnout-coat': { family: 'turnout-coat', modules: ['firefighter'] },
  'firefighter-turnout-pants': { family: 'turnout-pants', modules: ['firefighter'] },
  'firefighter-station-wear': { family: 'station-wear' },
  'chemical-protective-suit': { family: 'chemical-suit', modules: ['chemical'] },
  'disposable-coveralls': { family: 'coverall', modules: ['disposable'] },
  'welding-jacket': { family: 'jacket', modules: ['welding'] },
  'welding-apron': { family: 'apron', modules: ['welding'] },
  'protective-apron': { family: 'apron' },
  'rain-suit': { family: 'rain-suit', modules: ['waterproof'] },
  'high-visibility-clothing': { family: 'protective-set', modules: ['hivis'] },
  'arc-rated-clothing': { family: 'protective-set', modules: ['arc'] },
  'four-in-one-jacket': { family: 'jacket', modules: ['insulation'] },
  'jacket-trouser-set': { family: 'two-piece-set' },
  'dress-shirt': { family: 'shirt' },
  'survival-suit': { family: 'survival-suit', modules: ['immersion'] },
  'aluminized-suit': { family: 'aluminized-set', modules: ['heat-reflective'] },
  'disposable-gown': { family: 'gown' },
};

export const familyByKey = (key: string | null | undefined): Family | undefined => FAMILIES.find((f) => f.key === key);
export const moduleByKey = (key: string): Module | undefined => MODULES.find((m) => m.key === key);

// resolveTemplate() and familyKeyFor() moved to ./template-catalog.ts (task 26): templates are now read from the database,
// and this file is the seed (scripts/generate-template-seed.mjs) and the code fallback (BUILT_IN_CATALOG).
