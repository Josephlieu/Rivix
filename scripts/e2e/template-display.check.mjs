// Gloves, footwear and PPE show their own template on every screen and in the PDF (2026-11-18), and clothing does not change.
// - Jacket: every screen and the PDF compared with golden files made ONCE from the code before this change
//   (fixtures/template-display-golden, never regenerated). The only allowed differences are listed in EXPECTED below:
//   (c) the photos-only / expected note, the two (e) measurement cases and item 5 (the drawing pointer). Anything else fails.
// - Glove, boot and harness (PPE without glove or shoe sizes): the screens and the PDF, drawn for real.
// - One template lookup: the Review tab (and request page), the tech file download, the PDF server and the New request form
//   all call the shared function, and it gives the same template for one type of each of the 9 categories (built-in and DEV).
// No write anywhere (the DEV part only reads the template tables). Run with the .tsx loader:
//   node --no-warnings --import ./scripts/e2e/tsx-resolve.mjs scripts/e2e/template-display.check.mjs (template-display.test.mjs runs it)
import fs from 'fs';
import React from 'react';
import { createClient } from '@supabase/supabase-js';
import * as R from './template-display.render.mjs';
import { confirmAll } from './confirm.mjs';

const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const GOLD = 'scripts/e2e/fixtures/template-display-golden';
const T = await import('../../src/lib/template-display.ts');
const S = await import('../../src/lib/scan-template.ts');
const D = await import('../../src/lib/garment-types-data.ts');
const Panel = (await import('../../src/app/admin/replication/SpecReviewPanel.tsx')).default;
const { PhotoChecklistBox } = await import('../../src/app/admin/replication/NewRequestDialog.tsx');
const res = (k) => R.C.resolveTemplate(k, null, R.C.BUILT_IN_CATALOG);
const noop = () => {};
const drawPanel = (rep, t) => R.renderToStaticMarkup(React.createElement(Panel, { selectedRep: rep, isAdmin: true, template: t, activeHotspot: null, setActiveHotspot: noop, setActiveTab: noop }));
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// --- 1) Jacket: golden files ------------------------------------------------------------------------------------------------
const P_OLD = '<p class="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Front and back drawings for each garment type are planned. Use the photos and the checklist on the Review tab.</p>';
const P_NEW = '<p class="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">The technical drawing for this garment type is on the Review &amp; Approve tab. <button type="button" class="font-bold text-rivix hover:underline">Open it →</button>\n</p>';
const FOOT = '<div class="bg-slate-100/50 px-4 py-2.5 text-[11.5px] text-slate-500 uppercase tracking-widest border-t border-slate-200 font-bold">';
const FOOT_OLD = `${FOOT}* ALL ABOVE MEASUREMENTS ARE AI-ESTIMATED IN INCHES AND TAKEN FLAT. IT IS RECOMMENDED THAT ALL SIZES ARE SAMPLED BEFORE PRODUCTION.</div>`;
const NOTE = '<p class="text-[11px] text-slate-400 leading-relaxed">';
const NOTE_OLD = `${NOTE}Verify details such as safety ratings and structural seams against the physical garment that the client has sent.</p>`;
const PDF_OLD = 'Measurements are estimates until approved. Measure the physical garment.';
const item5 = ['item 5: the drawing is on the Review tab', P_OLD, P_NEW];
const EXPECTED = {
  'ai-tab-ai-values': [item5],
  'ai-tab-empty-values': [item5, ['(e) no values: nothing about estimates', FOOT_OLD, `${FOOT}* NO MEASUREMENTS FILLED IN YET. MEASURE A SAMPLE OR USE THE APPROVED SIZE CHART.</div>`]],
  'ai-tab-all-confirmed': [item5, ['(e) all confirmed by a person: not "AI-estimated"', FOOT_OLD, `${FOOT}* ALL ABOVE MEASUREMENTS ARE IN INCHES AND TAKEN FLAT, CONFIRMED BY A PERSON. IT IS RECOMMENDED THAT ALL SIZES ARE SAMPLED BEFORE PRODUCTION.</div>`]],
  'ai-tab-not-scanned': [], 'ai-tab-scanning': [], 'review-tab': [], 'review-tab-approved': [], 'panel-received': [], 'new-request': [],
  'panel-expected': [['(c) garment expected', NOTE_OLD, `${NOTE}Verify details such as safety ratings and structural seams against the physical garment when it arrives. Until then, check them against the photos.</p>`]],
  'panel-photos-only': [['(c) photos only', NOTE_OLD, `${NOTE}Photos only: no garment is coming. Check details such as safety ratings and seams against the photos, and ask the customer for anything the photos do not show.</p>`]],
  'pdf-draft-ai-values': [], 'pdf-approved': [],
  'pdf-draft-empty-values': [['(e) no values', PDF_OLD, 'No measurements filled in yet. Measure the physical garment or use the approved size chart.']],
  'pdf-draft-all-confirmed': [['(e) all confirmed by a person', PDF_OLD, 'Every measurement was confirmed by a person. This file is not approved yet.']],
};
const cases = JSON.parse(fs.readFileSync(`${GOLD}/cases.json`, 'utf8'));
const jt = res('jacket');
const now = await R.renderAll({ cases, aiExtra: () => ({ template: jt }), panel: (rep) => React.createElement(Panel, { selectedRep: rep, isAdmin: true, template: jt, activeHotspot: null, setActiveHotspot: noop, setActiveTab: noop }) });
const goldNames = fs.readdirSync(GOLD).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4)).sort();
ok('every golden file has a jacket output and an expected-difference list', goldNames.join() === Object.keys(now).sort().join() && goldNames.join() === Object.keys(EXPECTED).sort().join(), goldNames.length);
for (const name of goldNames) {
  let want = fs.readFileSync(`${GOLD}/${name}.txt`, 'utf8');
  const lines = want.split('\n');
  let listed = true;
  for (const [why, from, to] of EXPECTED[name]) {
    const n = lines.filter((l) => l === from).length;
    if (n !== 1) { listed = false; console.log('  expected line not found exactly once in the golden file:', name, why, n); continue; }
    lines[lines.indexOf(from)] = to;
  }
  want = lines.join('\n');
  const got = now[name];
  const same = got === want;
  if (!same) { const a = want.split('\n'), b = got.split('\n'); const i = a.findIndex((l, j) => l !== b[j]); console.log(`  first other difference in ${name} at line ${i + 1}:\n   golden: ${String(a[i]).slice(0, 200)}\n   now:    ${String(b[i]).slice(0, 200)}`); }
  ok(`jacket ${name}: ${EXPECTED[name].length ? `only the listed differences (${EXPECTED[name].map((e) => e[0]).join('; ')})` : 'unchanged'}`, listed && same);
}

