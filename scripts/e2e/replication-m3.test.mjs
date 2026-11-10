// Checks M3: a request's template pre-fill, the "not visible" clean-up of AI results, and the needs-confirmation rules.
// Run: node scripts/e2e/replication-m3.test.mjs   (re-runs itself with the TypeScript loader; no database needed)
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
if (!process.env.M3_CHILD) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--import', './scripts/e2e/ts-resolve.mjs', fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, M3_CHILD: '1' } });
  process.exit(r.status ?? 1);
}
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const C = await import('../../src/lib/template-catalog.ts');
const resolveTemplate = (k, f) => C.resolveTemplate(k, f, C.BUILT_IN_CATALOG); // task 26: built-in catalog
const A = await import('../../src/lib/garmentAiAnalysis.ts');
const S = await import('../../src/lib/techFileStandards.ts');

const vest = resolveTemplate('high-visibility-vest');
const cl = A.checklistFor(vest);
ok('checklist has every template item, all needing confirmation when the AI said nothing', cl.length === vest.checklist.length && cl.every(c => c.needsConfirmation && c.value === ''));
const cl2 = A.checklistFor(vest, [{ key: 'colour', value: 'Orange body, silver tape', needsConfirmation: false }, { key: 'fabric', value: '100% polyester knit', needsConfirmation: false }, { key: 'labels', value: 'not visible' }, { key: 'nonsense', value: 'x' }]);
const item = (k) => cl2.find(c => c.key === k);
ok('a photo item the AI saw is not flagged; "not visible" or unknown keys stay flagged or are ignored', item('colour').needsConfirmation === false && item('labels').needsConfirmation && item('labels').value === '' && !cl2.some(c => c.key === 'nonsense'));
ok('a document item (fabric, trims, ratings) keeps what the AI wrote but always waits for a person', item('fabric').source === 'document' && item('fabric').value === '100% polyester knit' && item('fabric').needsConfirmation === true);

const tm = A.templateMeasurements(vest);
ok('template measurement rows have a code, a description, blank sizes and a flag', tm.length === vest.parts[0].points.length && tm.every(r => r.pom && r.description && r.xs === '' && r.needsConfirmation));
const kit = resolveTemplate('rain-suit');
const km = A.templateMeasurements(kit);
ok('a kit gets codes that do not collide between its parts', new Set(km.map(r => r.pom)).size === km.length && km.length === kit.parts.reduce((n, p) => n + p.points.length, 0));

const out = A.applyTemplate({
  fabricAnalysis: { material: 'Not visible', weight: '150 gsm', weaveType: 'knit', frRating: 'none' },
  colorway: { bodyColor: 'orange', threadColor: 'not visible', hardwareFinish: '', reflectiveTape: 'not visible', contrastColors: [] },
  flags: ['fabricAnalysis.weight', 'bogus.path'],
  measurements: [{ pom: 'A', description: 'Chest', xs: 'not visible', s: '', m: '', l: '', xl: '', tolerance: '' }],
  construction: [{ location: 'side', seamType: 'lockstitch', stitchType: '301', spiTop: 10, spiBottom: 10, seamAllowance: '3/8', notes: '', needsConfirmation: true }],
  labelPlacements: [],
}, vest);
ok('"not visible" is blanked and flagged; the AI flags are kept; unknown paths dropped', out.fabricAnalysis.material === '' && out.colorway.threadColor === '' && out.colorway.reflectiveTape === ''
  && ['fabricAnalysis.material', 'colorway.threadColor', 'colorway.reflectiveTape', 'fabricAnalysis.weight'].every(f => out.flags.includes(f)) && !out.flags.includes('bogus.path') && !out.flags.includes('colorway.bodyColor'));
