// Task 27: all 9 RIVIX categories and their templates. Proves:
// - the client's 9 category names; the 41 older types keep their key, label, template and on/off state (only category and sort
//   moved), and still resolve exactly as before (template-store.test.mjs holds the frozen 70-case comparison);
// - every one of the 83 types resolves to a usable template; gloves and footwear get their own sizing and drawing views;
// - certified equipment (harness, safety footwear, turnout gear, survival suit) never claims compliance; every new protective
//   template carries the "verify the edition and scope" warning; every standard is a candidate with a link, "to verify";
// - the textile-only note on hats and caps, also given to the AI;
// - DEV (after task-27-categories-and-templates.sql) holds exactly what the code holds, and the API serves it.
// Run on DEV only, with `EMAIL_DRY_RUN=1 npm run dev` (or npm start) on port 10001:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/categories-templates.test.mjs
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import { stepUp } from './mfa.mjs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

const C = await import('../../src/lib/template-catalog.ts');
const T = await import('../../src/lib/garment-templates.ts');
const D = await import('../../src/lib/garment-types-data.ts');
const A = await import('../../src/lib/templates-added.ts');
const P = await import('../../src/lib/garmentAiPrompt.ts');
const B = C.BUILT_IN_CATALOG;
const res = (k) => C.resolveTemplate(k, null, B);
const types = D.DEFAULT_GARMENT_TYPES;
const keys = types.map((t) => t.key);
const older = Object.keys(T.TYPE_TEMPLATES);

// --- categories and types
ok("the client's 9 categories, with their exact names, in order", canon(D.DEFAULT_GARMENT_CATEGORIES.map((c) => c.label)) === canon(['General Workwear', 'High Visibility Workwear', 'Flame Resistant and Arc Rated Clothing', 'Winter and Outdoor Workwear', 'Specialized Protective Clothing', 'Corporate Apparel and Uniforms', 'Gloves and Hand Protection', 'Footwear', 'Other PPE and Accessories']));
ok('the 3 older category keys are kept (older requests and screens use them)', ['outerwear', 'workwear', 'protective'].every((k) => D.DEFAULT_GARMENT_CATEGORIES.some((c) => c.key === k)));
ok('83 types: the 41 older ones plus 42 new, every key unique, every type in one of the 9 categories', keys.length === 83 && new Set(keys).size === 83 && older.every((k) => keys.includes(k)) && D.ADDED_TYPE_KEYS.length === 42 && types.every((t) => D.DEFAULT_GARMENT_CATEGORIES.some((c) => c.key === t.category)));
ok('every category has types, and the sort order follows the category order', D.DEFAULT_GARMENT_CATEGORIES.every((c) => types.some((t) => t.category === c.key)) && types.every((t, i) => i === 0 || t.sort > types[i - 1].sort));
ok('Bomber Jacket, Fleece Jacket, Lab Coat and Scrubs stay on, where agreed', [['bomber-jacket', 'corporate'], ['fleece-jacket', 'outerwear'], ['lab-coat', 'corporate'], ['scrubs', 'corporate']].every(([k, c]) => types.find((t) => t.key === k)?.category === c && types.find((t) => t.key === k).active));
ok('older names are unchanged (pants = Work Pants, overalls = Bib Overalls, the catalogue names)', D.garmentTypeLabel('pants') === 'Work Pants' && D.garmentTypeLabel('overalls') === 'Bib Overalls' && D.garmentTypeLabel('four-in-one-jacket') === '4-in-1 Jacket' && D.garmentTypeLabel('survival-suit') === 'Immersion / Survival Suit');

