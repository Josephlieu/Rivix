// AI scan wording (2026-11-20, small-fixes): what a scan may and may not claim, enforced in code, and how it is shown.
//   1a. never "reflective" from a photo alone: the stored value is untouched; a flag "Looks reflective: needs confirmation" is
//       shown on screen and in the PDF; reflective checklist items always need a person (never "read from photo"); scanning
//       or saving twice changes nothing.
//   1b. one colourway per tech file: the body colour is split only when its parts carry different "(photo N)" numbers;
//       a plain ";" is only flagged.
//   1c. no inferred parts: hardware with no matching component in the photos goes to "Not seen in the photos: confirm or
//       remove" (Review tab only, not the factory PDF); Fill-from-AI ignores it.
//   1e. the cover note: "drafted by AI" only for a scan (the server's source marker, or the old product-ID + confidence
//       signal); "No AI scan was run" only for a draft the server marked as made by hand; otherwise neutral wording.
// Offline: no database, no server, no AI call (the answers are made up here).
// Run: node scripts/e2e/scan-wording.test.mjs   (it runs this file under the .tsx loader)
import fs from 'fs';
import * as R from './template-display.render.mjs';

const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const S = await import('../../src/lib/scan-template.ts');
const K = R.K; // checklist-confirm.ts
const Tfs = await import('../../src/lib/techFileStandards.ts');
const Shape = await import('../../src/lib/analysis-shape.ts');
const stable = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const jt = R.C.resolveTemplate('jacket', null, R.C.BUILT_IN_CATALOG);
const REFLECTIVE_FLAG = 'Looks reflective: needs confirmation';
const scan = (answer, key = 'jacket', t = jt) => S.finishScan(structuredClone(answer), { template: t, typeKey: key, typeName: key, photoCount: 2, kind: S.scanRequest({ template: t, typeKey: key, typeName: key, photoCount: 2 }).kind });
const item = (a, key) => (a.checklist || []).find((c) => c.key === key);
const blankSpecs = { coreMaterial: '', liningMaterial: '', fabricWeight: '', zippers: '', buttonsSnaps: '', reflectiveStriping: '', pocketsCount: '', seamConstruction: '' };
const pdfOf = (a, specs = {}) => R.pdfTexts(R.makeRep('jacket', a, { specs }), jt);
const reviewOf = (a) => text(R.drawReview(R.makeRep('jacket', a)));

// A made-up jacket answer: a snap and a band that looks reflective are seen; the AI also lists a zipper nobody can see,
// two colourways from two photos, and calls the reflective item and the zipper closure certain.
const answer = {
  productIdentification: { mode: 'visual', brand: null, model: null, source: 'photos' },
  garmentClass: 'Hip-length work jacket', hasHood: false, overallConfidence: 80,
  components: [
    { id: 'c1', type: 'snap', label: 'Snap cuffs', location: 'both cuffs', confidence: 80, x: 10, y: 80 },
    { id: 'c2', type: 'reflective', label: 'Chest band', location: 'chest', confidence: 70, x: 50, y: 40 },
  ],
  fabricAnalysis: { material: 'not visible', weight: 'not visible', weaveType: 'not visible', frRating: '', finish: 'not visible', shrinkage: '', confidence: 10 },
  measurements: [],
  bom: { hardware: ['Front zipper under storm flap', 'Snap cuffs', 'Woven main label'], thread: [], labels: [], packaging: { foldDescription: '', polybagSize: '', cartonSize: '', hangtagSpec: '' } },
  construction: [], stitchReference: [], labelPlacements: [],
  colorway: { bodyColor: 'gold (photo 1); navy (photo 2)', contrastColors: [], threadColor: 'not visible', hardwareFinish: 'not visible', reflectiveTape: 'silver bands at chest and hem' },
  washCare: { instructions: [], specialNotes: '' }, suggestions: {}, markings: [],
  fields: {
    reflective: { value: 'Silver bands at chest and hem', photo: 1, needsConfirmation: false },
    'front-closure': { value: 'Centre front zipper', photo: 1, needsConfirmation: false },
    hem: { value: 'Plain turned hem', photo: 1, needsConfirmation: false },
  },
  flags: [],
};