ok('a row with "not visible" is flagged and blanked; a flag the AI set on a row stays', out.measurements[0].needsConfirmation && out.measurements[0].xs === '' && out.construction[0].needsConfirmation);
const empty = A.applyTemplate({}, vest);
ok('an AI result with no measurements falls back to the template points', empty.measurements.length === vest.parts[0].points.length && empty.checklist.length === vest.checklist.length);

// approval rules
const open = A.outstandingConfirmations(out);
ok('open items are counted (values, rows and required checklist items)', open.includes('Fabric material') && open.includes('Measurement 1') && open.includes('Seam 1') && open.some(x => x === vest.checklist.find(c => c.required).label));
const done = { ...out, flags: [], measurements: out.measurements.map(r => ({ ...r, needsConfirmation: false })), construction: out.construction.map(r => ({ ...r, needsConfirmation: false })), checklist: out.checklist.map(c => ({ ...c, needsConfirmation: false })) };
ok('nothing is open once a person has confirmed everything', A.outstandingConfirmations(done).length === 0);
const optionalOnly = { ...done, checklist: out.checklist.map(c => ({ ...c, needsConfirmation: !c.required })) };
ok('an unconfirmed OPTIONAL checklist item does not block approval', A.outstandingConfirmations(optionalOnly).length === 0 && out.checklist.some(c => !c.required));
ok('an old analysis with no flags or checklist has nothing open', A.outstandingConfirmations({ measurements: [{ pom: 'A', description: 'x' }] }).length === 0 && A.outstandingConfirmations(null).length === 0);
ok('isNotVisible matches the AI wording only', ['not visible', 'Not visible.', 'unknown'].every(A.isNotVisible) && !['visible', 'navy', ''].some(A.isNotVisible));

// pick lists in the catalogue wording
ok('standards pick list has ANSI 107, EN 20471 and CSA Z96 classes', ['ANSI/ISEA 107', 'EN ISO 20471', 'CSA Z96'].every(k => S.HIVIS_STANDARDS.some(x => x.includes(k))) && S.HIVIS_STANDARDS.some(x => /Class 3/.test(x)));
ok('tape options combine width and colour', S.TAPE_OPTIONS.length === S.TAPE_WIDTHS.length * S.TAPE_COLOURS.length && S.TAPE_OPTIONS.some(x => x.startsWith('50 mm') && /silver/.test(x)));