// --- every type resolves
const bad = keys.filter((k) => { const r = res(k); return r.checklist.length < 8 || new Set(r.checklist.map((c) => c.key)).size !== r.checklist.length || !r.family.sizing.note || r.family.views.length < 1; });
ok('every one of the 83 types resolves: 8+ checklist items, no duplicates, a size note and drawing views', bad.length === 0, bad.join(','));
const generic = keys.filter((k) => res(k).family.key === 'generic');
ok('only Branded Apparel uses the general template (on purpose); every other type has its own', canon(generic) === canon(['branded-apparel']), generic.join(','));
ok('every new type uses the template the plan set (family and add-ons)', D.ADDED_TYPE_KEYS.every((k) => { const m = A.ADDED_TYPE_TEMPLATES[k], r = res(k); return r.family.key === m.family && canon(r.modules.map((x) => x.key)) === canon(m.modules ?? []); }));
const base = (k) => res(k).versions[0].key;
ok('gloves, footwear and other PPE start from the product base; clothing from the garment base', ['cut-resistant-gloves', 'safety-boots', 'safety-harness', 'balaclava'].every((k) => base(k) === 'product-base') && ['jacket', 'hats-caps', 'arc-flash-hood', 'protective-sleeves', 'hi-vis-jacket'].every((k) => base(k) === 'garment-base'));

// --- gloves, footwear, headwear
const glove = res('cut-resistant-gloves');
ok('gloves: glove sizing, palm and back-of-hand drawings, glove measurement points', glove.family.sizing.style === 'glove' && canon(glove.family.views) === canon(['palm', 'back-of-hand']) && ['Overall length', 'Palm width', 'Middle finger length', 'Thumb length', 'Cuff length'].every((n) => glove.family.points.some((p) => p.name === n)));
ok('gloves: coating, finger construction, cuff and markings on the checklist; the cut add-on asks for the cut level from a document', ['coating', 'finger-construction', 'cuff', 'glove-markings'].every((k) => glove.checklist.some((c) => c.key === k)) && glove.checklist.find((c) => c.key === 'cut-level')?.source === 'document');
const boot = res('insulated-safety-boots');
ok('footwear: shoe sizes with widths, outer side, inner side, top and sole drawings', boot.family.sizing.style === 'shoe-width' && canon(boot.family.views) === canon(['outer-side', 'inner-side', 'top', 'sole']) && C.viewsText(boot.family.views) === 'outer side, inner side, top and sole');
ok('footwear: construction method, outsole and toe cap; insulated boots add insulation', ['fw-construction', 'outsole', 'toe-cap', 'fw-insulation'].every((k) => boot.checklist.some((c) => c.key === k)));
const hat = res('hats-caps');
ok('hats and caps: head sizing, a head circumference measured around, four drawings', hat.family.sizing.style === 'head' && hat.family.points[0].kind === 'circumference' && C.methodText('circumference') === 'Around' && hat.family.views.length === 4);
ok('hats and caps carry the note: textile only, hard hats and head protection out of scope, never copied from photos', hat.notes.some((n) => /textile hats and caps only/i.test(n) && /hard hats/i.test(n) && /must not be replicated from photos/i.test(n)));
const promptFor = (k) => P.buildGarmentPrompt({ photoCount: 1, typeName: k, customerNotes: '', checklistText: '- x: y', flagList: '', suggestList: '', templateNotes: res(k).notes });
ok('the AI scan gets that note for hats and caps', /Notes for this product type[\s\S]*Hard hats/.test(promptFor('hats-caps')));
ok('  and an older type gets exactly the prompt it got before (no notes section)', promptFor('jacket') === P.buildGarmentPrompt({ photoCount: 1, typeName: 'jacket', customerNotes: '', checklistText: '- x: y', flagList: '', suggestList: '' }) && !/Notes for this product type/.test(promptFor('jacket')));
ok('kits: thermal base layer and uniforms have a top and a bottom, each measured', ['thermal-base-layer', 'uniform-shirt-pants', 'security-uniform'].every((k) => canon(res(k).parts.map((p) => p.key)) === canon(['shirt', 'trousers']) && res(k).parts.every((p) => p.points.length >= 3)));