// --- 2) Glove, boot, harness: the screens and the PDF -----------------------------------------------------------------------
const answer = { productIdentification: { mode: 'visual', brand: null, model: null, source: 'photos' }, garmentClass: 'ZZ item', overallConfidence: 90, components: [], colorway: { bodyColor: 'tan', contrastColors: [], hardwareFinish: '' }, labelPlacements: [], washCare: { instructions: [] }, suggestions: {}, markings: [], fields: { outsole: { value: 'Lugged rubber', photo: 1 }, cuff: { value: 'Safety cuff', photo: 1 } }, flags: ['fabricAnalysis.material', 'bom.hardware', 'colorway.threadColor'] };
const scan = async (k) => (await S.runTemplateScan({ template: res(k), typeKey: k, typeName: D.garmentTypeLabel(k), photoCount: 1, customerNotes: '', ask: async () => JSON.stringify(answer) })).analysis;
const blankApparel = { coreMaterial: '', liningMaterial: '', fabricWeight: '', buttonsSnaps: '', reflectiveStriping: '', pocketsCount: '', seamConstruction: '' };
const JACKET_WORDS = /zipper|snaps|pocket|inside label|hi-vis|flame-resistance tests|\bhem\b/i;
const PRODUCTS = [
  { key: 'safety-boots', family: 'Footwear', range: "7 - 11 (US men's sizes, width D)", cols: ['7', '8', '9', '10', '11'], views: ['Outer side view', 'Inner side view', 'Top view', 'Sole view'], item: 'Outsole', value: 'Lugged rubber' },
  { key: 'leather-work-gloves', family: 'Glove', range: '7 - 11 (Hand sizes)', cols: ['7', '8', '9', '10', '11'], views: ['Palm view', 'Back of hand view'], item: 'Cuff', value: 'Safety cuff' },
  { key: 'safety-harness', family: 'Safety harness', range: 'Not filled in', cols: ['XS', 'S', 'M', 'L', 'XL'], views: ['Front view', 'Back view'], item: 'Webbing', value: '' },
];
for (const p of PRODUCTS) {
  const t = res(p.key);
  const base = await scan(p.key);
  ok(`${p.key}: a product template (product base), not clothing`, T.kindOf(t) === 'product' && T.kindOf(jt) === 'clothing');
  // A template with no measurement points (the harness) gets one row typed in, as an admin would add it.
  const rows0 = base.measurements.length ? base.measurements : [{ pom: 'A', description: 'ZZ length', xs: '', s: '', m: '', l: '', xl: '', tolerance: '' }];
  const withVals = { ...base, measurements: rows0.map((m) => ({ ...m, xs: '1', s: '2', m: '3', l: '4', xl: '5' })) };
  const allConf = R.K.settleConfirmations(withVals, null, { confirmations: confirmAll(withVals, ['measurements']), actorEmail: 'zz-admin@example.com', now: R.NOW });
  const rep = (a, o = {}) => R.makeRep(p.key, a, { garment: 'photos', ...o, specs: { ...blankApparel, zippers: 'ZZ kept zipper', ...(o.specs || {}) } });

  // AI analysis tab
  const ai = R.drawAiTab(rep(withVals), { template: t });
  const aiT = text(ai);
  ok(`${p.key} AI tab: size range from the template (${p.range})`, aiT.includes(`Size Range ${p.range}`) && !aiT.includes('XS - XL [SAMPLE: M]'));
  const head = ai.slice(ai.indexOf('DESCRIPTION</th>'), ai.indexOf('TOL +/-'));
  ok(`${p.key} AI tab: measurement columns ${p.cols.join(' ')}, no "[M]" sample`, p.cols.every((c) => head.includes(`>${c}</th>`)) && !head.includes('['), text(head));
  ok(`${p.key} AI tab: values not confirmed: no "taken flat", says they may be AI estimates`, !/TAKEN FLAT|AI-ESTIMATED/.test(aiT) && aiT.includes('VALUES NOT CONFIRMED BY A PERSON MAY BE AI ESTIMATES'));
  const aiEmpty = text(R.drawAiTab(rep(base), { template: t }));
  ok(`${p.key} AI tab: no values: nothing about estimates`, aiEmpty.includes('NO MEASUREMENTS FILLED IN YET') && !/ESTIMATE/.test(aiEmpty));
  const aiConf = text(R.drawAiTab(rep(allConf), { template: t }));
  ok(`${p.key} AI tab: all confirmed by a person: nothing about estimates`, aiConf.includes('CONFIRMED BY A PERSON') && !/ESTIMATE/.test(aiConf));
  ok(`${p.key} AI tab: "Hardware", not "Zippers & Hardware"; the drawing pointer`, aiT.includes(' Hardware ') && !aiT.includes('Zippers & Hardware') && aiT.includes(`The technical drawing for this product type is on the Review & Approve tab`) && !aiT.includes('are planned'));
  const idle = text(R.drawAiTab(rep(null), { template: t }));
  ok(`${p.key} AI tab, not scanned yet: no snaps, zippers or wireframe`, idle.includes('Ready for AI Analysis') && !/snaps|zippers|wireframe|Hardware ID/i.test(idle));
  const steps = T.scanStepLabels(t, R.View.AI_SCAN_STEPS.map((x) => x.label));
  ok(`${p.key} scan progress steps: same number, no zipper, reflective or NFPA steps`, steps.length === R.View.AI_SCAN_STEPS.length && !/zipper|snap|reflective|nfpa|z96/i.test(steps.join(' ')));

  // Review tab
  const rv = text(R.drawReview(rep(base)));
  const ask = rv.slice(rv.indexOf('Ask the customer for'), rv.indexOf('Checklist for'));
  ok(`${p.key} Review tab: "Ask the customer for" follows the template (no zipper, snaps or inside fabric label)`, ask.includes('labels and markings') && !JACKET_WORDS.test(ask), ask.slice(0, 240));
  const testing = rv.slice(rv.indexOf('Testing Tests'), rv.indexOf('History'));
  ok(`${p.key} Review tab: no clothing test button; the note names no hi-vis or flame-resistance tests`, !rv.includes('Add the standard tests for this garment') && testing.includes('Tests depend on the product type') && !/hi-vis|flame-resistance/i.test(testing), testing.slice(0, 200));
  const basic = rv.slice(rv.indexOf('Basic specification'), rv.indexOf('Fill empty fields'));
  ok(`${p.key} Review tab: Basic specification shows no empty jacket field, keeps a saved one`, !/Base material|Lining |Fabric weight|Buttons|Pockets|Seam construction|Reflective striping/.test(basic) && basic.includes('Zippers') && basic.includes('Safety rating'), basic);
  ok(`${p.key} Review tab: measurements "(inches)", not "flat on the half"`, rv.includes('Measurements (inches) The AI') && !rv.includes('flat on the half'));

  // Client Spec Review panel
  const panel = text(drawPanel(rep(base), t));
  ok(`${p.key} specs panel: "${p.family} specs" with the template's own fields`, panel.includes(`${p.family} specs`) && !panel.includes('Apparel Specs') && t.checklist.every((c) => panel.includes(T.shortLabel(c.label))));
  ok(`${p.key} specs panel: empty stays "Not filled in yet"; a value read from a photo says so`, panel.includes('Not filled in yet') && (!p.value || panel.includes(`${p.value} Read from photo, not checked`)));
  ok(`${p.key} specs panel: no empty jacket fields; a saved one is still shown`, !/Fabric Weight|Buttons|Pockets|Seam Construction|Reflective Striping|Base Material/.test(panel) && panel.includes('Zippers ZZ kept zipper'));
  ok(`${p.key} specs panel: photos-only note`, panel.includes('Photos only: no product is coming') && !panel.includes('that the client has sent'));
  ok(`${p.key} specs panel: garment received says "product"`, text(drawPanel(rep(base, { garment: 'received' }), t)).includes('against the physical product that the client has sent'));

  // New request form
  const photos = text(R.renderToStaticMarkup(React.createElement(PhotoChecklistBox, { template: t })));
  ok(`${p.key} New request photo checklist: the template's views and photo items, no zipper, pocket or hem`, p.views.every((v) => photos.includes(v)) && !JACKET_WORDS.test(photos) && !photos.includes('Whole garment'), photos.slice(0, 260));
  ok(`${p.key} New request intro line follows the template`, T.newRequestIntro(t).startsWith('Enter a product') && !JACKET_WORDS.test(T.newRequestIntro(t)));

  // PDF
  const pdf = R.pdfTexts(rep(withVals), t);
  const pl = pdf.split('\n');
  ok(`${p.key} PDF: sizes from the template`, p.range === 'Not filled in' ? pl.includes('Sizes: Not filled in') : pl.some((l) => l.startsWith('Sizes 7 – 11')) && !pdf.includes('XS – XL'));
  ok(`${p.key} PDF: no empty jacket fields or Hood; a saved one is printed`, !['Buttons / snaps', 'Reflective striping', 'Pockets', 'Seam construction', 'Hood'].some((f) => pl.includes(f)) && pl.includes('Zippers') && pl.includes('ZZ kept zipper'));
  ok(`${p.key} PDF: "Checklist for this product type", "(inches)", "physical product"`, pl.includes('Checklist for this product type') && pl.includes('Measurement specification (inches)') && pdf.includes('physical product') && !pdf.includes('physical garment') && !pdf.includes('flat on the half'));
  ok(`${p.key} PDF: an empty field still prints "Not specified" (never invented)`, pdf.includes('Not specified'));
  const pdfEmpty = R.pdfTexts(rep(base), t);
  ok(`${p.key} PDF draft with no values: nothing about estimates`, pdfEmpty.includes('No measurements filled in yet') && !/estimate/i.test(pdfEmpty.split('\n').filter((l) => /measure/i.test(l)).join(' ')));
}
// A boot's photo checklist never asks for a cuff (the glove's own template asks for its cuff).
ok('boot photo checklist: no cuff', !/cuff/i.test(text(R.renderToStaticMarkup(React.createElement(PhotoChecklistBox, { template: res('safety-boots') })))));
// Clothing keeps its photo checklist and intro (also covered by the golden file).
ok('jacket photo checklist and intro unchanged', T.photoChecklist(jt) === null && T.newRequestIntro(jt).startsWith('Enter a garment'));