// --- 1a. reflective ---------------------------------------------------------------------------------------------------------
const r1 = scan(answer), r2 = scan(answer);
ok('1a: scanning the same answer twice gives exactly the same draft', stable(r1) === stable(r2));
ok('1a: the stored tape value is the AI\'s text, unchanged (nothing appended)', r1.colorway?.reflectiveTape === 'silver bands at chest and hem', r1.colorway?.reflectiveTape);
ok('1a: the tape value is always flagged for a person', (r1.flags || []).includes('colorway.reflectiveTape'));
ok('1a: the reflective checklist item is never "read from photo": it needs confirmation', !!item(r1, 'reflective') && item(r1, 'reflective').readFromPhoto !== true && K.itemState(item(r1, 'reflective')) === 'needs' && item(r1, 'reflective').value === 'Silver bands at chest and hem');
ok('1a: (control) an ordinary item the AI read stays "read from photo"', K.itemState(item(r1, 'hem')) === 'read');
ok('1a: the reflective component keeps its label and type (nothing appended)', r1.components?.find((c) => c.id === 'c2')?.label === 'Chest band' && r1.components?.find((c) => c.id === 'c2')?.type === 'reflective');
ok('1a: isReflectiveItem knows the reflective items (key or label)', typeof K.isReflectiveItem === 'function' && K.isReflectiveItem(item(r1, 'reflective')) && !K.isReflectiveItem(item(r1, 'hem')) && K.isReflectiveItem({ key: 'marking', label: 'Retroreflective material, whistle and light' }));
const saved1 = K.settleConfirmations(r1, null, {}), saved2 = K.settleConfirmations(saved1, saved1, {});
ok('1a: saving twice changes nothing (stored values and states the same)', stable(saved1) === stable(saved2) && saved2.colorway.reflectiveTape === 'silver bands at chest and hem' && K.itemState(item(saved2, 'reflective')) === 'needs');
const oldFile = { ...saved1, checklist: saved1.checklist.map((c) => (c.key === 'reflective' ? { ...c, readFromPhoto: true } : c)) };
ok('1a: an older file that stored the reflective item as "read from photo" now shows it as needing confirmation', K.itemState(item(oldFile, 'reflective')) === 'needs' && K.itemState(item(K.canonicalAnalysis(oldFile), 'reflective')) === 'needs');
const pdf1 = pdfOf(saved1).split('\n');
ok('1a PDF: the tape field shows the flag next to the unchanged value', pdf1.includes(`silver bands at chest and hem  [${REFLECTIVE_FLAG}]`));
ok('1a PDF: the reflective checklist item\'s status is the flag', pdf1.includes(REFLECTIVE_FLAG));
ok('1a PDF: the reflective call-out shows the flag in its type, label unchanged', pdf1.includes('Chest band') && pdf1.includes(`reflective [${REFLECTIVE_FLAG}]`));
const rv1 = reviewOf(saved1);
const readCount = K.readFromPhotoItems(saved1.checklist).length;
ok('1a Review tab: the flag is shown, and "Confirm all read-from-photo items" never includes the reflective item', rv1.includes(REFLECTIVE_FLAG) && rv1.includes(`Confirm all read-from-photo items (${readCount})`) && !K.readFromPhotoItems(saved1.checklist).some((c) => c.key === 'reflective'), `count ${readCount}`);
const confirmedTape = { ...saved1, flags: saved1.flags.filter((f) => f !== 'colorway.reflectiveTape') };
const pdfConfirmed = pdfOf(confirmedTape).split('\n');
ok('1a: once a person confirms the tape field, its flag is gone and the value is still the same', pdfConfirmed.includes('silver bands at chest and hem') && !pdfConfirmed.includes(`silver bands at chest and hem  [${REFLECTIVE_FLAG}]`));
ok('1a Fill from AI: "Reflective striping" is never filled from a photo', Tfs.prefillSpecs(blankSpecs, saved1).specs.reflectiveStriping === '');
const prompts = ['jacket', 'leather-work-gloves'].map((k) => S.scanRequest({ template: R.C.resolveTemplate(k, null, R.C.BUILT_IN_CATALOG), typeKey: k, typeName: k, photoCount: 2 }).prompt);
ok('1a prompts (clothing and product): a photo cannot show that tape or trim is reflective', prompts.every((p) => /A photo cannot show that tape or trim is reflective/.test(p)));

