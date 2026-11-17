// Bug of 2026-11-17 (RQ-0635): after an AI scan of a Footwear → Safety Boots request, /admin/replication/RQ-0635 showed "This
// page couldn't load" on every reload. Gloves, footwear and PPE scans have no BOM lists in their answer, the scan saved `bom` with
// packaging only, and the Review tab's Hardware box called .join on nothing. Proves, with a FAKE AI (no Gemini call):
// - every one of the 9 categories (plus a glove and a footwear explicitly), with a normal and an odd AI answer: the real Review
//   tab and the real AI analysis tab draw without a crash, and empty boxes say "Not filled in" (a placeholder only);
// - the saved RQ-0635 shape (BOM with packaging only), for a boot and a glove: both tabs draw, Hardware/Thread/Labels empty;
// - normalizeAnalysis: full shape for every category and for garbage, never throws, idempotent, and NEVER invents a value
//   (every non-empty text it returns was in what it was given);
// - revisions: a copy that differs only in shape is the same tech file (no change, no new revision), a real edit still is;
// - the section error boundary's fallback;
// - on DEV, for a boot and a glove: a scan result saved the way the page saves it; the old shape written back as RQ-0635 had it;
//   the admin API sends the clean shape (and never writes it back on a read); both tabs draw from what the API sends; saving the
//   unchanged copy of an APPROVED (locked) tech file is not refused and adds no revision; compare lists a real edit only; the
//   rep's API and page; the admin page answers 200.
// Run on DEV only, with the server on port 10001:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/replication-scan-render.test.mjs
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { stepUp } from './mfa.mjs';
import { deleteTestRequest } from './cleanup.mjs';
import { confirmAll } from './confirm.mjs'; // 2026-11-18: approvals need a person's explicit confirmations
const require = createRequire(import.meta.url);
const { createServerClient } = require('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);

const C = await import('../../src/lib/template-catalog.ts');
const S = await import('../../src/lib/scan-template.ts');
const D = await import('../../src/lib/garment-types-data.ts');
const N = await import('../../src/lib/analysis-shape.ts');
const R = await import('../../src/lib/revisions.ts');
const res = (k) => C.resolveTemplate(k, null, C.BUILT_IN_CATALOG);
const fake = (answer) => async () => JSON.stringify(answer);
const scan = async (k, answer) => (await S.runTemplateScan({ template: res(k), typeKey: k, typeName: D.garmentTypeLabel(k), photoCount: 1, customerNotes: '', ask: fake(answer) })).analysis;

// Two AI answers: a plain one, and one where every part comes back in the wrong shape.
const MINIMAL = { productIdentification: { mode: 'visual', brand: null, model: null, source: 'photos' }, garmentClass: 'ZZ item', overallConfidence: 70, components: [], colorway: { bodyColor: 'navy', contrastColors: [], hardwareFinish: '' }, labelPlacements: [], washCare: { instructions: [] }, suggestions: {}, markings: [], fields: {}, flags: [] };
const ODD = { productIdentification: 'photos', garmentClass: 42, overallConfidence: 'high', components: [null, 5, 'zip', { id: 'c1', type: 'zipper', label: 'Front zip', location: 'front', confidence: 'x', x: 10, y: 'y' }], bom: 'one zipper', colorway: null, washCare: { instructions: 'Wash cold\nHang dry' }, measurements: 'chest 24', labelPlacements: { type: 'x' }, suggestions: [], markings: 'none', fields: [], flags: 'colorway.bodyColor' };

// The shape RQ-0635 was saved with (a boot scan): BOM with packaging only. Names are ZZ; no customer data.
const partialBom = (typeKey, sizeRun) => ({
  analyzedAt: '2026-11-16T17:38:15.079Z', review: { status: 'draft', revision: 0 }, garmentClass: 'ZZ item', overallConfidence: 95, season: '',
  productIdentification: { mode: 'visual', brand: 'zz-brand', model: null, source: 'photos' },
  components: [{ id: 'comp_1', type: 'toe_cap', label: 'scuff cap', location: 'outer toe', confidence: 95, x: 28, y: 66 }],
  colorway: { bodyColor: 'Tan', contrastColors: ['Brown'], hardwareFinish: 'Antique brass' },
  washCare: { instructions: [], specialNotes: '', instructionsFr: [] },
  bom: { packaging: { cartonSize: '', hangtagSpec: '', polybagSize: '', foldDescription: '' } },
  measurements: [{ pom: 'A', description: 'Shaft height', xs: '', s: '', m: '', l: '', xl: '', tolerance: '', needsConfirmation: true }],
  labelPlacements: [{ type: 'Tongue label', location: 'Outer tongue', material: '', attachment: '', dimensions: '', needsConfirmation: true }],
  construction: [], stitchReference: [], fromCustomer: [], fromWebsite: [], suggestions: {}, flags: ['colorway.hardwareFinish'],
  markings: [{ kind: 'brand', text: 'zz-brand', photo: 1, location: 'tongue label', needsConfirmation: true }],
  checklist: [{ key: 'colour', label: 'Colour and colour placement', photo: 1, value: 'Tan upper', source: 'photo', required: true, needsConfirmation: true }],
  template: { kind: 'product', typeKey, versions: res(typeKey).versions, certification: res(typeKey).certification }, sizeRun,
});
const BOOT = partialBom('safety-boots', { width: 'D', labels: ['7', '8', '9', '10', '11'], system: 'shoe', sizeSystem: "US men's" });
const GLOVE = partialBom('leather-work-gloves', { labels: ['7', '8', '9', '10'], system: 'glove' });

// --- 1) The clean-up (offline)
const leaves = (v, out = new Set()) => { if (typeof v === 'string') { if (v) out.add(v); } else if (typeof v === 'number') out.add(String(v)); else if (v && typeof v === 'object') for (const x of Object.values(v)) leaves(x, out); return out; };
const invented = (input, output) => [...leaves(output)].filter((s) => !leaves(input).has(s) && !String([...leaves(input)].join('\n')).split(/\r?\n/).map((x) => x.trim()).includes(s));
const fullShape = (a) => !!a && ['hardware', 'thread', 'labels'].every((k) => !a.bom || Array.isArray(a.bom[k])) && (!a.bom || typeof a.bom.packaging === 'object')
  && ['components', 'measurements', 'construction', 'stitchReference', 'labelPlacements'].every((k) => Array.isArray(a[k]) && a[k].every((r) => r && typeof r === 'object' && !Array.isArray(r)))
  && (!a.colorway || Array.isArray(a.colorway.contrastColors)) && (!a.washCare || Array.isArray(a.washCare.instructions));
const stable = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([p], [q]) => p.localeCompare(q))) : x));

