// Task 27: templates for all 9 RIVIX categories (gloves, footwear, headwear, hoods, sleeves, back supports, harnesses,
// accessories, and two clothing kits), version 1, plus the template each new product type uses. Starting content, to refine
// with the client. Standards are CANDIDATES only, each with a source link, marked "to verify": the RIVIX compliance person
// confirms them before they are used, so none of them is in protective.standards yet.
// Plain data, client-safe, type-only imports (template-catalog.ts imports this file).
import type { TemplateItem, TemplatePoint, TemplateRecord, StandardCandidate } from './template-catalog';

const it = (key: string, label: string, source: 'photo' | 'document', required = true, section: TemplateItem['section'] = 'spec'): TemplateItem => ({ key, label, section, source, required });
const con = (key: string, label: string, source: 'photo' | 'document', required = true): TemplateItem => it(key, label, source, required, 'construction');
const pt = (code: string, name: string, method: TemplatePoint['method'], howToMeasure: string): TemplatePoint => ({ code, name, howToMeasure, method });
const cand = (standard: string, link: string, appliesTo?: string): StandardCandidate => ({ standard, link, status: 'to-verify', ...(appliesTo ? { appliesTo } : {}) });

// Every protective template keeps the "verify the current edition and the product scope" warning.
export const VERIFY_EVIDENCE = 'These standards are candidates only (to verify): the RIVIX compliance person confirms them before they are used. Verify the current edition and the product scope of each one. A reference brand\'s certification does not transfer to a RIVIX product: keep the test report and certificate for the actual product on file before any claim is made.';
const MARKINGS_RULE = 'Copy printed performance codes, pictograms and certification marks exactly as printed. Never infer or add a code that is not printed.';

// ---- standards, with the page each one was found on (2026-11-11), all "to verify" ---------------------------------------------
const S = {
  iso21420: cand('ISO 21420:2020 Protective gloves: general requirements', 'https://www.sis.se/en/produkter/environment-health-protection-safety/protective-equipment/protective-gloves/iso-214202020'),
  en388: cand('EN 388:2016+A1:2018 Protective gloves against mechanical risks', 'https://www.evs.ee/en/evs-en-388-2016-a1-2018-consolidated'),
  ansi105: cand('ANSI/ISEA 105-2024 Hand protection classification (gloves and sleeves)', 'https://safetyequipment.org/handprotectionclassifications/'),
  ansi138: cand('ANSI/ISEA 138-2019 Impact protection for hands', 'https://safetyequipment.org/?p=20033'),
  en12477: cand('EN 12477 Protective gloves for welders (2001 + A1:2005; revision in progress)', 'https://www.sis.se/en/produkter/environment-health-protection-safety/protective-equipment/protective-gloves/ssen12477/'),
  en407: cand('EN 407:2020 Protective gloves and arm protection against thermal risks', 'https://www.evs.ee/en/evs-en-407-2020'),
  en511: cand('EN 511:2006 Protective gloves against cold', 'https://knowledge.bsigroup.com/products/protective-gloves-against-cold'),
  iso374_1: cand('ISO 374-1:2024 Protective gloves against dangerous chemicals', 'https://www.iso.org/standard/83210.html'),
  iso374_5: cand('ISO 374-5:2024 Protective gloves against micro-organisms', 'https://scc-ccn.ca/standardsdb/standards/8185328'),
  csaZ195: cand('CSA Z195:14 (R2023) Protective footwear', 'https://www.csagroup.org/store/product/2422713/'),
  astmF2413: cand('ASTM F2413-24 Protective (safety) toe cap footwear', 'https://www.dinmedia.de/en/standard/astm-f-2413/382387304'),
  iso20345: cand('ISO 20345:2021 (+ Amd 1:2024) Safety footwear', 'https://www.iso.org/standard/73222.html'),
  en13832: cand('EN 13832 Footwear protecting against chemicals (parts 1 to 3; current edition unclear)', 'https://shop.standards.ie/en-ie/standards/en-13832-1-2006-327308_saig_cen_cen_753928'),
  csaZ259: cand('CSA Z259.10-18 (R2023) Full body harnesses', 'https://www.csagroup.org/store/product/2426322/'),
  ansiZ359: cand('ANSI/ASSP Z359.11-2021 Full body harnesses', 'https://webstore.ansi.org/standards/ASSP/ansiasspz359112021'),
  en361: cand('EN 361:2002 Full body harnesses (fall protection)', 'https://www.evs.ee/en/evs-en-361-2002'),
  astmF2178: cand('ASTM F2178/F2178M-23a Arc rated eye or face protective products', 'https://webstore.ansi.org/standards/astm/astmf2178f2178m23a', 'arc rated hoods and face protection only'),
};