// --- 3) One template lookup ---------------------------------------------------------------------------------------------------
const src = (f) => fs.readFileSync(f, 'utf8');
const direct = /\bresolveTemplate(Checked)?\(/;
const places = {
  'Review tab': src('src/app/admin/replication/ReviewTab.tsx'),
  'request page (specs panel, AI tab)': src('src/app/admin/replication/ReplicationDetail.tsx'),
  'tech file download': src('src/app/admin/replication/downloadTechFile.ts'),
  'PDF server': src('src/lib/tech-file-pdf-server.ts'),
  'New request form': src('src/app/admin/replication/NewRequestDialog.tsx'),
};
const hook = src('src/app/admin/replication/useRequestTemplate.ts');
ok('the browser hook uses the shared lookup', /templateFromList\(garmentType, list, versions\)/.test(hook));
for (const [name, code] of Object.entries(places)) {
  const shared = /useRequestTemplate\(|templateFromList\(|requestTemplate\(/.test(code);
  ok(`${name}: uses the shared lookup and never resolves a template itself`, shared && !direct.test(code));
}
const catalogSrc = src('src/lib/template-catalog.ts');
ok('templateFromList goes through requestTemplate (one function)', /export function templateFromList[\s\S]*?return requestTemplate\(/.test(catalogSrc));

const stable = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const oneEach = D.DEFAULT_GARMENT_CATEGORIES.map((c) => D.DEFAULT_GARMENT_TYPES.find((t) => t.category === c.key)?.key);
ok('one type in each of the 9 categories', oneEach.length === 9 && oneEach.every(Boolean), oneEach.join(', '));
const compare = (label, catalog, types, rows) => {
  for (const k of oneEach) {
    const row = rows?.find((r) => r.key === k);
    const browser = R.C.templateFromList(k, { types, templates: catalog }); // Review tab, request page, download, New request form
    const server = R.C.requestTemplate(k, catalog, { savedFamily: row ? row.template_family ?? null : types.find((t) => t.key === k)?.templateFamily ?? null, dbType: row ? { family: row.template_family ?? null, modules: row.template_modules ?? null } : null }); // PDF server
    const pinned = R.C.templateFromList(k, { types, templates: catalog }, browser.versions); // a saved tech file's versions
    ok(`${label}: ${k} (${R.C.BUILT_IN_CATALOG.types[k]?.category}) resolves to the same template everywhere`, stable(browser) === stable(server) && stable(browser) === stable(pinned), `${browser.family.key}, base ${browser.versions[0].key}`);
  }
};
compare('built-in', R.C.BUILT_IN_CATALOG, D.DEFAULT_GARMENT_TYPES, null);

// DEV (read only): the catalog and the types list exactly as the API builds them, and the PDF server's own row read.
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { getTemplateCatalog } = await import('../../src/lib/template-store.ts');
const { loadGarmentLibrary } = await import('../../src/lib/garment-types.ts');
const [catalog, lib, rows] = await Promise.all([getTemplateCatalog(admin), loadGarmentLibrary(admin), admin.from('garment_types').select('key, template_family, template_modules').in('key', oneEach)]);
ok('DEV: the template catalog was read from the database', catalog.source === 'database', catalog.source);
compare('DEV', catalog, lib.types, rows.data || []);

// --- 4) The real PDF renders for each (not only its text) -----------------------------------------------------------------
const { renderToBuffer } = await import('@react-pdf/renderer');
for (const k of ['jacket', 'leather-work-gloves', 'safety-boots', 'safety-harness']) {
  const t = res(k);
  const a = k === 'jacket' ? cases.ai : await scan(k);
  const buf = await renderToBuffer(R.P.TechPackPDF({ d: R.P.buildTechFileData(R.makeRep(k, a), [], undefined, t) }));
  ok(`${k}: the tech file PDF renders`, buf.subarray(0, 5).toString() === '%PDF-' && buf.length > 5000, `${buf.length} bytes`);
}