const cases = [];
const types = [...D.DEFAULT_GARMENT_CATEGORIES.map((c) => D.DEFAULT_GARMENT_TYPES.find((t) => t.category === c.key)?.key).filter(Boolean), 'safety-boots', 'cut-resistant-gloves'];
ok('one type in each of the 9 categories, plus a footwear and a glove', types.length === 11 && D.DEFAULT_GARMENT_CATEGORIES.length === 9, types.join(', '));
for (const k of types) {
  for (const [label, answer] of [['normal', MINIMAL], ['odd', ODD]]) {
    const a = await scan(k, answer);
    const n = N.normalizeAnalysis(a);
    const listsOk = ['hardware', 'thread', 'labels'].every((x) => Array.isArray(a.bom?.[x]));
    ok(`${k} (${label} answer): the scan saves the three BOM lists, and the clean-up gives the full shape`, listsOk && fullShape(n), JSON.stringify(Object.keys(a.bom || {})));
    ok(`${k} (${label} answer): the clean-up invents nothing and changes nothing twice`, invented(a, n).length === 0 && stable(N.normalizeAnalysis(n)) === stable(n), invented(a, n).slice(0, 3).join(' | '));
    cases.push({ name: `${k} ${label}`, garmentType: k, analysis: a });
  }
}
for (const [name, raw] of [['boot (RQ-0635 shape)', BOOT], ['glove (RQ-0635 shape)', GLOVE]]) {
  const n = N.normalizeAnalysis(raw);
  ok(`${name}: the clean-up adds empty Hardware, Thread and Labels lists, nothing else made up`, fullShape(n) && ['hardware', 'thread', 'labels'].every((k) => n.bom[k].length === 0) && invented(raw, n).length === 0);
  ok(`${name}: template, review and size run are untouched`, stable(n.template) === stable(raw.template) && stable(n.review) === stable(raw.review) && stable(n.sizeRun) === stable(raw.sizeRun));
  cases.push({ name, garmentType: raw.template.typeKey, analysis: raw });
}
const garbage = [null, undefined, 'x', 5, [], [1, 2], { bom: 'x', colorway: 'y', washCare: 7, fabricAnalysis: [], components: 'z', measurements: [null, 1, 'a', { pom: 1, m: 24 }], flags: 'a', sizeRun: 'XL', checklist: {}, suggestions: [1], markings: [{ text: 5 }] }];
let threw = false; const outs = [];
for (const g of garbage) { try { outs.push(N.normalizeAnalysis(g)); } catch { threw = true; } }
ok('garbage in: the clean-up never throws; "no analysis" stays null', !threw && outs.slice(0, 6).every((o) => o === null));
const g = outs[6];
ok('garbage in: wrong types become the empty value of the right type (never a guess)', fullShape(g) && g.bom === null && g.colorway === null && g.washCare === null && g.fabricAnalysis === null && g.components.length === 0 && g.measurements.length === 1 && g.measurements[0].pom === '1' && g.measurements[0].m === '24' && g.measurements[0].xl === '' && !('sizeRun' in g) && Array.isArray(g.checklist) && g.checklist.length === 0 && invented(garbage[6], g).length === 0);
cases.push({ name: 'garbage analysis', garmentType: 'safety-boots', analysis: garbage[6] });