// --- 1b. colourways ---------------------------------------------------------------------------------------------------------
ok('1b: parts with different photo numbers: photo 1\'s colour stays, the other goes to "other colourways", flagged', r1.colorway?.bodyColor === 'gold' && stable(r1.otherColourways) === stable(['navy (photo 2)']) && (r1.flags || []).includes('colorway.bodyColor'), `${r1.colorway?.bodyColor} | ${stable(r1.otherColourways)}`);
const plain = scan({ ...answer, colorway: { ...answer.colorway, bodyColor: 'gold; navy' } });
ok('1b: a plain ";" with no photo numbers: nothing moved, flagged for confirmation', plain.colorway.bodyColor === 'gold; navy' && !(plain.otherColourways || []).length && plain.flags.includes('colorway.bodyColor'));
const samePhoto = scan({ ...answer, colorway: { ...answer.colorway, bodyColor: 'gold (photo 1); black trim (photo 1)' } });
ok('1b: two parts from the same photo: nothing moved, flagged', samePhoto.colorway.bodyColor === 'gold (photo 1); black trim (photo 1)' && !(samePhoto.otherColourways || []).length && samePhoto.flags.includes('colorway.bodyColor'));
const again = scan({ ...answer, colorway: { ...answer.colorway, bodyColor: r1.colorway.bodyColor } });
ok('1b: scanning the split result again moves nothing more', again.colorway.bodyColor === 'gold' && !(again.otherColourways || []).length);
const OTHER = 'Other colourways in the photos (not in this spec; make a separate request): navy (photo 2)';
ok('1b PDF and Review tab: the other colourway is named, outside the spec', pdf1.includes(OTHER) && rv1.includes(OTHER));
ok('1b PDF: no "other colourways" line when there are none', !pdfOf(K.settleConfirmations(plain, null, {})).includes('Other colourways in the photos'));
ok('1b: the saved shape keeps the list', stable(Shape.normalizeAnalysis({ otherColourways: ['navy (photo 2)', 3, null] }).otherColourways) === stable(['navy (photo 2)', '3']));
ok('1b prompt: one colourway per tech file; no instruction to put every colour in the body colour', /otherColourways/.test(prompts[0]) && !/gold \(photo 1\); navy \(photo 2\)/.test(prompts[0]));

// --- 1c. parts the photos do not show ---------------------------------------------------------------------------------------
ok('1c: hardware with a matching component stays; hardware naming no part stays', stable(r1.bom?.hardware) === stable(['Snap cuffs', 'Woven main label']), stable(r1.bom?.hardware));
ok('1c: hardware naming a part no photo shows is moved, not deleted: "Not seen in the photos"', stable(r1.notSeenHardware) === stable(['Front zipper under storm flap']), stable(r1.notSeenHardware));
ok('1c: a checklist value naming an unseen part needs a person (not "read from photo"); the value is kept', item(r1, 'front-closure')?.value === 'Centre front zipper' && K.itemState(item(r1, 'front-closure')) === 'needs');
const fill = Tfs.prefillSpecs(blankSpecs, saved1).specs;
ok('1c Fill from AI: ignores the not-seen list (no zipper), keeps the seen snap', fill.zippers === '' && fill.buttonsSnaps.includes('Snap cuffs'), `zippers "${fill.zippers}"`);
ok('1c PDF: the not-seen line is not in the factory PDF', !pdfOf(saved1).includes('Front zipper under storm flap'));
ok('1c Review tab: "Not seen in the photos: confirm or remove", with the line', rv1.includes('Not seen in the photos: confirm or remove') && rv1.includes('Front zipper under storm flap'));
const confirmedLine = { ...saved1, bom: { ...saved1.bom, hardware: [...saved1.bom.hardware, 'Front zipper under storm flap'] }, notSeenHardware: [] };
ok('1c PDF: once a person confirms it (it moves to Hardware), it is printed', pdfOf(confirmedLine).includes('Front zipper under storm flap'));
ok('1c: the saved shape keeps the list', stable(Shape.normalizeAnalysis({ notSeenHardware: ['x'] }).notSeenHardware) === stable(['x']));
// 1c refinement (2026-11-20): with NO component entries at all there is nothing to check against: the line stays in Hardware,
// flagged as needing confirmation, and nothing goes to "Not seen in the photos".
const noComponents = scan({ ...answer, components: [] });
ok('1c, scan with component entries: an unbacked part moves to "Not seen in the photos" (case 1)', r1.components.length > 0 && stable(r1.notSeenHardware) === stable(['Front zipper under storm flap']) && !r1.bom.hardware.includes('Front zipper under storm flap'));
ok('1c, scan with NO component entries: every hardware line stays in Hardware, flagged; no "Not seen" list (case 2)', stable(noComponents.bom.hardware) === stable(['Front zipper under storm flap', 'Snap cuffs', 'Woven main label']) && !('notSeenHardware' in noComponents) && noComponents.flags.includes('bom.hardware'), stable(noComponents.bom.hardware));
ok('1c, no component entries: the PDF prints the lines with "Needs confirmation"', pdfOf(K.settleConfirmations(noComponents, null, {})).split('\n').some((l) => l === 'Front zipper under storm flap [Needs confirmation]'));
ok('1c prompt: a part is named only when a component points to it in a photo', prompts.every((p) => /Name a part .* only when a component/.test(p)));