// ---- the AI describes, a person decides: suggestions, customer values, human-only fields ----
const P = await import('../../src/lib/garmentAiPrompt.ts');
const jacket = resolveTemplate('jacket');
const guessy = A.applyTemplate({
  fabricAnalysis: { material: 'Nomex/Kevlar blend', weight: '7 oz', weaveType: 'not visible', frRating: 'NFPA 1971', finish: '', shrinkage: '3% max' },
  colorway: { bodyColor: 'Tan', threadColor: 'Matching body fabric', hardwareFinish: 'Matte silver', reflectiveTape: 'Lime and silver', contrastColors: ['Black'] },
  bom: { hardware: ['Metal D-ring'], thread: ['not visible'], labels: [], packaging: { foldDescription: 'flat fold', polybagSize: '24x30', cartonSize: 'x', hangtagSpec: 'y' } },
  washCare: { instructions: ['Machine wash cold'], specialNotes: 'Inspect often' },
  construction: [{ location: 'Shoulder', seamType: 'felled', stitchType: 'ISO 401', spiTop: 10, spiBottom: 10, seamAllowance: '3/8', notes: 'n' }],
  labelPlacements: [{ type: 'Main label', location: 'back neck', attachment: 'four-side', dimensions: '2x3', material: 'FR woven' }],
  stitchReference: [{ code: 'ISO 301', name: 'Lockstitch', machineType: 'm', defaultSpi: 12, usage: 'u' }],
  measurements: [{ pom: 'A', description: 'Chest', xs: '40', s: '42', m: '', l: '', xl: '', tolerance: '+/-1/2' }],
  season: 'All-season', suggestions: { 'fabricAnalysis.material': 'Usually aramid blend', 'fabricAnalysis.frRating': 'NFPA 1971', 'bogus.path': 'x', 'bom.thread': ['Usually core-spun polyester'] },
}, jacket);
ok('the flame rating and shrinkage are person-only: always blank and flagged, never taken from the AI', guessy.fabricAnalysis.frRating === '' && guessy.flags.includes('fabricAnalysis.frRating') && guessy.fabricAnalysis.shrinkage === '' && guessy.flags.includes('fabricAnalysis.shrinkage') && !A.SUGGESTABLE.has('fabricAnalysis.shrinkage'));
ok('blank or "not visible" values are flagged, including lists (thread, labels)', ['fabricAnalysis.weaveType', 'fabricAnalysis.finish', 'bom.thread', 'bom.labels'].every(f => guessy.flags.includes(f)) && guessy.bom.thread.length === 0);
ok('a value the AI wrote on a suggestable path is kept but flagged (material, hardware, care)', guessy.fabricAnalysis.material === 'Nomex/Kevlar blend' && guessy.bom.hardware.length === 1 && ['fabricAnalysis.material', 'fabricAnalysis.weight', 'bom.hardware', 'washCare.instructions', 'colorway.threadColor'].every(f => guessy.flags.includes(f)));
ok('a seen value on a SEEN-only path is not flagged unless the AI flags it', guessy.colorway.bodyColor === 'Tan' && !guessy.flags.includes('colorway.bodyColor'));
ok('suggestions are kept apart: only suggestable paths, lists joined, never written into the value', guessy.suggestions['fabricAnalysis.material'] === 'Usually aramid blend' && guessy.suggestions['bom.thread'] === 'Usually core-spun polyester' && !('fabricAnalysis.frRating' in guessy.suggestions) && !('bogus.path' in guessy.suggestions));
ok('seams: stitch, stitches per inch and allowance are cleared; the row is flagged', guessy.construction[0].stitchType === '' && guessy.construction[0].spiTop === 0 && guessy.construction[0].seamAllowance === '' && guessy.construction[0].needsConfirmation === true && guessy.construction[0].location === 'Shoulder');
ok('labels: attachment, size and material are cleared; the row is flagged', guessy.labelPlacements[0].attachment === '' && guessy.labelPlacements[0].dimensions === '' && guessy.labelPlacements[0].material === '' && guessy.labelPlacements[0].needsConfirmation === true);
ok('packaging, special care notes, season and the stitch table are never taken from the AI', guessy.bom.packaging.polybagSize === '' && guessy.washCare.specialNotes === '' && guessy.season === '' && guessy.stitchReference.length === 0);
ok('measurement points come from the template; sizes and tolerance are always blank and flagged', guessy.measurements.length === A.templateMeasurements(jacket).length && guessy.measurements.every(r => r.xs === '' && r.s === '' && r.tolerance === '' && r.needsConfirmation === true));
const withCustomer = A.applyTemplate({ fabricAnalysis: { material: 'not visible', weight: 'not visible' }, colorway: {}, washCare: { instructions: [] }, bom: {} }, jacket, { 'fabricAnalysis.material': '65/35 poly-cotton', 'washCare.instructions': 'Wash cold\nDo not bleach' });
ok('what the customer wrote fills the field, stays flagged and is marked as from the customer', withCustomer.fabricAnalysis.material === '65/35 poly-cotton' && withCustomer.flags.includes('fabricAnalysis.material') && withCustomer.fromCustomer.includes('fabricAnalysis.material') && withCustomer.washCare.instructions.length === 2);
ok('every open item blocks approval until a person confirms it', A.outstandingConfirmations(guessy).length > 10 && A.outstandingConfirmations({ ...guessy, flags: [], measurements: [], construction: [], labelPlacements: [], checklist: [] }).length === 0);
const prompt = P.buildGarmentPrompt({ photoCount: 2, typeName: 'Jacket', customerNotes: 'gold shell', checklistText: '- fabric: Fabric', flagList: Object.keys(A.FLAGGABLE).join(', '), suggestList: [...A.SUGGESTABLE].join(', ') });
ok('the prompt covers photos that disagree, an unseen back, accessories and wearer-side wording', /photo 1/.test(prompt) && /back matches the front/.test(prompt) && /helmet/.test(prompt) && /wearer's left/.test(prompt));
ok('the prompt states the three kinds (seen, suggestion, person only) and lists the person-only fields', /A\. SEEN/.test(prompt) && /B\. SUGGESTION/.test(prompt) && /C\. PERSON ONLY/.test(prompt) && /frRating/.test(prompt) && /spiTop/.test(prompt) && prompt.includes('"gold shell"'));
ok('every flaggable list and suggestable path appears in the prompt', Object.keys(A.FLAGGABLE).every(k => prompt.includes(k)) && [...A.SUGGESTABLE].every(k => prompt.includes(k)));

// ---- model choice: the best image model first, the standard model when it is out of quota or busy (fake answers, no AI calls) ----
const G = await import('../../src/lib/gemini-model.ts');
const fake = (fails) => { const calls = []; return { calls, ask: async (model, withSearch) => { calls.push(`${model}${withSearch ? '+search' : ''}`); const err = fails[`${model}${withSearch ? '+search' : ''}`] ?? fails[model]; if (err) throw new Error(err); return 'ok'; } }; };
const quota = '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}';
let f = fake({ best: quota });
let r = await G.askWithFallback(['best', 'std'], f.ask);
ok('no quota on the best model (no billing): falls back to the standard model, with search', r.model === 'std' && r.searchSkipped === false && f.calls.join() === 'best+search,best,std+search');
f = fake({ 'best+search': quota });
r = await G.askWithFallback(['best', 'std'], f.ask);
ok('only Google Search out of quota: same model, photos only', r.model === 'best' && r.searchSkipped === 'quota');
f = fake({ best: '{"error":{"code":503,"status":"UNAVAILABLE"}}' });
r = await G.askWithFallback(['best', 'std'], f.ask);
ok('best model busy: falls back', r.model === 'std');
const throws = async (fn) => { try { await fn(); return false; } catch { return true; } };
ok('a real error (bad request) is not hidden by a fallback, and the last model failing is reported', await throws(() => G.askWithFallback(['best', 'std'], fake({ best: '{"error":{"code":400}}' }).ask)) && await throws(() => G.askWithFallback(['best', 'std'], fake({ best: quota, std: quota }).ask)));
ok('the garment scan defaults to a free model (paid model only when GEMINI_VISION_MODEL is set)', G.GEMINI_VISION_MODEL === (process.env.GEMINI_VISION_MODEL || 'gemini-3.8-flash'));

// ---- strict answer format ----
const SC = await import('../../src/lib/garmentAiSchema.ts');
const promptNow = P.buildGarmentPrompt({ photoCount: 1, typeName: 'Jacket', customerNotes: '', checklistText: '', pointsText: '', flagList: '', suggestList: '' });
ok('the answer schema has every top-level key the prompt shows', SC.GARMENT_RESPONSE_SCHEMA.required.every(k => promptNow.includes(`"${k}"`)));
ok('the schema has no key the prompt does not mention, and lists every component type', Object.keys(SC.GARMENT_RESPONSE_SCHEMA.properties).length === SC.GARMENT_RESPONSE_SCHEMA.required.length && SC.COMPONENT_TYPES.every(t => promptNow.includes(`"${t}"`)));
ok('the schema allows empty values everywhere (it never forces a guess)', !JSON.stringify(SC.GARMENT_RESPONSE_SCHEMA).includes('minLength') && !JSON.stringify(SC.GARMENT_RESPONSE_SCHEMA).includes('minItems'));