// --- 2) Revisions: shape-only differences are no change; a real edit is (footwear and glove)
for (const [name, raw] of [['boot', BOOT], ['glove', GLOVE]]) {
  const snap = (a) => R.techFileSnapshot({ clientName: 'ZZ', productName: 'ZZ', garmentType: a.template.typeKey, specs: {}, analysis: a });
  const clean = N.normalizeAnalysis(raw);
  ok(`revisions (${name}): the saved shape and its clean copy are the same tech file (no new revision, no locked-file refusal)`, R.contentKey(snap(raw)) === R.contentKey(snap(clean)));
  ok(`revisions (${name}): compare between them lists nothing`, R.describeChanges(snap(raw), snap(clean)).length === 0, JSON.stringify(R.describeChanges(snap(raw), snap(clean))));
  const edited = { ...clean, colorway: { ...clean.colorway, bodyColor: 'Black' } };
  const ch = R.describeChanges(snap(raw), snap(edited));
  ok(`revisions (${name}): a real edit is still a change, listed alone`, R.contentKey(snap(raw)) !== R.contentKey(snap(edited)) && ch.length === 1 && /Body colour: "Tan" → "Black"/.test(ch[0]), JSON.stringify(ch));
  ok(`revisions (${name}): a first revision of the old shape counts its rows`, /1 measurements, 1 checklist items/.test(R.describeChanges(null, snap(raw))[0]));
}

