// Bug of 2026-11-18 (RQ-0635): right after an AI scan seven checklist items showed "CONFIRMED" though nobody had checked them,
// and a second scan was recorded as 16 edits by the admin. Proves, with a FAKE AI (no Gemini call):
// - a fresh scan confirms nothing, in every one of the 9 categories (plus a boot and a glove), whatever the AI says;
// - three states: "needs confirmation", "read from photo", "confirmed" (a person's stamp, who and when, written by the server);
// - only the save's explicit `confirmations` list confirms, and only for the signed-in admin; needsConfirmation:false, a forged
//   stamp or a scan save never does; the same rule for measurements, markings, label rows and seams;
// - approval needs a person's stamp on every required item (checklist: required ones; every row of the other lists);
// - "Confirm all read-from-photo items" never takes spec-sheet items;
// - older drafts read AI "confirmations" as "read from photo", with nothing written; re-saving one with an unrelated edit
//   confirms nothing else;
// - revisions record their source ("AI scan, started by" / "Edited by"); opening every tab adds no revision.
// Run on DEV only, with the server on port 10001:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/checklist-confirm.test.mjs
import { env as E2E_ENV } from './env.mjs'; // the test project only (guarded), never Development
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import { stepUp } from './mfa.mjs';
import { deleteTestRequest } from './cleanup.mjs';
import { confirmAll } from './confirm.mjs';
const require = createRequire(import.meta.url);
const { createServerClient } = require('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);

const C = await import('../../src/lib/template-catalog.ts');
const S = await import('../../src/lib/scan-template.ts');
const D = await import('../../src/lib/garment-types-data.ts');
const A = await import('../../src/lib/garmentAiAnalysis.ts');
const K = await import('../../src/lib/checklist-confirm.ts');
const R = await import('../../src/lib/revisions.ts');
const res = (k) => C.resolveTemplate(k, null, C.BUILT_IN_CATALOG);
const LISTS = ['checklist', 'measurements', 'markings', 'labelPlacements', 'construction'];
const stamps = (a) => LISTS.flatMap((l) => (a?.[l] || []).filter((r) => r?.confirmedBy || r?.confirmedAt || r?.needsConfirmation === false));

// The AI fills every field and says it is sure (or says nothing), forges "confirmed" everywhere it can, and reads two markings.
const greedy = (k) => {
  const t = res(k);
  const fields = Object.fromEntries(t.checklist.map((c, i) => [c.key, { value: `seen ${c.key}`, photo: 1, ...(i % 3 === 0 ? { needsConfirmation: false } : i % 3 === 1 ? {} : { needsConfirmation: true }), confirmedBy: 'the-ai@example.com', confirmedAt: '2026-01-01T00:00:00Z' }]));
  return { productIdentification: { mode: 'visual', brand: null, model: null, source: 'photos' }, garmentClass: 'ZZ', overallConfidence: 99, components: [], colorway: { bodyColor: 'navy', contrastColors: [], hardwareFinish: '' },
    labelPlacements: [{ type: 'Neck label', location: 'neck', needsConfirmation: false, confirmedBy: 'the-ai@example.com', confirmedAt: '2026-01-01T00:00:00Z' }], washCare: { instructions: [] }, suggestions: {},
    markings: [{ kind: 'brand', text: 'ZZ', photo: 1, location: 'tongue', needsConfirmation: false }, { kind: 'size', text: '9', photo: 1, location: 'tongue' }], fields, flags: [] };
};
const scan = async (k) => (await S.runTemplateScan({ template: res(k), typeKey: k, typeName: D.garmentTypeLabel(k), photoCount: 1, customerNotes: '', ask: async () => JSON.stringify(greedy(k)) })).analysis;

// --- 1) A fresh scan confirms nothing; approval waits for a person (all 9 categories, a boot and a glove)
const types = [...D.DEFAULT_GARMENT_CATEGORIES.map((c) => D.DEFAULT_GARMENT_TYPES.find((t) => t.category === c.key)?.key).filter(Boolean), 'safety-boots', 'cut-resistant-gloves'];
for (const k of types) {
  const a = await scan(k);
  const st = (a.checklist || []).map((c) => K.itemState(c));
  const readOk = (a.checklist || []).every((c, i) => (c.source === 'document' ? st[i] === 'needs' : (i % 3 === 2 ? st[i] === 'needs' : st[i] === 'read')));
  ok(`${k}: a fresh scan confirms nothing (checklist, measurements, markings, labels), even when the AI says it is sure or sends a stamp`, stamps(a).length === 0 && !st.includes('confirmed'), JSON.stringify(stamps(a).slice(0, 2)));
  ok(`${k}: AI-read items are "read from photo"; unsure and spec-sheet items "need confirmation"`, readOk, st.join(','));
  const ready = { ...a, flags: [] };
  const open = A.outstandingConfirmations(ready);
  const requiredCount = (a.checklist || []).filter((c) => c.required).length + a.measurements.length + (a.markings || []).length + a.labelPlacements.length + a.construction.length;
  ok(`${k}: approval waits for a person on every required item (${requiredCount})`, open.length === requiredCount, `${open.length} open`);
  const byPerson = K.settleConfirmations(ready, null, { confirmations: confirmAll(ready), actorEmail: 'zz-person@example.com', now: '2026-11-18T10:00:00.000Z' });
  ok(`${k}: once a person confirms them all, nothing is left`, A.outstandingConfirmations(byPerson).length === 0 && stamps(byPerson).every((r) => r.confirmedBy === 'zz-person@example.com' && r.confirmedAt === '2026-11-18T10:00:00.000Z'));
  ok(`${k}: "Confirm all read-from-photo items" never offers a spec-sheet or unsure item`, K.readFromPhotoItems(a.checklist).every((c) => c.source !== 'document' && K.itemState(c) === 'read') && K.readFromPhotoItems(a.checklist).length === st.filter((x) => x === 'read').length);
}

// --- 2) Only the explicit list confirms, only for the actor, and edits take a confirmation away
const boot = await scan('safety-boots');
const keyA = boot.checklist.find((c) => K.itemState(c) === 'read').key, keyB = boot.checklist.filter((c) => K.itemState(c) === 'read')[1].key;
const forged = { ...boot, checklist: boot.checklist.map((c) => ({ ...c, needsConfirmation: false, confirmedBy: 'mallory@example.com', confirmedAt: '2020-01-01T00:00:00Z' })), measurements: boot.measurements.map((m) => ({ ...m, needsConfirmation: false })) };
let s = K.settleConfirmations(forged, null, { scan: true, confirmations: confirmAll(forged), actorEmail: 'zz-admin@example.com' });
ok('a scan save confirms nothing, even with a confirmations list, needsConfirmation:false and a forged stamp', stamps(s).length === 0);
s = K.settleConfirmations(forged, null, { confirmations: [], actorEmail: 'zz-admin@example.com' });
ok('a save without a confirmations list confirms nothing (needsConfirmation:false and a forged stamp are ignored; a value reads "read from photo")', stamps(s).length === 0 && K.itemState(s.checklist.find((c) => c.key === keyA)) === 'read' && s.measurements.every((m) => K.itemState(m, 'measurements') === 'needs'));
const t0 = '2026-11-18T09:00:00.000Z', t1 = '2026-11-18T09:30:00.000Z';
s = K.settleConfirmations(boot, null, { confirmations: [{ list: 'checklist', ref: keyA }, { list: 'measurements', ref: '0' }], actorEmail: 'zz-admin@example.com', now: t0 });
const one = s.checklist.find((c) => c.key === keyA);
ok('the named rows are stamped with the signed-in admin and the time; nothing else', one.confirmedBy === 'zz-admin@example.com' && one.confirmedAt === t0 && s.measurements[0].confirmedBy === 'zz-admin@example.com' && stamps(s).length === 2);
let s2 = K.settleConfirmations({ ...s, checklist: s.checklist.map((c) => ({ ...c })) }, s, { confirmations: [{ list: 'checklist', ref: keyA }], actorEmail: 'zz-other@example.com', now: t1 });
ok('an unchanged confirmed row keeps its first stamp (not re-stamped by a later save or a repeat click)', s2.checklist.find((c) => c.key === keyA).confirmedBy === 'zz-admin@example.com' && s2.checklist.find((c) => c.key === keyA).confirmedAt === t0 && s2.measurements[0].confirmedAt === t0);
s2 = K.settleConfirmations({ ...s, checklist: s.checklist.map((c) => (c.key === keyA ? { ...c, value: 'changed by a person' } : c)) }, s, { confirmations: [], actorEmail: 'zz-admin@example.com', now: t1 });
ok('editing a confirmed value takes the confirmation away', K.itemState(s2.checklist.find((c) => c.key === keyA)) === 'needs' && s2.measurements[0].confirmedBy === 'zz-admin@example.com');
ok('the settled form is stable (settling twice changes nothing)', JSON.stringify(K.canonicalAnalysis(K.canonicalAnalysis(s))) === JSON.stringify(K.canonicalAnalysis(s)));
const ch = R.describeChanges(R.techFileSnapshot({ garmentType: 'safety-boots', analysis: boot }), R.techFileSnapshot({ garmentType: 'safety-boots', analysis: s }));
ok('compare names who confirmed', ch.some((c) => c.includes(': confirmed by zz-admin@example.com')), JSON.stringify(ch));

// --- 3) Older drafts: an AI "confirmed" with no stamp reads as "read from photo"; an unrelated edit confirms nothing else
const legacy = { ...boot, checklist: boot.checklist.map((c) => ({ key: c.key, label: c.label, required: c.required, source: c.source, value: c.value, needsConfirmation: false })), measurements: boot.measurements.map((m) => ({ ...m, needsConfirmation: false })), markings: (boot.markings || []).map((m) => ({ ...m, needsConfirmation: false })) };
const lc = K.canonicalAnalysis(legacy);
ok('older draft: AI "confirmed" items read as "read from photo" (spec-sheet ones as "needs"), rows as "needs"', stamps(lc).length === 0 && lc.checklist.every((c) => K.itemState(c) === (c.source !== 'document' && c.value ? 'read' : 'needs')) && lc.measurements.every((m) => K.itemState(m, 'measurements') === 'needs'));
ok('older draft: reading it twice the same way changes nothing (same tech file for compare and the lock)', R.contentKey(R.techFileSnapshot({ analysis: legacy })) === R.contentKey(R.techFileSnapshot({ analysis: lc })));
const resaved = K.settleConfirmations({ ...legacy, measurements: legacy.measurements.map((m, i) => (i === 0 ? { ...m, m: '27' } : m)) }, legacy, { confirmations: [], actorEmail: 'zz-admin@example.com' });
ok('older draft re-saved with one unrelated edit: nothing else is confirmed', stamps(resaved).length === 0 && A.outstandingConfirmations({ ...resaved, flags: [] }).length > 0);

// --- 4) DEV: a boot and a glove through the real API
const env = E2E_ENV;
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const a = createClient(U, (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now();
const mk = async (e, x) => (await a.auth.admin.createUser({ email: e, password: pw, email_confirm: true, ...(x ? { app_metadata: x } : {}) })).data.user;
const adm = await mk(`zz-cnf-a-${t}@yopmail.com`, { role: 'admin' }), ru = await mk(`zz-cnf-r-${t}@yopmail.com`, { role: 'rep' });
const { data: rep } = await a.from('reps').insert({ name: 'ZZ CNF Rep', email: ru.email, user_id: ru.id }).select().single();
const cookie = async (e) => { const j = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } }); const x = await sb.auth.signInWithPassword({ email: e, password: pw }); if (x.error) throw x.error; await stepUp(sb); return [...j].map(([k, v]) => `${k}=${v}`).join('; '); };
const call = (m, url, ck, body) => fetch('http://localhost:10001' + url, { method: m, headers: { 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
const ids = [];
try {
  const ac = await cookie(adm.email), rc = await cookie(ru.email);
  for (const [label, typeKey] of [['boot', 'safety-boots'], ['glove', 'leather-work-gloves']]) {
    let r = await call('POST', '/api/replications', ac, { clientName: `ZZ CNF ${label}`, productName: `ZZ CNF ${label}`, garmentType: typeKey, repId: rep.id });
    let j = await r.json(); const id = j.replication?.id; ids.push(id); const code = j.replication?.requestCode;
    const hist = async () => (await (await call('GET', `/api/replications/${id}/revisions`, ac)).json()).revisions ?? [];
    // a) the scan result, saved the way the page saves it (scan: true), with forged confirmations on top
    const sc = await scan(typeKey);
    const forgedScan = { ...sc, checklist: sc.checklist.map((c) => ({ ...c, needsConfirmation: false, confirmedBy: 'mallory@example.com', confirmedAt: '2020-01-01T00:00:00Z' })) };
    r = await call('PUT', `/api/replications/${id}`, ac, { ...j.replication, aiAnalysis: { ...forgedScan, analyzedAt: new Date().toISOString() }, scan: true, confirmations: confirmAll(forgedScan) }); j = await r.json();
    ok(`DEV ${label}: a scan save confirms nothing (forged stamps and a confirmations list are ignored)`, r.status === 200 && stamps(j.replication.aiAnalysis).length === 0, String(r.status));
    ok(`DEV ${label}: after the scan, AI-read items show "read from photo" and the rest "needs confirmation"`, j.replication.aiAnalysis.checklist.some((c) => K.itemState(c) === 'read') && j.replication.aiAnalysis.checklist.every((c) => K.itemState(c) !== 'confirmed'));
    let h = await hist();
    ok(`DEV ${label}: the scan's revision is labelled "AI scan, started by" the admin`, h.length === 1 && h[0].source?.kind === 'scan' && h[0].source?.by === adm.email, JSON.stringify(h[0]?.source));
    // b) approval is refused while required items wait for a person
    const filled = { ...j.replication.aiAnalysis, flags: [], measurements: j.replication.aiAnalysis.measurements.map((m) => ({ ...m, m: m.m || '10' })) };
    r = await call('PUT', `/api/replications/${id}`, ac, { ...j.replication, aiAnalysis: filled, approve: true }); let e = await r.json();
    ok(`DEV ${label}: approving without a person's confirmations is refused, naming what is open`, r.status === 400 && /still need confirmation/.test(e.error ?? ''), e.error ?? '');
    // c) a person confirms two checklist items; a forged stamp on a third and a forged "by" are ignored
    const two = j.replication.aiAnalysis.checklist.filter((c) => K.itemState(c) === 'read').slice(0, 2).map((c) => c.key);
    const third = j.replication.aiAnalysis.checklist.find((c) => !two.includes(c.key)).key;
    const body = { ...filled, checklist: filled.checklist.map((c) => (c.key === third ? { ...c, needsConfirmation: false, confirmedBy: 'someone-else@example.com', confirmedAt: '2020-01-01T00:00:00Z' } : c)) };
    r = await call('PUT', `/api/replications/${id}`, ac, { ...j.replication, aiAnalysis: body, confirmations: two.map((ref) => ({ list: 'checklist', ref })) }); j = await r.json();
    const got = j.replication.aiAnalysis.checklist;
    const at = (k) => Date.parse(got.find((c) => c.key === k)?.confirmedAt ?? '');
    ok(`DEV ${label}: a person's confirmation records who (the signed-in admin) and when`, two.every((k) => got.find((c) => c.key === k)?.confirmedBy === adm.email && Math.abs(Date.now() - at(k)) < 5 * 60 * 1000), JSON.stringify(got.filter((c) => two.includes(c.key)).map((c) => [c.confirmedBy, c.confirmedAt])));
    ok(`DEV ${label}: a forged stamp on another item is not a confirmation`, K.itemState(got.find((c) => c.key === third)) !== 'confirmed' && stamps(j.replication.aiAnalysis).length === 2);
    h = await hist();
    ok(`DEV ${label}: that save is "Edited by" the admin and lists who confirmed`, h[0].source?.kind === 'edit' && h[0].source?.by === adm.email && h[0].changes.some((c) => c.includes(`: confirmed by ${adm.email}`)), JSON.stringify(h[0]?.changes?.slice(0, 4)));
    // d) a forged list naming an item the person never saw still records the REAL signed-in admin (only admins can save)
    const unseen = j.replication.aiAnalysis.checklist.find((c) => K.itemState(c) !== 'confirmed').key;
    r = await call('PUT', `/api/replications/${id}`, ac, { ...j.replication, aiAnalysis: { ...j.replication.aiAnalysis, checklist: j.replication.aiAnalysis.checklist.map((c) => (c.key === unseen ? { ...c, confirmedBy: 'ceo@example.com' } : c)) }, confirmations: [{ list: 'checklist', ref: unseen }], confirmedBy: 'ceo@example.com' }); j = await r.json();
    ok(`DEV ${label}: a crafted list is stamped with the real signed-in admin, never a name it sends`, j.replication.aiAnalysis.checklist.find((c) => c.key === unseen)?.confirmedBy === adm.email);
    // e) a rep cannot confirm anything (the analysis is admin only)
    const before = JSON.stringify((await a.from('replications').select('ai_analysis').eq('id', id).single()).data.ai_analysis);
    r = await call('PUT', `/api/replications/${id}`, rc, { ...j.replication, aiAnalysis: { ...j.replication.aiAnalysis }, confirmations: confirmAll(j.replication.aiAnalysis) });
    const after = JSON.stringify((await a.from('replications').select('ai_analysis').eq('id', id).single()).data.ai_analysis);
    ok(`DEV ${label}: a rep's save confirms nothing`, before === after, String(r.status));
    // f) opening every tab and every read the page makes adds no revision
    const n = (await hist()).length;
    for (const tab of ['specs', 'ai', 'review', 'shipping', 'chat']) { const p = await call('GET', `/admin/replication/${code}?tab=${tab}`, ac); if (p.status !== 200) ok(`DEV ${label}: tab ${tab} answers 200`, false, String(p.status)); }
    for (const u of [`/api/replications/${id}`, `/api/replications/${id}/revisions`, `/api/replications/${id}/messages`, `/api/replications/${id}/downloads`, '/api/replications/lookups', '/api/replications/garment-types']) await call('GET', u, ac);
    ok(`DEV ${label}: opening every tab (and every read the page makes) adds no revision`, (await hist()).length === n, `${n} -> ${(await hist()).length}`);
    // g) confirm everything (one click per row, or "Confirm all"), then approve
    r = await call('PUT', `/api/replications/${id}`, ac, { ...j.replication, approve: true, confirmations: confirmAll(j.replication.aiAnalysis) }); e = await r.json();
    ok(`DEV ${label}: with every required item confirmed by a person, approval goes through`, r.status === 200 && e.replication?.aiAnalysis?.review?.status === 'approved' && A.outstandingConfirmations(e.replication.aiAnalysis).length === 0, e.error ?? '');
  }
  // h) an older draft (AI "confirmations", no stamps): read as "read from photo", nothing written; an unrelated edit confirms nothing
  let r = await call('POST', '/api/replications', ac, { clientName: 'ZZ CNF old', productName: 'ZZ CNF old', garmentType: 'leather-work-gloves' });
  let j = await r.json(); const oid = j.replication.id; ids.push(oid);
  const old = await scan('leather-work-gloves');
  const oldShape = { ...old, checklist: old.checklist.map(({ readFromPhoto: _r, ...c }) => ({ ...c, needsConfirmation: false })), measurements: old.measurements.map((m) => ({ ...m, needsConfirmation: false })), labelPlacements: old.labelPlacements.map((l) => ({ ...l, needsConfirmation: false })), markings: (old.markings || []).map((m) => ({ ...m, needsConfirmation: false })) };
  await a.from('replications').update({ ai_analysis: oldShape }).eq('id', oid);
  const storedBefore = (await a.from('replications').select('ai_analysis, updated_at').eq('id', oid).single()).data;
  r = await call('GET', `/api/replications/${oid}`, ac); j = await r.json();
  ok('DEV older draft: AI "confirmations" read as "read from photo" (photo items) or "needs confirmation", never confirmed', j.replication.aiAnalysis.checklist.every((c) => K.itemState(c) === (c.source !== 'document' && c.value ? 'read' : 'needs')) && stamps(j.replication.aiAnalysis).length === 0);
  const storedAfter = (await a.from('replications').select('ai_analysis, updated_at').eq('id', oid).single()).data;
  ok('DEV older draft: reading writes nothing', JSON.stringify(storedAfter.ai_analysis) === JSON.stringify(storedBefore.ai_analysis) && storedAfter.updated_at === storedBefore.updated_at);
  r = await call('PUT', `/api/replications/${oid}`, ac, { ...j.replication, specs: { ...j.replication.specs, specialInstructions: 'ZZ unrelated edit' } });
  const saved = (await a.from('replications').select('ai_analysis').eq('id', oid).single()).data.ai_analysis;
  ok('DEV older draft re-saved with one unrelated edit: nothing is confirmed', r.status === 200 && LISTS.every((l) => (saved[l] || []).every((x) => !x.confirmedBy)));
} catch (e) { console.log('ERROR', e); } finally {
  for (const id of ids) await deleteTestRequest(a, id);
  await a.from('notifications').delete().like('body', '%ZZ CNF%');
  await a.from('rep_activity').delete().like('summary', '%ZZ CNF%');
  await a.from('reps').delete().eq('id', rep.id);
  for (const u of [adm, ru]) if (u) await a.auth.admin.deleteUser(u.id);
  const { data: left } = await a.from('replications').select('id').like('client_name', 'ZZ CNF%');
  console.log('cleaned; leftover ZZ CNF requests:', left?.length ?? 0);
}