const rec = (key: string, kind: TemplateRecord['kind'], label: string, description: string, body: Partial<TemplateRecord['body']>): TemplateRecord => ({
  key, kind, label, description, version: 1, active: true,
  body: { points: [], items: [], sizing: null, views: [], protective: null, certification: 'described', ...body },
});
const protectiveCandidates = (...c: StandardCandidate[]) => ({ protective: { standards: [], evidence: VERIFY_EVIDENCE }, standardCandidates: c });

export const ADDED_TEMPLATES: TemplateRecord[] = [
  // ---- base for products that are not clothing (gloves, footwear, other PPE) ----
  rec('product-base', 'base', 'Every product (not clothing)', 'Items every glove, footwear or PPE tech file asks for.', {
    items: [
      it('colour', 'Colour and colour placement', 'photo'),
      it('labels', 'Labels and markings: what is printed or attached, and where', 'photo'),
      it('branding', 'Logo and branding placement, size and method', 'photo', false),
      it('measurements', 'Finished measurements for every size', 'document'),
      it('packaging', 'Packing (pairs, boxes, cartons) and labelling', 'document', false),
    ],
  }),

  // ---- gloves ----
  rec('glove', 'family', 'Glove', 'Work and protective gloves: knit, cut-and-sewn, dipped or disposable.', {
    points: [
      pt('A', 'Overall length', 'length', 'From the tip of the middle finger to the edge of the cuff, glove laid flat'),
      pt('B', 'Palm width', 'flat', 'Straight across the palm at the base of the fingers, glove laid flat'),
      pt('C', 'Middle finger length', 'length', 'From the crotch between the middle and ring finger to the fingertip'),
      pt('D', 'Thumb length', 'length', 'From the thumb crotch to the tip of the thumb'),
      pt('E', 'Cuff length', 'length', 'From the cuff seam or start of the cuff to its edge'),
    ],
    items: [
      it('glove-style', 'Style: knit, cut-and-sewn, dipped or disposable', 'photo'),
      it('palm-material', 'Palm material', 'document'),
      it('back-material', 'Back material', 'document'),
      it('shell-liner', 'Shell or liner material, and gauge for knits', 'document'),
      it('coating', 'Coating: type, coverage (palm, three-quarter, full) and finish', 'document', false),
      con('finger-construction', 'Finger construction: gunn or clute cut, thumb type (wing, keystone, straight)', 'photo'),
      con('reinforcements', 'Reinforcements (thumb crotch, fingertips, palm patch)', 'photo', false),
      con('cuff', 'Cuff: type (knit wrist, safety, gauntlet) and length', 'photo'),
      it('glove-lining', 'Insulation or lining', 'document', false),
      con('glove-closure', 'Closure (hook and loop, elastic, none)', 'photo', false),
      it('glove-markings', `Markings on the glove. ${MARKINGS_RULE}`, 'photo'),
    ],
    sizing: { system: 'glove', note: 'Glove sizes (for example 6 to 11, or XS to XXL) from an approved size chart; never assumed.' },
    views: ['palm', 'back-of-hand'],
    standardCandidates: [S.iso21420, S.en388, S.ansi105],
  }),
  rec('glove-cut', 'module', 'Cut resistant', '', { items: [
    it('cut-level', 'Cut level as marked (ANSI/ISEA 105 A1 to A9, or EN 388 letter), from the product or the test report', 'document'),
    it('cut-material', 'Cut-resistant fibre or liner (for example HPPE, aramid, steel), with supplier data', 'document'),
  ], certification: 'needs-test-evidence', ...protectiveCandidates(S.ansi105, S.en388) }),
  rec('glove-impact', 'module', 'Impact resistant', '', { items: [
    it('impact-guards', 'Back-of-hand impact guards: material and placement (knuckles, fingers)', 'photo'),
    it('impact-level', 'Impact level as marked (ANSI/ISEA 138 level 1 to 3, or EN 388 "P"), from the product or the test report', 'document'),
  ], certification: 'needs-test-evidence', ...protectiveCandidates(S.ansi138, S.en388) }),
  rec('glove-welding', 'module', 'Welding glove', '', { items: [
    it('weld-leather', 'Leather type and thickness, and heat-resistant thread', 'document'),
    it('weld-glove-type', 'Welding glove type claimed (EN 12477 Type A or B), from the test report', 'document'),
    con('weld-gauntlet', 'Gauntlet cuff length', 'photo'),
  ], certification: 'needs-test-evidence', ...protectiveCandidates(S.en12477, S.en407) }),
  rec('glove-chemical', 'module', 'Chemical resistant', '', { items: [
    it('chem-glove-material', 'Glove material (nitrile, neoprene, PVC, butyl...) and thickness', 'document'),
    it('chem-permeation', 'Chemicals tested, with permeation and degradation data from the test report', 'document'),
    con('chem-cuff', 'Glove length and cuff finish (beaded, flock-lined...)', 'photo'),
  ], certification: 'needs-test-evidence', ...protectiveCandidates(S.iso374_1) }),
  rec('glove-disposable', 'module', 'Disposable glove', '', { items: [
    it('disp-material', 'Material (nitrile, latex, vinyl), thickness, and powder-free or not', 'document'),
    it('disp-barrier', 'Barrier claims (chemicals, micro-organisms), from the test report', 'document'),
    it('disp-pack', 'Box quantity and labelling', 'document', false),
  ], certification: 'needs-test-evidence', ...protectiveCandidates(S.iso374_5, S.iso374_1) }),
  rec('glove-thermal', 'module', 'Thermal (heat or cold)', '', { items: [
    it('therm-layer', 'Insulation for cold, or heat-resistant layer, with supplier data', 'document'),
    it('therm-rating', 'Thermal performance as marked (EN 407 heat, EN 511 cold), from the product or the test report', 'document'),
  ], certification: 'needs-test-evidence', ...protectiveCandidates(S.en407, S.en511) }),

  // ---- footwear ----
  rec('footwear', 'family', 'Footwear', 'Work shoes and boots.', {
    points: [
      pt('A', 'Shaft height', 'length', 'Inside, from the top of the insole at the heel to the top of the shaft'),
      pt('B', 'Outsole length', 'length', 'Along the outsole from heel to toe'),
      pt('C', 'Outsole width', 'flat', 'Straight across the outsole at the ball of the foot'),
      pt('D', 'Heel height', 'length', 'From the ground to the top of the heel at the back'),
    ],
    items: [
      it('fw-type', 'Type and shaft height (shoe, 6-inch boot, 8-inch boot, rubber boot)', 'photo'),
      it('upper', 'Upper material (leather, textile, rubber, PVC...)', 'document'),
      it('fw-lining', 'Lining', 'document', false),
      it('footbed', 'Footbed', 'document', false),
      it('midsole', 'Midsole', 'document', false),
      it('outsole', 'Outsole: material and tread pattern', 'photo'),
      con('fw-construction', 'Construction method: cemented, injected, welted or vulcanised', 'document'),
      con('fw-closure', 'Closure: laces, zip, pull-on, quick release', 'photo'),
      it('membrane', 'Waterproof membrane, if any', 'document', false),
      it('fw-markings', `Markings on the footwear. ${MARKINGS_RULE}`, 'photo'),
    ],
    sizing: { system: 'shoe-width', note: 'Shoe sizes with widths (for example 6 to 14, D and EE) from an approved size chart; never assumed.' },
    views: ['outer-side', 'inner-side', 'top', 'sole'],
  }),
  rec('safety-footwear', 'module', 'Safety footwear', '', { items: [
    it('toe-cap', 'Protective toe cap: steel, composite or alloy, with its rating from the certificate', 'document'),
    it('puncture-plate', 'Puncture-resistant plate (steel or textile), if claimed, from the certificate', 'document', false),
    it('metatarsal', 'Metatarsal guard (internal or external), if any', 'photo', false),
    it('electrical', 'Electrical protection type (electric shock resistant, static dissipative, conductive), from the certificate', 'document', false),
    it('cert-mark', `Certification marks on the product (for example the CSA patch). ${MARKINGS_RULE}`, 'photo'),
  ], certification: 'certified-equipment',
    protective: { standards: [], evidence: `Safety footwear must be certified by a third party for the market where it is sold (in Canada, to CSA Z195, with the CSA mark). This tech file describes the product; it never claims compliance. ${VERIFY_EVIDENCE}` },
    standardCandidates: [S.csaZ195, S.astmF2413, S.iso20345] }),
  rec('footwear-chemical', 'module', 'Chemical resistant footwear', '', { items: [
    it('chem-fw-material', 'Upper and outsole material (rubber, PVC, PU), with chemical resistance data from the test report', 'document'),
    con('chem-fw-build', 'Seamless or welded construction, and shaft height', 'photo'),
  ], certification: 'needs-test-evidence', ...protectiveCandidates(S.en13832) }),
  rec('footwear-insulated', 'module', 'Insulated footwear', '', { items: [
    it('fw-insulation', 'Insulation type and weight, from supplier data', 'document'),
    it('fw-cold-rating', 'Cold rating, if claimed, from a test report', 'document', false),
  ] }),

  // ---- headwear (textile hats and caps only) ----
  rec('headwear', 'family', 'Hat or cap', 'Textile hats and caps only.', {
    points: [
      pt('A', 'Head circumference', 'circumference', 'Inside, along the sweatband'),
      pt('B', 'Crown height', 'length', 'From the brim seam to the top of the crown'),
      pt('C', 'Brim or visor length', 'length', 'From the crown seam to the edge of the brim, along the centre'),
      pt('D', 'Brim width', 'flat', 'Straight across the brim at its widest'),
    ],
    items: [
      con('crown-panels', 'Crown: number of panels, structured or unstructured', 'photo'),
      con('front-panel', 'Front panel structure (buckram, fused, unstructured)', 'photo'),
      con('brim', 'Brim or visor: shape (flat, curved) and stiffener', 'photo'),
      con('hw-closure', 'Closure: snapback, hook and loop, buckle, stretch fit or fitted', 'photo'),
      it('sweatband', 'Sweatband material', 'document'),
      con('eyelets', 'Eyelets: number, embroidered or metal', 'photo', false),
    ],
    sizing: { system: 'head', note: 'Head sizes (for example S/M and L/XL, or fitted sizes) or one size with an adjustable closure, from an approved chart.' },
    views: ['front', 'side', 'back', 'top'],
    notes: ['Textile hats and caps only. Hard hats, bump caps and any other head protection are out of scope and must not be replicated from photos.'],
  }),

  // ---- hoods, balaclavas, face coverings ----
  rec('hood-face', 'family', 'Hood, balaclava or face covering', 'Hoods, balaclavas and face coverings.', {
    points: [
      pt('A', 'Face opening width', 'flat', 'Straight across the face opening'),
      pt('B', 'Face opening height', 'length', 'From the top to the bottom of the face opening'),
      pt('C', 'Overall length', 'length', 'From the top of the head to the bottom edge of the bib'),
      pt('D', 'Bib width', 'flat', 'Straight across the front bib at the hem'),
    ],
    items: [
      con('openings', 'Openings: face, eyes or full face, and how their edges are finished', 'photo'),
      it('layers', 'Layers: number and material of each layer', 'document'),
      con('fit', 'Fit: stretch, adjustable or fixed, and how it stays in place', 'photo'),
      con('bib', 'Bib or neck coverage over the shoulders', 'photo', false),
    ],
    sizing: { system: 'one-size', note: 'Usually one size; check the size range on the label.' },
    views: ['front', 'side', 'back'],
    notes: ['FR or arc rated hoods and face coverings take the FR or arc add-on; their rating comes from the fabric system test report, never from a photo.'],
    standardCandidates: [S.astmF2178],
  }),

  // ---- protective sleeves ----
  rec('sleeve', 'family', 'Protective sleeve', 'Arm protection sleeves (cut, heat or arc).', {
    points: [
      pt('A', 'Length', 'length', 'From the top edge to the wrist edge, laid flat'),
      pt('B', 'Top opening', 'flat', 'Straight across the top opening, laid flat'),
      pt('C', 'Wrist opening', 'flat', 'Straight across the wrist opening, laid flat'),
    ],
    items: [
      it('sleeve-material', 'Material and, where claimed, its protection (cut, heat, arc) from supplier data', 'document'),
      con('sleeve-ends', 'Top and wrist ends: elastic, thumb hole, hook and loop', 'photo'),
      it('sleeve-markings', `Markings on the sleeve. ${MARKINGS_RULE}`, 'photo', false),
    ],
    sizing: { system: 'one-size', note: 'Length options (for example 18 in and 22 in) from an approved list.' },
    views: ['front'],
    certification: 'needs-test-evidence',
    ...protectiveCandidates(S.ansi105, S.en388, S.en407),
  }),

  // ---- back supports ----
  rec('back-support', 'family', 'Back support', 'Work back support belts.', {
    points: [
      pt('A', 'Waist range', 'circumference', 'Smallest and largest waist the belt fits, closed'),
      pt('B', 'Back panel height', 'length', 'Height of the back panel at the centre back'),
    ],
    items: [
      it('bs-panel', 'Back panel: material and stays (number, rigid or flexible)', 'document'),
      con('bs-closure', 'Closure and tension straps', 'photo'),
      con('suspenders', 'Suspenders, if any', 'photo', false),
    ],
    sizing: { system: 'alpha', note: 'Sizes by waist range from an approved chart.' },
    views: ['front', 'back'],
    notes: ['Make no injury-prevention or medical claim in the tech file: describe the product only.'],
  }),

  // ---- safety harnesses (certified equipment) ----
  rec('harness', 'family', 'Safety harness', 'Full body harnesses for fall protection.', {
    items: [
      it('webbing', 'Webbing: material, width and colour', 'document'),
      it('d-rings', 'D-rings: number, positions (dorsal, sternal, side, shoulder) and material', 'photo'),
      it('buckles', 'Buckles: type (pass-through, quick-connect, tongue) and material', 'photo'),
      it('adjusters', 'Adjusters at the chest, legs and shoulders', 'photo'),
      it('harness-labels', `Labels: certification label, inspection grid and instructions. ${MARKINGS_RULE}`, 'photo'),
    ],
    sizing: { system: 'alpha', note: "Harness sizes from the manufacturer's chart." },
    views: ['front', 'back'],
    certification: 'certified-equipment',
    protective: { standards: [], evidence: `Certified equipment: compliance comes from the manufacturer's certification of the exact model, never from this tech file. This file describes the product only and must not claim compliance with any standard. ${VERIFY_EVIDENCE}` },
    standardCandidates: [S.csaZ259, S.ansiZ359, S.en361],
    notes: ["Compliance comes from the manufacturer's certification, never from this tech file."],
  }),

  // ---- any other accessory or custom product ----
  rec('accessory', 'family', 'Accessory or custom product', 'Any other textile or PPE product.', {
    items: [
      it('acc-what', 'What it is and how it is used', 'document'),
      it('acc-materials', 'Materials and components', 'document'),
      it('acc-dimensions', 'Main dimensions', 'document'),
      con('acc-attachment', 'How it attaches or closes', 'photo', false),
    ],
    sizing: { system: 'one-size', note: 'One size, or a size list from the customer.' },
    views: ['front', 'back'],
    notes: ['For any protective claim, attach the test report or certificate; this template makes none.'],
  }),

  // ---- clothing kits ----
  rec('base-layer-set', 'family', 'Thermal base layer (top and bottom)', 'A thermal base layer top and bottom, each with its own measurements.', {
    sizing: { system: 'alpha', note: 'See the top and the bottom.' }, views: ['front', 'back'], composedOf: ['shirt', 'trousers'],
  }),
  rec('shirt-trouser-set', 'family', 'Shirt and trouser set', 'A uniform shirt and trousers, each with its own measurements.', {
    sizing: { system: 'alpha', note: 'See the shirt and the trousers.' }, views: ['front', 'back'], composedOf: ['shirt', 'trousers'],
  }),
];