// --- 3) Draw the real tabs (child process with the .tsx loader)
const draw = (list) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scan-render-')), 'cases.json');
  fs.writeFileSync(file, JSON.stringify(list));
  const r = spawnSync(process.execPath, ['--no-warnings', '--import', './scripts/e2e/tsx-resolve.mjs', 'scripts/e2e/scan-render.check.mjs', file], { encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
  try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { console.log('ERROR render helper:', (r.stderr || r.stdout).slice(0, 800)); return null; }
};
const drawn = draw(cases);
ok('the render helper ran', !!drawn);
for (const r of drawn?.results ?? []) {
  ok(`${r.name}: the Review tab draws`, r.review === 'ok', r.review);
  ok(`${r.name}: the AI analysis tab draws`, r.analysis === 'ok', r.analysis);
  ok(`${r.name}: empty boxes say "Not filled in" (placeholder only)`, r.reviewNotFilledIn === true);
}
for (const n of ['boot (RQ-0635 shape)', 'glove (RQ-0635 shape)']) {
  const r = drawn?.results.find((x) => x.name === n);
  ok(`${n}: Hardware, Thread and Labels show empty`, r?.boxes?.hardware === '' && r?.boxes?.thread === '' && r?.boxes?.labels === '', JSON.stringify(r?.boxes));
}
const b = drawn?.boundary ?? {};
ok('error boundary: an error turns into the fallback', b.errorTurnsIntoFallback === true);
ok('error boundary: the fallback says the part could not be shown, with "Try again", and shows no request data', b.fallbackText === true && b.fallbackShowsNoData === true);
ok('error boundary: another request starts clean; the same one stays on the fallback until "Try again"', b.resetsForAnotherRequest === true && b.staysForSameRequest === true);
ok('error boundary: children show when nothing fails; RenderSection draws its part as a child', b.childrenShownWhenFine === true && b.renderSectionDraws === true);

// --- 4) DEV: a boot and a glove through the real API and pages
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const a = createClient(U, (env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now();
const mk = async (e, x) => (await a.auth.admin.createUser({ email: e, password: pw, email_confirm: true, ...(x ? { app_metadata: x } : {}) })).data.user;
const adm = await mk(`zz-scr-a-${t}@yopmail.com`, { role: 'admin' }), ru = await mk(`zz-scr-r-${t}@yopmail.com`, { role: 'rep' });
const { data: rep } = await a.from('reps').insert({ name: 'ZZ SCR Rep', email: ru.email, user_id: ru.id }).select().single();
const cookie = async (e) => { const j = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } }); const x = await sb.auth.signInWithPassword({ email: e, password: pw }); if (x.error) throw x.error; await stepUp(sb); return [...j].map(([k, v]) => `${k}=${v}`).join('; '); };
const call = (m, url, ck, body) => fetch('http://localhost:10001' + url, { method: m, headers: { 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
const ids = [];
// Everything a person confirms before approval, for the test only (the clean-up itself never fills anything).
const confirmedAll = (an) => ({ ...an, flags: [], measurements: an.measurements.map((m) => ({ ...m, m: m.m || '10', needsConfirmation: false })), labelPlacements: an.labelPlacements.map((l) => ({ ...l, needsConfirmation: false })), markings: (an.markings || []).map((x) => ({ ...x, needsConfirmation: false })), checklist: (an.checklist || []).map((c) => ({ ...c, value: c.value || 'x', needsConfirmation: false })) });
try {
  const ac = await cookie(adm.email), rc = await cookie(ru.email);
  const devCases = [];
  for (const [label, typeKey] of [['boot', 'safety-boots'], ['glove', 'leather-work-gloves']]) {
    let r = await call('POST', '/api/replications', ac, { clientName: `ZZ SCR ${label}`, productName: `ZZ SCR ${label}`, garmentType: typeKey, repId: rep.id });
    let j = await r.json(); const id = j.replication?.id; ids.push(id);
    ok(`DEV ${label}: request created`, r.status === 200 && !!id, String(r.status));
    const code = j.replication.requestCode;
    const hist = async () => (await (await call('GET', `/api/replications/${id}/revisions`, ac)).json()).revisions ?? [];
    // a) the scan result, saved the way the page saves it after a scan
    const analysis = { ...(await scan(typeKey, MINIMAL)), analyzedAt: new Date().toISOString() };
    r = await call('PUT', `/api/replications/${id}`, ac, { ...j.replication, aiAnalysis: analysis }); j = await r.json();
    ok(`DEV ${label}: the scan result saves, with the three BOM lists`, r.status === 200 && ['hardware', 'thread', 'labels'].every((k) => Array.isArray(j.replication?.aiAnalysis?.bom?.[k])), String(r.status));
    // b) a real edit, then compare
    r = await call('PUT', `/api/replications/${id}`, ac, { ...j.replication, aiAnalysis: { ...j.replication.aiAnalysis, colorway: { ...j.replication.aiAnalysis.colorway, bodyColor: 'ZZ black' } } }); j = await r.json();
    let h = await hist();
    const cmp = await (await call('GET', `/api/replications/${id}/revisions/compare?from=1&to=2`, ac)).json();
    ok(`DEV ${label}: compare lists the real edit only`, h.length === 2 && Array.isArray(cmp.changes) && cmp.changes.length === 1 && /Body colour/.test(cmp.changes[0]), JSON.stringify(cmp.changes ?? cmp));
    // c) approve (the PDF is made on the server from this boot or glove)
    r = await call('PUT', `/api/replications/${id}`, ac, { ...j.replication, aiAnalysis: confirmedAll(j.replication.aiAnalysis), approve: true, confirmations: confirmAll(confirmedAll(j.replication.aiAnalysis)) }); j = await r.json();
    h = await hist();
    ok(`DEV ${label}: approval stores Rev 1 with its PDF`, r.status === 200 && h[0]?.status === 'approved' && /^[0-9a-f]{64}$/.test(h[0]?.pdf?.sha256 ?? ''), JSON.stringify(j.error ?? j.replication?.pdfWarning ?? ''));
    // d) the old shape, as RQ-0635 was saved: BOM with packaging only (service role, a ZZ row)
    const { data: row } = await a.from('replications').select('ai_analysis').eq('id', id).single();
    const old = { ...row.ai_analysis, bom: { packaging: row.ai_analysis.bom.packaging } };
    await a.from('replications').update({ ai_analysis: old }).eq('id', id);
    r = await call('GET', `/api/replications/${id}`, ac); j = await r.json();
    ok(`DEV ${label}: the admin API sends the clean shape (empty BOM lists, nothing made up)`, r.status === 200 && ['hardware', 'thread', 'labels'].every((k) => Array.isArray(j.replication.aiAnalysis.bom[k]) && j.replication.aiAnalysis.bom[k].length === 0));
    const { data: after } = await a.from('replications').select('ai_analysis').eq('id', id).single();
    ok(`DEV ${label}: reading never writes the clean shape back`, stable(after.ai_analysis) === stable(old));
    devCases.push({ name: `DEV ${label} (from the admin API)`, garmentType: typeKey, analysis: j.replication.aiAnalysis, specs: j.replication.specs });
    // e) saving the unchanged copy of the approved (locked) file: not refused, no new revision
    const before = (await hist()).length;
    r = await call('PUT', `/api/replications/${id}`, ac, { ...j.replication }); const k = await r.json();
    ok(`DEV ${label}: saving the unchanged approved file is not refused as an edit, and adds no revision`, r.status === 200 && (await hist()).length === before, `${r.status} ${k.code ?? ''}`);
    // e2) a REAL edit to the approved (locked) boot or glove: refused without "Start a new draft" (no revision, still approved);
    //     with "Start a new draft" it saves as a draft and adds a revision that lists the edit (Rev 1 stays approved).
    const cur = k.replication;
    const edited = { ...cur.aiAnalysis, colorway: { ...cur.aiAnalysis.colorway, bodyColor: `ZZ edited ${label}` } };
    r = await call('PUT', `/api/replications/${id}`, ac, { ...cur, aiAnalysis: edited }); let e = await r.json();
    const still = await (await call('GET', `/api/replications/${id}`, ac)).json();
    ok(`DEV ${label}: a real edit to the approved file is refused as locked, adds no revision, and the file stays approved`, r.status === 409 && e.code === 'locked' && (await hist()).length === before && still.replication.aiAnalysis.review.status === 'approved', `${r.status} ${e.code ?? ''}`);
    r = await call('PUT', `/api/replications/${id}`, ac, { ...cur, aiAnalysis: edited, newDraft: true }); e = await r.json();
    const hh = await hist();
    ok(`DEV ${label}: the same edit with "Start a new draft" turns it back to draft and adds a revision listing the edit`, r.status === 200 && e.replication.aiAnalysis.review.status === 'draft' && hh.length === before + 1 && hh[0].status === 'draft' && hh[0].changes.includes('New draft started from Rev 1') && hh[0].changes.some((c) => /Body colour: .* → "ZZ edited/.test(c)), JSON.stringify(hh[0]?.changes));
    ok(`DEV ${label}: Rev 1 stays approved in the history`, hh.some((x) => x.status === 'approved' && x.revision === 1));
    r = await call('GET', `/api/replications/${id}`, rc); const rv = await r.json();
    ok(`DEV ${label}: the rep now sees the tech file as a draft (status only)`, r.status === 200 && rv.replication.aiAnalysis === null && rv.replication.techFile?.status === 'draft');
    // f) the rep's API and page; the admin page
    r = await call('GET', `/api/replications/${id}`, rc); j = await r.json();
    ok(`DEV ${label}: the rep's API answers, without the analysis, with the tech file status only`, r.status === 200 && j.replication.aiAnalysis === null && ['status', 'revision'].join() === Object.keys(j.replication.techFile ?? {}).join() && Object.keys(j.replication.specs ?? {}).every((x) => ['garmentPosted', 'inboundReceivedAt'].includes(x)) && !/"bom"|"measurements"|cost|margin/i.test(JSON.stringify(j.replication)), JSON.stringify(j.replication?.techFile));
    r = await call('GET', `/rep/replication/${code}`, rc);
    ok(`DEV ${label}: the rep's request page answers 200`, r.status === 200, String(r.status));
    r = await call('GET', `/admin/replication/${code}`, ac);
    ok(`DEV ${label}: the admin request page answers 200`, r.status === 200, String(r.status));
  }
  const d = draw(devCases);
  for (const r of d?.results ?? []) {
    ok(`${r.name}: the Review tab draws`, r.review === 'ok', r.review);
    ok(`${r.name}: the AI analysis tab draws`, r.analysis === 'ok', r.analysis);
    ok(`${r.name}: Hardware, Thread and Labels show empty`, r.boxes?.hardware === '' && r.boxes?.thread === '' && r.boxes?.labels === '', JSON.stringify(r.boxes));
  }
} catch (e) { console.log('ERROR', e); } finally {
  for (const id of ids) await deleteTestRequest(a, id);
  await a.from('reps').delete().eq('id', rep.id);
  for (const u of [adm, ru]) if (u) await a.auth.admin.deleteUser(u.id);
  const { data: left } = await a.from('replications').select('id').like('client_name', 'ZZ SCR%');
  console.log('cleaned; leftover ZZ SCR requests:', left?.length ?? 0);
}