// --- certification and claims
const lvl = (k) => res(k).certification;
ok('certified equipment: harness, safety and insulated safety boots, turnout coat and pants, survival suit', ['safety-harness', 'safety-boots', 'insulated-safety-boots', 'firefighter-turnout-coat', 'firefighter-turnout-pants', 'survival-suit'].every((k) => lvl(k) === 'certified-equipment'));
ok('need test evidence: cut, impact, welding, chemical, disposable and thermal gloves, sleeves, chemical boots, hi-vis and FR types', ['cut-resistant-gloves', 'impact-resistant-gloves', 'welding-gloves', 'chemical-resistant-gloves', 'disposable-gloves', 'thermal-gloves', 'protective-sleeves', 'chemical-resistant-boots', 'hi-vis-jacket', 'reflective-hoodie', 'fr-shirt', 'arc-flash-hood', 'arc-flash-suit'].every((k) => lvl(k) === 'needs-test-evidence'));
ok('described: leather gloves, work shoes, rubber boots, hats, back support, base layer, corporate jacket, balaclava', ['leather-work-gloves', 'work-shoes', 'rubber-boots', 'hats-caps', 'back-support', 'thermal-base-layer', 'corporate-jacket', 'balaclava'].every((k) => lvl(k) === 'described' && res(k).protective === null));
const harness = res('safety-harness');
ok("the harness says compliance comes from the manufacturer's certification, never from the tech file", /compliance comes from the manufacturer's certification of the exact model, never from this tech file/.test(harness.protective?.evidence ?? '') && /must not claim compliance/.test(harness.protective.evidence));
ok('safety footwear says it must be third-party certified and the tech file never claims compliance', /never claims compliance/.test(res('safety-boots').protective?.evidence ?? ''));
const newProtective = A.ADDED_TEMPLATES.filter((t) => t.body.protective);
ok('every new protective template has the verify warning (edition, scope, brand certification does not transfer)', newProtective.length >= 9 && newProtective.every((t) => t.body.protective.evidence.includes(A.VERIFY_EVIDENCE) && /current edition and the product scope/.test(t.body.protective.evidence) && /does not transfer/.test(t.body.protective.evidence)));
ok('no new template claims a standard: every protective standards list is empty', newProtective.every((t) => t.body.protective.standards.length === 0));
const cands = A.ADDED_TEMPLATES.flatMap((t) => t.body.standardCandidates ?? []);
ok('every standard candidate has an https source link and is marked "to-verify"', cands.length >= 17 && cands.every((c) => /^https:\/\/\S+$/.test(c.link) && c.status === 'to-verify' && c.standard));
ok('every protective type with a template shows candidates, marked "to verify, not claims"', ['cut-resistant-gloves', 'safety-boots', 'safety-harness', 'protective-sleeves'].every((k) => /to verify, not claims/.test(C.protectiveText(res(k))) && res(k).standardCandidates.length >= 1));
ok('older protective types read exactly as before on screen', ['high-visibility-vest', 'fr-coveralls', 'firefighter-turnout-coat'].every((k) => { const r = res(k); return C.protectiveText(r, 'Standards to check for this garment') === `Standards to check for this garment: ${r.protective.standards.join(', ')}. ${r.protective.evidence}`; }) && C.viewsText(['front', 'back']) === 'front and back');
const doc = 'audit-docs/36-standards-to-verify.md';
if (fs.existsSync(doc)) { const md = fs.readFileSync(doc, 'utf8'); ok('audit-docs/36-standards-to-verify.md lists every candidate with its link', cands.every((c) => md.includes(c.link) && md.includes(c.standard))); }
else console.log('SKIP standards document check (audit-docs not on this machine)');

// --- the SQL file agrees with the code
const sqlFile = 'audit-docs/deliverables/task-27-categories-and-templates.sql';
if (fs.existsSync(sqlFile)) {
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const count = (re) => (sql.match(re) || []).length;
  ok('the SQL file: 20 templates, 9 categories, 41 moved types, 42 new types; no switch-off, rename, or template edit', count(/^insert into public\.template_versions /gm) === 20 && count(/^insert into public\.garment_categories /gm) === 9 && count(/^update public\.garment_types set category = /gm) === 41 && count(/^insert into public\.garment_types /gm) === 42 && !/set (label|active|template_family|template_modules)\b/.test(sql.replace(/on conflict \(key\) do update set label = excluded\.label/g, '')) && !/update public\.template/.test(sql));
} else console.log('SKIP SQL file check (audit-docs not on this machine)');

// --- DEV
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a = createClient(U, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: cats } = await a.from('garment_categories').select('key, label, sort, base_template');
ok('DEV: the 9 categories match the code (name, order, base template)', cats?.length === 9 && D.DEFAULT_GARMENT_CATEGORIES.every((c) => { const r = cats.find((x) => x.key === c.key); return r && r.label === c.label && r.sort === c.sort && r.base_template === (A.CATEGORY_BASE[c.key] ?? 'garment-base'); }));
const { data: rows } = await a.from('garment_types').select('key, label, category, sort, active, template_family, template_modules');
const typeDiff = types.filter((t) => { const r = rows.find((x) => x.key === t.key); const m = T.TYPE_TEMPLATES[t.key] ?? A.ADDED_TYPE_TEMPLATES[t.key]; return !r || r.label !== t.label || r.category !== t.category || r.sort !== t.sort || !r.active || r.template_family !== m.family || canon(r.template_modules ?? []) !== canon(m.modules ?? []); }).map((t) => t.key);
ok('DEV: all 83 types match the code (name, category, sort, on, family, add-ons)', typeDiff.length === 0, typeDiff.join(','));
const { data: vrows } = await a.from('template_versions').select('template_key, version, body').eq('version', 1);
const bodyDiff = A.ADDED_TEMPLATES.filter((t) => canon(vrows.find((r) => r.template_key === t.key)?.body) !== canon(t.body)).map((t) => t.key);
ok('DEV: the 20 new templates at version 1 equal the code', bodyDiff.length === 0, bodyDiff.join(','));
const S = await import('../../src/lib/template-store.ts');
S.clearTemplateCache();
const dbCat = await S.getTemplateCatalog(a);
const resDiff = keys.filter((k) => canon(C.resolveTemplate(k, rows.find((r) => r.key === k)?.template_family, dbCat)) !== canon(res(k)));
ok('DEV: every one of the 83 types resolves from the database exactly as from the code', dbCat.source === 'database' && resDiff.length === 0, resDiff.slice(0, 5).join(','));

// --- the API serves it (an admin, after two-step sign-in)
const pw = 'Tmp-pass-9876!', t = Date.now();
const adm = (await a.auth.admin.createUser({ email: `zz-cat-a-${t}@yopmail.com`, password: pw, email_confirm: true, app_metadata: { role: 'admin' } })).data.user;
try {
  const jar = new Map();
  const sb = createServerClient(U, AK, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const si = await sb.auth.signInWithPassword({ email: adm.email, password: pw }); if (si.error) throw si.error;
  await stepUp(sb);
  const ck = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const r = await fetch('http://localhost:10001/api/replications/garment-types', { headers: { Cookie: ck } });
  const j = await r.json();
  ok('the API gives the screens the 9 categories and all 83 types', r.status === 200 && j.categories?.length === 9 && keys.every((k) => j.types.some((x) => x.key === k)), String(r.status));
  ok('  and resolves a glove, a boot and a harness from the database with their certification levels', C.resolveTemplate('cut-resistant-gloves', 'glove', j.templates).certification === 'needs-test-evidence' && C.resolveTemplate('safety-boots', 'footwear', j.templates).certification === 'certified-equipment' && C.resolveTemplate('safety-harness', 'harness', j.templates).certification === 'certified-equipment');
  const page = await fetch('http://localhost:10001/admin/replication/garment-types', { headers: { Cookie: ck } });
  ok('the Garment types screen loads', page.status === 200);
} catch (e) { console.log('ERROR', e); ok('API checks ran', false); } finally {
  await a.auth.admin.deleteUser(adm.id);
  S.clearTemplateCache();
  console.log('cleaned');
}