// The template each NEW product type uses (task 27). Existing types keep theirs (garment-templates.ts TYPE_TEMPLATES).
export const ADDED_TYPE_TEMPLATES: Record<string, { family: string; modules?: string[] }> = {
  'hi-vis-jacket': { family: 'jacket', modules: ['hivis'] },
  'hi-vis-pants': { family: 'trousers', modules: ['hivis'] },
  'hi-vis-coveralls': { family: 'coverall', modules: ['hivis'] },
  'reflective-shirt': { family: 'shirt', modules: ['hivis'] },
  'reflective-hoodie': { family: 'hoodie', modules: ['hivis'] },
  'hi-vis-rainwear': { family: 'rain-suit', modules: ['waterproof', 'hivis'] },
  'fr-jacket': { family: 'jacket', modules: ['fr'] },
  'fr-shirt': { family: 'shirt', modules: ['fr'] },
  'fr-pants': { family: 'trousers', modules: ['fr'] },
  'inherent-fr-garment': { family: 'protective-set', modules: ['fr'] },
  'arc-flash-suit': { family: 'coverall', modules: ['arc'] },
  'arc-flash-hood': { family: 'hood-face', modules: ['arc'] },
  'winter-bib-pants': { family: 'bib', modules: ['insulation'] },
  'waterproof-pants': { family: 'trousers', modules: ['waterproof'] },
  'thermal-base-layer': { family: 'base-layer-set' },
  'protective-sleeves': { family: 'sleeve' },
  'uniform-shirt-pants': { family: 'shirt-trouser-set' },
  'security-uniform': { family: 'shirt-trouser-set' },
  'corporate-jacket': { family: 'jacket' },
  'branded-apparel': { family: 'generic' },
  'hats-caps': { family: 'headwear' },
  'leather-work-gloves': { family: 'glove' },
  'cut-resistant-gloves': { family: 'glove', modules: ['glove-cut'] },
  'impact-resistant-gloves': { family: 'glove', modules: ['glove-impact'] },
  'welding-gloves': { family: 'glove', modules: ['glove-welding'] },
  'chemical-resistant-gloves': { family: 'glove', modules: ['glove-chemical'] },
  'disposable-gloves': { family: 'glove', modules: ['glove-disposable'] },
  'thermal-gloves': { family: 'glove', modules: ['glove-thermal'] },
  'general-purpose-gloves': { family: 'glove' },
  'safety-boots': { family: 'footwear', modules: ['safety-footwear'] },
  'work-shoes': { family: 'footwear' },
  'rubber-boots': { family: 'footwear' },
  'chemical-resistant-boots': { family: 'footwear', modules: ['footwear-chemical'] },
  'insulated-safety-boots': { family: 'footwear', modules: ['safety-footwear', 'footwear-insulated'] },
  'industrial-footwear-other': { family: 'footwear' },
  'protective-hood': { family: 'hood-face' },
  'balaclava': { family: 'hood-face' },
  'face-covering': { family: 'hood-face' },
  'safety-harness': { family: 'harness' },
  'back-support': { family: 'back-support' },
  'protective-accessory': { family: 'accessory' },
  'custom-ppe-product': { family: 'accessory' },
};

// Which base template each category uses (clothing categories keep 'garment-base').
export const CATEGORY_BASE: Record<string, string> = { gloves: 'product-base', footwear: 'product-base', ppe: 'product-base' };
