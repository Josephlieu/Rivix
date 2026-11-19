// Bug of 2026-11-18: after "Approve specification" the Review tab kept an old copy (every item unconfirmed, "Unsaved changes"),
// although the stamps were saved. Proves:
// - offline, review-sync.ts (what the tab shows when a new copy arrives): after an approval the tab shows the approved copy with
//   every stamp and nothing unsaved (also with a spec edit made before the save); something typed WHILE saving stays on screen on
//   top of the server's copy, with a notice; clicks made while saving stay pending; a scan arriving with unsaved edits keeps them,
//   with a notice; without edits it is shown;
// - the real Review tab, drawn with the approved copy: every row shows "Confirmed by", no "Unsaved changes";
// - on DEV, after an approval: a STALE save with different content is refused by the lock (409) and changes nothing; a stale save
//   with an unrelated edit never removes a stamp (approved and draft tech files).
// Run on DEV only, with the server on port 10001:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/review-sync.test.mjs
import { env as E2E_ENV } from './env.mjs'; // the test project only (guarded), never Development
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { stepUp } from './mfa.mjs';
import { deleteTestRequest } from './cleanup.mjs';
import { confirmAll } from './confirm.mjs';
const require = createRequire(import.meta.url);
const { createServerClient } = require('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);

const C = await import('../../src/lib/template-catalog.ts');
const S = await import('../../src/lib/scan-template.ts');
const D = await import('../../src/lib/garment-types-data.ts');
const K = await import('../../src/lib/checklist-confirm.ts');
const Y = await import('../../src/lib/review-sync.ts');
const res = (k) => C.resolveTemplate(k, null, C.BUILT_IN_CATALOG);
const answer = { productIdentification: { mode: 'visual', brand: null, model: null, source: 'photos' }, garmentClass: 'ZZ boot', overallConfidence: 90, components: [], colorway: { bodyColor: 'tan', contrastColors: [], hardwareFinish: '' }, labelPlacements: [{ type: 'Tongue label', location: 'tongue' }], washCare: { instructions: [] }, suggestions: {}, markings: [{ kind: 'brand', text: 'ZZ', photo: 1, location: 'tongue' }], fields: { colour: { value: 'Tan upper', photo: 1 }, outsole: { value: 'Lugged rubber', photo: 1 } }, flags: [] };
const scan = async (k) => (await S.runTemplateScan({ template: res(k), typeKey: k, typeName: D.garmentTypeLabel(k), photoCount: 1, customerNotes: '', ask: async () => JSON.stringify(answer) })).analysis;
const stamped = (a) => K.CONFIRMABLE_LISTS.reduce((n, l) => n + (a?.[l] || []).filter((r) => K.isStamped(r)).length, 0);
const rows = (a) => K.CONFIRMABLE_LISTS.reduce((n, l) => n + (a?.[l] || []).length, 0);

// --- 1) The decision (offline), with a real boot scan
const scanned = { ...(await scan('safety-boots')), flags: [] };
scanned.measurements = scanned.measurements.map((m) => ({ ...m, m: '10' }));
const onScreen0 = { specs: { specialInstructions: '' }, analysis: scanned };
const baseline0 = Y.contentKeyOf(onScreen0);
// The person types "f" in Special instructions and clicks every confirm, then approves.
const typed = { ...onScreen0, specs: { specialInstructions: 'f' } };
const clicks = confirmAll(scanned);
const sent = { key: Y.contentKeyOf(typed), pending: clicks };
// What the server sends back: stamps for every click, the approval and its drawing stamp.
const approvedAnalysis = { ...K.settleConfirmations(scanned, null, { confirmations: clicks, actorEmail: 'zz-admin@example.com', now: '2026-11-18T10:00:00.000Z' }), review: { status: 'approved', revision: 1 }, drawing: { key: 'safety-boots', version: 1 } };
const server = { specs: { specialInstructions: 'f' }, analysis: approvedAnalysis };
let r = Y.nextReviewState({ draft: typed, baseline: baseline0, pending: clicks, sent, server });
ok('after an approval (with a spec edit made before it), the tab shows the server\'s approved copy', r.kind === 'load' && r.draft === server && r.notice === null);
ok('  with every stamp, and nothing unsaved', stamped(r.draft.analysis) === rows(scanned) && !Y.isDirty(r.draft, r.baseline, r.pending) && r.pending.length === 0, `${stamped(r.draft.analysis)}/${rows(scanned)}`);
ok('the approval\'s drawing stamp alone is not an unsaved change', Y.contentKeyOf({ ...server, analysis: { ...approvedAnalysis, drawing: { key: 'x', version: 9 }, review: { status: 'draft' } } }) === Y.contentKeyOf(server));
// Typed while saving: the outsole changed on screen after the save was sent.
const outsoleKey = scanned.checklist.find((c) => c.key === 'outsole')?.key ?? scanned.checklist[1].key;
const typedDuring = { ...typed, analysis: { ...typed.analysis, checklist: typed.analysis.checklist.map((c) => (c.key === outsoleKey ? { ...c, value: 'Typed while saving' } : c)) } };
r = Y.nextReviewState({ draft: typedDuring, baseline: baseline0, pending: clicks, sent, server });
const ov = r.draft.analysis.checklist.find((c) => c.key === outsoleKey);
ok('something typed while saving stays on screen, on top of the server\'s copy, with a notice', r.kind === 'merge' && ov.value === 'Typed while saving' && r.notice === Y.NOTICE_TYPED_WHILE_SAVING);
ok('  the server\'s stamps stay on every row the person did not change; the changed row is not confirmed', !K.isStamped(ov) && stamped(r.draft.analysis) === rows(scanned) - 1 && r.draft.analysis.review?.status === 'approved' && !!r.draft.analysis.drawing);
ok('  and it shows as unsaved (the typing is not saved yet)', Y.isDirty(r.draft, r.baseline, r.pending));
// Clicked while saving: a click not carried by the save stays pending.
const extra = { list: 'checklist', ref: 'zz-clicked-while-saving' };
r = Y.nextReviewState({ draft: typed, baseline: baseline0, pending: [...clicks, extra], sent, server });
ok('a click made while saving stays pending (the ones the save carried are done)', r.pending.length === 1 && r.pending[0].ref === extra.ref && Y.isDirty(r.draft, r.baseline, r.pending));
// A scan from elsewhere.
const newScan = { specs: onScreen0.specs, analysis: { ...scanned, garmentClass: 'ZZ newer scan' } };
r = Y.nextReviewState({ draft: typed, baseline: baseline0, pending: [], sent: null, server: newScan });
ok('a new scan arriving while there are unsaved edits keeps them on screen, with a notice', r.kind === 'keep' && r.draft === typed && r.notice === Y.NOTICE_NEWER_COPY);
r = Y.nextReviewState({ draft: onScreen0, baseline: baseline0, pending: [], sent: null, server: newScan });
ok('a new scan with nothing unsaved is shown', r.kind === 'load' && r.draft === newScan && !Y.isDirty(r.draft, r.baseline, r.pending));
r = Y.nextReviewState({ draft: onScreen0, baseline: baseline0, pending: [{ list: 'measurements', ref: '0' }], sent: null, server: newScan });
ok('unsaved clicks also keep the screen (never dropped)', r.kind === 'keep' && r.pending.length === 1);
r = Y.nextReviewState({ draft: onScreen0, baseline: baseline0, pending: [], sent: null, server: { ...onScreen0, analysis: approvedAnalysis } });
ok('a copy that differs only in stamps and approval is shown', r.kind === 'load' && stamped(r.draft.analysis) === rows(scanned));
// The "Leave page?" prompt is on exactly while "Unsaved changes" shows (isDirty).
ok('"Leave page?" is on for a single unsaved confirmation click, with nothing typed', Y.isDirty(onScreen0, baseline0, [{ list: 'checklist', ref: scanned.checklist[0].key }]));
ok('"Leave page?" is on for typing alone', Y.isDirty(typed, baseline0, []));
ok('"Leave page?" is off with nothing typed and no clicks', !Y.isDirty(onScreen0, baseline0, []));
r = Y.nextReviewState({ draft: typed, baseline: baseline0, pending: clicks, sent, server });
ok('"Leave page?" is off once a save succeeds and its copy is on screen', !Y.isDirty(r.draft, r.baseline, r.pending));
const tabSrc = fs.readFileSync('src/app/admin/replication/ReviewTab.tsx', 'utf8');
const leave = tabSrc.match(/useEffect\(\(\) => \{\s*if \(!dirty\) return;[\s\S]*?\}, \[dirty\]\);/)?.[0] ?? '';
ok('the Review tab adds the listener only while dirty and removes it when dirty ends or the tab closes', /addEventListener\('beforeunload'/.test(leave) && /return \(\) => window\.removeEventListener\('beforeunload'/.test(leave) && (tabSrc.match(/beforeunload/g) || []).length === 2);

// --- 2) The real Review tab drawn with the approved copy
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'review-sync-')), 'cases.json');
fs.writeFileSync(file, JSON.stringify([{ name: 'approved boot', garmentType: 'safety-boots', analysis: approvedAnalysis, specs: { specialInstructions: 'f' } }]));
const out = spawnSync(process.execPath, ['--no-warnings', '--import', './scripts/e2e/tsx-resolve.mjs', 'scripts/e2e/scan-render.check.mjs', file], { encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
fs.rmSync(path.dirname(file), { recursive: true, force: true });
let drawn = null; try { drawn = JSON.parse(out.stdout.trim().split('\n').pop()).results[0]; } catch { console.log('ERROR render helper:', (out.stderr || out.stdout).slice(0, 600)); }
ok('the Review tab with the approved copy: every row shows "Confirmed by", none asks to be confirmed, nothing unsaved', drawn?.review === 'ok' && drawn.confirmedBy === rows(scanned) && drawn.unconfirmedButtons === 0 && drawn.unsaved === false, JSON.stringify(drawn && { c: drawn.confirmedBy, b: drawn.unconfirmedButtons, u: drawn.unsaved, rows: rows(scanned) }));

// --- 3) DEV: stale saves after an approval
const env = E2E_ENV;
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const a = createClient(U, (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now();
const adm = (await a.auth.admin.createUser({ email: `zz-rsy-a-${t}@yopmail.com`, password: pw, email_confirm: true, app_metadata: { role: 'admin' } })).data.user;
const cookie = async (e) => { const j = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } }); const x = await sb.auth.signInWithPassword({ email: e, password: pw }); if (x.error) throw x.error; await stepUp(sb); return [...j].map(([k, v]) => `${k}=${v}`).join('; '); };
const call = (m, url, ck, body) => fetch('http://localhost:10001' + url, { method: m, headers: { 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
const ids = [];
const rowNow = async (id) => (await a.from('replications').select('ai_analysis, specs, updated_at, rivix_tracking_number').eq('id', id).single()).data;
try {
  const ac = await cookie(adm.email);
  let r1 = await call('POST', '/api/replications', ac, { clientName: 'ZZ RSY approved', productName: 'ZZ RSY boot', garmentType: 'safety-boots' });
  let j = await r1.json(); const id = j.replication.id; ids.push(id);
  const hist = async () => (await (await call('GET', `/api/replications/${id}/revisions`, ac)).json()).revisions ?? [];
  r1 = await call('PUT', `/api/replications/${id}`, ac, { ...j.replication, aiAnalysis: { ...scanned, analyzedAt: new Date().toISOString() }, scan: true }); j = await r1.json();
  const stale = j.replication; // the copy a tab still shows: before the confirmations and the approval
  r1 = await call('PUT', `/api/replications/${id}`, ac, { ...stale, approve: true, confirmations: confirmAll(stale.aiAnalysis) }); j = await r1.json();
  ok('DEV: the tech file is approved with every row stamped', r1.status === 200 && j.replication.aiAnalysis.review.status === 'approved' && stamped(j.replication.aiAnalysis) === rows(stale.aiAnalysis), j.error ?? '');
  const before = await rowNow(id), nRev = (await hist()).length;
  // a) stale copy with DIFFERENT content (a changed checklist value)
  const changed = { ...stale, aiAnalysis: { ...stale.aiAnalysis, checklist: stale.aiAnalysis.checklist.map((c, i) => (i === 0 ? { ...c, value: 'ZZ changed in a stale tab' } : c)) } };
  r1 = await call('PUT', `/api/replications/${id}`, ac, changed); const e = await r1.json();
  const after1 = await rowNow(id);
  ok('DEV: a stale save with different content after approval is refused by the lock (409)', r1.status === 409 && e.code === 'locked', `${r1.status} ${e.code ?? ''}`);
  ok('  and changes nothing (analysis, specs, time, revisions)', JSON.stringify(after1.ai_analysis) === JSON.stringify(before.ai_analysis) && JSON.stringify(after1.specs) === JSON.stringify(before.specs) && after1.updated_at === before.updated_at && (await hist()).length === nRev);
  // b) stale copy with an UNRELATED edit (a tracking number), no confirmations
  r1 = await call('PUT', `/api/replications/${id}`, ac, { ...stale, rivixTrackingNumber: 'ZZ-STALE-1' });
  const after2 = await rowNow(id);
  ok('DEV: a stale save with an unrelated edit after approval is saved, removes no stamp, keeps the approval, adds no revision', r1.status === 200 && after2.rivix_tracking_number === 'ZZ-STALE-1' && stamped(after2.ai_analysis) === stamped(before.ai_analysis) && after2.ai_analysis.review?.status === 'approved' && (await hist()).length === nRev, `${r1.status} ${stamped(after2.ai_analysis)}/${stamped(before.ai_analysis)}`);
  // c) a DRAFT: confirm some rows, then a stale save with an unrelated spec edit
  let r2 = await call('POST', '/api/replications', ac, { clientName: 'ZZ RSY draft', productName: 'ZZ RSY boot', garmentType: 'safety-boots' });
  j = await r2.json(); const did = j.replication.id; ids.push(did);
  r2 = await call('PUT', `/api/replications/${did}`, ac, { ...j.replication, aiAnalysis: { ...scanned, analyzedAt: new Date().toISOString() }, scan: true }); j = await r2.json();
  const staleDraft = j.replication;
  r2 = await call('PUT', `/api/replications/${did}`, ac, { ...staleDraft, confirmations: confirmAll(staleDraft.aiAnalysis, ['checklist', 'measurements']) }); j = await r2.json();
  const stampsBefore = stamped(j.replication.aiAnalysis);
  r2 = await call('PUT', `/api/replications/${did}`, ac, { ...staleDraft, specs: { ...staleDraft.specs, specialInstructions: 'ZZ unrelated edit from a stale tab' } });
  const after3 = await rowNow(did);
  ok('DEV: on a draft, a stale save with an unrelated edit keeps every stamp and saves the edit', r2.status === 200 && stampsBefore > 0 && stamped(after3.ai_analysis) === stampsBefore && after3.specs.specialInstructions === 'ZZ unrelated edit from a stale tab', `${stamped(after3.ai_analysis)}/${stampsBefore}`);
} catch (err) { console.log('ERROR', err); } finally {
  for (const id of ids) await deleteTestRequest(a, id);
  if (adm) await a.auth.admin.deleteUser(adm.id);
  const { data: left } = await a.from('replications').select('id').like('client_name', 'ZZ RSY%');
  console.log('cleaned; leftover ZZ RSY requests:', left?.length ?? 0);
}