// --- 1e. the cover note -----------------------------------------------------------------------------------------------------
const AI_NOTE = 'Values were drafted by AI from photos';
const MANUAL_NOTE = 'DRAFT. This specification has not been approved. No AI scan was run: the values were entered by a person and must be checked against the physical garment before this file goes to a factory.';
const NEUTRAL_NOTE = 'DRAFT. This specification has not been approved. Values must be checked against the physical garment before this file goes to a factory.';
const blank = { analyzedAt: '2026-11-18T10:00:00.000Z', garmentClass: null, hasHood: null, productIdentification: null, overallConfidence: null, season: null, components: [], fabricAnalysis: null, measurements: [], bom: null, construction: [], stitchReference: [], labelPlacements: [], colorway: null, washCare: null };
const note = (a) => pdfOf(a).split('\n').find((l) => l.startsWith('DRAFT.')) || '';
ok('1e: a scan with the source marker says "drafted by AI"', note({ ...saved1, source: 'ai_scan' }).includes(AI_NOTE));
ok('1e: an older scan (product ID + confidence, no marker) says "drafted by AI"', !('source' in saved1) && note(saved1).includes(AI_NOTE));
ok('1e: a draft the server marked as made by hand says "No AI scan was run"', note({ ...blank, source: 'manual' }) === MANUAL_NOTE, note({ ...blank, source: 'manual' }));
ok('1e: neither marker nor scan signal: neutral wording, claims neither AI nor a person', note(blank) === NEUTRAL_NOTE && !/\bAI\b|person/.test(note(blank)), note(blank));
ok('1e: no analysis at all: neutral wording', (R.pdfTexts(R.makeRep('jacket', null), jt).split('\n').find((l) => l.startsWith('DRAFT.')) || '') === NEUTRAL_NOTE);
ok('1e: an unknown marker value counts as no marker (neutral)', note({ ...blank, source: 'something' }) === NEUTRAL_NOTE);
// Who sets the marker: only the server, from facts (settleSource in checklist-confirm.ts, called by PUT /api/replications/:id).
const set = K.settleSource;
ok('1e settleSource: exists', typeof set === 'function');
if (typeof set === 'function') {
  ok('1e: a scan save is "ai_scan", whatever the browser sent', set({ ...blank, source: 'manual' }, null, { scan: true }).source === 'ai_scan' && set({ ...blank, source: 'manual' }, { ...saved1, source: 'manual' }, { scan: true }).source === 'ai_scan');
  ok('1e: a person\'s save that creates the first analysis is "manual", whatever the browser sent', set({ ...blank, source: 'ai_scan' }, null, { scan: false }).source === 'manual');
  ok('1e: a later save keeps the saved marker; the browser cannot change it', set({ ...blank, source: 'manual' }, { ...saved1, source: 'ai_scan' }, {}).source === 'ai_scan' && set({ ...blank, source: 'ai_scan' }, { ...blank, source: 'manual' }, {}).source === 'manual');
  ok('1e: a saved analysis from before the marker stays unmarked (never guessed)', !('source' in set({ ...blank, source: 'ai_scan' }, saved1, {})));
  ok('1e: idempotent (settling twice gives the same marker)', set(set({ ...blank }, null, {}), set({ ...blank }, null, {}), {}).source === 'manual');
}
const route = fs.readFileSync('src/app/api/replications/[id]/route.ts', 'utf8');
ok('1e: the save route settles the marker on every admin save, from the scan flag and the saved row', /settleSource\(parsed\.row\.ai_analysis, existing\.ai_analysis, \{ scan: scanSave \}\)/.test(route));
