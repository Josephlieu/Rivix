// Task 30: tech file revision history, locked approved revisions, customer approval documents, archive instead of delete, and
// glove and footwear size columns. Proves:
// - every admin save that changes the tech file keeps a revision (who, when, a readable list of what changed, the template and
//   drawing versions); saves that change nothing in the tech file add none;
// - approving stores the PDF of that exact revision with its SHA-256; an approved tech file is locked until "Start a new draft";
//   the approved revision and its PDF never change; the database refuses edits and deletes of revisions and approvals;
// - customer approvals: only on an approved revision; PDF, JPEG, PNG, .eml, .msg only (checked by content; never SVG or HTML);
//   who approved and when, the SHA-256, who attached it; downloads always as a file;
// - a request with an approved revision or a customer approval cannot be deleted: it is archived (and restored);
// - reps, customers and signed-out callers reach none of it; the stored files are not reachable from the browser;
// - glove and footwear size columns (editable labels; footwear with a size system and a width) on screen and in the PDF.
// Run on DEV only, after task-30-revisions.sql and task-30b-archive-and-delete-guard.sql, with `EMAIL_DRY_RUN=1 npm run dev`:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/revisions.test.mjs
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import fs from 'fs';
import { stepUp } from './mfa.mjs';
import { deleteTestRequest } from './cleanup.mjs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const sha = (b) => createHash('sha256').update(b).digest('hex');

const R = await import('../../src/lib/revisions.ts');
const AF = await import('../../src/lib/approval-files.ts');
const C = await import('../../src/lib/template-catalog.ts');
const A = await import('../../src/lib/garmentAiAnalysis.ts');
const res = (k) => C.resolveTemplate(k, null, C.BUILT_IN_CATALOG);

// --- offline: what changed, labels, sizes, files
const base = (over = {}) => R.techFileSnapshot({ clientName: 'ZZ', productName: 'Parka', garmentType: 'jacket', specs: { coreMaterial: 'Nylon', typeCheck: { confirmedType: 'jacket' }, garmentPosted: true },
  analysis: { measurements: [{ pom: 'A', description: 'Chest', xs: '', s: '', m: '', l: '', xl: '', tolerance: '', needsConfirmation: true }], checklist: [{ key: 'colour', label: 'Colour and colour placement', value: '', required: true, needsConfirmation: true }], markings: [], flags: ['fabricAnalysis.material'], fabricAnalysis: { material: '' }, review: { status: 'draft', revision: 0 } }, ...over });
const s0 = base();
ok('a revision copy leaves out what is not the tech file (type confirmation, parcel)', !('typeCheck' in s0.specs) && !('garmentPosted' in s0.specs) && s0.specs.coreMaterial === 'Nylon');
const s1 = { ...s0, garmentType: 'parka', specs: { ...s0.specs, coreMaterial: 'Polyester' }, analysis: { ...s0.analysis, flags: [], fabricAnalysis: { material: '100% nylon' }, measurements: [{ ...s0.analysis.measurements[0], m: '24', needsConfirmation: false }], checklist: [{ ...s0.analysis.checklist[0], value: 'Navy body', needsConfirmation: false }], markings: [{ kind: 'care', text: 'Wash cold', photo: 1, location: 'neck', needsConfirmation: true }] } };
const ch = R.describeChanges(s0, s1);
const has = (re) => ch.some((l) => re.test(l));
ok('what changed reads plainly: product type, spec fields, fabric, measurement, checklist, markings, confirmations', has(/^Product type: Jacket, parka and coat|^Product type: Jacket → Parka/) && has(/^Base material: "Nylon" → "Polyester"$/) && has(/^Fabric material: blank → "100% nylon"$/) && has(/^Fabric material: confirmed$/) && has(/^Measurement A \(Chest\), M: blank → "24"$/) && has(/^Measurement A \(Chest\): confirmed$/) && has(/^Checklist Colour and colour placement: blank → "Navy body"$/) && has(/^Checklist Colour and colour placement: confirmed$/) && has(/^Marking added: "care: Wash cold"$/), ch.join(' | '));
ok('the first revision says so; approving and starting a new draft are named', R.describeChanges(null, s0)[0].startsWith('First recorded revision') && R.describeChanges(s0, { ...s0, analysis: { ...s0.analysis, review: { status: 'approved', revision: 1 } } }).includes('Approved as Rev 1') && R.describeChanges({ ...s0, analysis: { ...s0.analysis, review: { status: 'approved', revision: 1 } } }, s0).includes('New draft started from Rev 1'));
ok('a change only in what the server sets (approval, drawing stamp, scan time) is not a content change', R.contentKey(s0) === R.contentKey({ ...s0, analysis: { ...s0.analysis, review: { status: 'approved', revision: 3 }, drawing: { key: 'jacket', version: 1 }, analyzedAt: 'x' } }) && R.contentKey(s0) !== R.contentKey(s1));
ok('revision labels: "Rev 2", "Draft (after Rev 2)", "Draft"', R.revisionLabel({ status: 'approved', revision: 2 }) === 'Rev 2' && R.revisionLabel({ status: 'draft', revision: 2 }) === 'Draft (after Rev 2)' && R.revisionLabel({ status: 'draft', revision: 0 }) === 'Draft');
ok('size columns: gloves 7 to 11, footwear 7 to 11 with a width and "US men\'s", clothing XS to XL', R.defaultSizeRun('glove').labels.join() === '7,8,9,10,11' && R.defaultSizeRun('shoe-width').sizeSystem === "US men's" && R.defaultSizeRun('shoe-width').width === 'D' && R.defaultSizeRun('alpha') === null && R.sizeLabels({}).join() === 'XS,S,M,L,XL');
ok('size labels are editable and the footwear note shows the size system and width', R.sizeLabels({ sizeRun: { system: 'glove', labels: ['6', '7', '8', '9', '10'] } }).join() === '6,7,8,9,10' && R.sizeNote({ sizeRun: { system: 'shoe', labels: [], width: 'EE', sizeSystem: 'EU' } }) === 'EU sizes, width EE');
ok('a size column change is in the history', R.describeChanges(s0, { ...s0, analysis: { ...s0.analysis, sizeRun: { system: 'glove', labels: ['6', '7', '8', '9', '10'] } } }).some((l) => l === 'Size columns: XS, S, M, L, XL → 6, 7, 8, 9, 10'));
ok('the AI scan gives gloves and footwear their size columns, clothing none', A.applyTemplate({}, res('cut-resistant-gloves'), {}, { kind: 'product' }).sizeRun?.system === 'glove' && A.applyTemplate({}, res('safety-boots'), {}, { kind: 'product' }).sizeRun?.system === 'shoe' && A.applyTemplate({}, res('jacket')).sizeRun === undefined);
const PDF = Buffer.from('%PDF-1.4\n%\xe2\xe3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'binary');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c80000000049454e44ae426082', 'hex');
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const EML = Buffer.from('From: Pat Buyer <pat@example.com>\r\nTo: rivix@example.com\r\nSubject: Approved: tech file RQ-0001 Rev 1\r\nDate: Wed, 11 Nov 2026 10:00:00 +0000\r\n\r\nApproved, go ahead.\r\n');
const MSG = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(504)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = Buffer.from('<!doctype html><html><body><script>alert(1)</script></body></html>');
const okType = (b, n, t) => { const r = AF.checkApprovalFile(new Uint8Array(b), n); return r.type === t; };
ok('approval files accepted by content: PDF, JPEG, PNG, .eml and .msg', okType(PDF, 'a.pdf', 'application/pdf') && okType(JPG, 'a.jpg', 'image/jpeg') && okType(PNG, 'a.png', 'image/png') && okType(EML, 'a.eml', 'message/rfc822') && okType(MSG, 'a.msg', 'application/vnd.ms-outlook'));
const refused = (b, n) => 'error' in AF.checkApprovalFile(new Uint8Array(b), n);
ok('refused: SVG, HTML (also when named .eml or .png), a GIF, a PDF named .png, an empty file, over 10 MB', refused(SVG, 'a.svg') && refused(SVG, 'a.png') && refused(HTML, 'a.html') && refused(HTML, 'mail.eml') && refused(Buffer.from('GIF89a......'), 'a.gif') && refused(PDF, 'a.png') && refused(Buffer.alloc(0), 'a.pdf') && refused(Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]), 'big.pdf'));
ok('file names are made safe to show and download', AF.safeFileName('../../<script>x.pdf') === 'script_x.pdf' || !/[<>/\\]/.test(AF.safeFileName('../../<script>x.pdf')));

// --- the real PDF and Review tab (the .tsx loader, in a child process)
const chk = spawnSync(process.execPath, ['--no-warnings', '--import', './scripts/e2e/tsx-resolve.mjs', 'scripts/e2e/pdf-drawing.check.mjs'], { encoding: 'utf8', timeout: 240_000 });
let P = null; try { P = JSON.parse(chk.stdout.trim().split('\n').pop()); } catch { /* reported below */ }
ok('PDF: glove size columns (edited labels) and their note', P?.draftGloveSizes?.sizes.join() === '6,7,8,9,10' && /Hand sizes/.test(P.draftGloveSizes.sizeNote), chk.stderr.slice(0, 200));
ok('PDF: footwear size columns with the size system and width ("EU sizes, width EE")', P?.draftBootSizes?.sizes.join() === '8,9,10,11,12' && /EU sizes, width EE/.test(P.draftBootSizes.sizeNote));
ok('PDF: a glove draft saved before size columns existed still prints hand sizes 7 to 11', P?.draftGlove?.sizes.join() === '7,8,9,10,11');
ok('PDF: clothing keeps XS to XL; an older approved tech file prints exactly as before', P?.draftJacket?.sizes.join() === 'XS,S,M,L,XL' && P?.oldApprovedJacket?.sizes.join() === 'XS,S,M,L,XL' && !P.oldApprovedJacket.sizeNote);
const SC = P?.screen ?? {};
ok('Review tab: glove and footwear size columns are editable (7 to 11), footwear shows "US men\'s" and width D', SC.gloveDefaults?.sizeHeads.join() === '7,8,9,10,11' && SC.bootDefaults?.sizeHeads.join() === '7,8,9,10,11' && SC.bootDefaults.sizeSystem && SC.bootDefaults.width, JSON.stringify(SC.bootDefaults));
ok('Review tab: an approved tech file is locked, with "Start a new draft (Rev N+1)"; a draft is not', SC.approvedV1Jacket?.locked && SC.approvedV1Jacket.startDraft === '4' && !SC.draftJacket?.locked && SC.draftJacket.startDraft === null);

// --- DEV
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const a = createClient(U, (env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now();
const mk = async (e, x) => (await a.auth.admin.createUser({ email: e, password: pw, email_confirm: true, ...(x ? { app_metadata: x } : {}) })).data.user;
const adm = await mk(`zz-rev-a-${t}@yopmail.com`, { role: 'admin' }), ru = await mk(`zz-rev-r-${t}@yopmail.com`, { role: 'rep' }), cu = await mk(`zz-rev-c-${t}@yopmail.com`);
const { data: rep } = await a.from('reps').insert({ name: 'ZZ REV Rep', email: ru.email, user_id: ru.id }).select().single();
const cookie = async (e) => { const j = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } }); const x = await sb.auth.signInWithPassword({ email: e, password: pw }); if (x.error) throw x.error; await stepUp(sb); return [...j].map(([k, v]) => `${k}=${v}`).join('; '); };
const call = (m, url, ck, body) => fetch('http://localhost:10001' + url, { method: m, headers: { ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(ck ? { Cookie: ck } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, redirect: 'manual' });
const ids = [];
const draftOf = (k, m = '') => { const tt = res(k); return { analyzedAt: new Date().toISOString(), components: [], measurements: A.templateMeasurements(tt).map((x) => ({ ...x, m: m || '24', needsConfirmation: false })), checklist: A.checklistFor(tt).map((c) => ({ ...c, value: c.value || 'x', needsConfirmation: false })), construction: [], labelPlacements: [], stitchReference: [], flags: [] }; };
const form = (file, name, type, fields = {}) => { const f = new FormData(); f.append('file', new Blob([file], { type }), name); for (const [k, v] of Object.entries({ approvedBy: 'Pat Buyer', approvedOn: '2026-11-10', note: 'Signed by the customer', ...fields })) f.append(k, v); return f; };
try {
  const ac = await cookie(adm.email), rc = await cookie(ru.email), cc = await cookie(cu.email);
  const before = await a.from('replication_revisions').select('id, status').eq('created_by_email', 'before revision history');
  ok('DEV: existing tech files got a starting revision from the SQL (approved ones locked)', (before.data?.length ?? 0) >= 1, `${before.data?.length} starting revisions`);
  let r = await call('POST', '/api/replications', ac, { clientName: 'ZZ REV Client', productName: 'ZZ REV Parka', garmentType: 'parka', repId: rep.id });
  let j = await r.json(); const id = j.replication.id; ids.push(id);
  const hist = async () => (await (await call('GET', `/api/replications/${id}/revisions`, ac)).json()).revisions;
  ok('a request with no tech file yet has no revisions', (await hist()).length === 0);
  let cur = j.replication;
  r = await call('PUT', `/api/replications/${id}`, ac, { ...cur, aiAnalysis: draftOf('parka') }); j = await r.json(); cur = j.replication;
  let h = await hist();
  ok('the first save of a tech file is revision #1, by the admin, with the template and drawing versions it used', h.length === 1 && h[0].seq === 1 && h[0].status === 'draft' && h[0].by === adm.email && h[0].templateVersions.some((v) => v.key === 'jacket' && v.version === 1) && h[0].drawing?.key === 'jacket' && h[0].drawing.version === 1, JSON.stringify(h[0]?.templateVersions));
  r = await call('PUT', `/api/replications/${id}`, ac, { ...cur }); r = await call('PUT', `/api/replications/${id}`, ac, { ...cur, rivixTrackingNumber: 'ZZ-1', clientTrackingNumber: 'ZZ-2' });
  ok('saves that do not change the tech file (unchanged, tracking numbers) add no revision', (await hist()).length === 1);
  r = await call('PUT', `/api/replications/${id}`, ac, { ...cur, aiAnalysis: { ...cur.aiAnalysis, measurements: cur.aiAnalysis.measurements.map((m, i) => (i === 0 ? { ...m, m: '25' } : m)) } }); j = await r.json(); cur = j.replication;
  h = await hist();
  ok('a change is a new revision with a readable list of what changed', h.length === 2 && h[0].seq === 2 && h[0].changes.some((c) => c === 'Measurement A (Chest), M: "24" → "25"'), JSON.stringify(h[0]?.changes));
  r = await call('PUT', `/api/replications/${id}`, ac, { ...cur, approve: true }); j = await r.json(); cur = j.replication;
  h = await hist();
  const rev1 = h[0];
  ok('approving records "Rev 1", approved, with its PDF fingerprint (SHA-256)', r.status === 200 && rev1.seq === 3 && rev1.status === 'approved' && rev1.revision === 1 && /^[0-9a-f]{64}$/.test(rev1.pdf?.sha256 ?? '') && rev1.changes.includes('Approved as Rev 1') && !j.pdfWarning, j.pdfWarning || JSON.stringify(rev1?.changes));
  r = await call('GET', `/api/replications/${id}/revisions/3/pdf`, ac); j = await r.json();
  const pdfRes = await fetch(j.url); const pdf1 = Buffer.from(await pdfRes.arrayBuffer());
  ok('the stored PDF downloads (as a file), is a real PDF, and matches its fingerprint', pdf1.subarray(0, 5).toString() === '%PDF-' && sha(pdf1) === rev1.pdf.sha256 && /attachment/i.test(pdfRes.headers.get('content-disposition') || ''), pdfRes.headers.get('content-disposition'));
  r = await call('PUT', `/api/replications/${id}`, ac, { ...cur, aiAnalysis: { ...cur.aiAnalysis, measurements: cur.aiAnalysis.measurements.map((m, i) => (i === 0 ? { ...m, m: '26' } : m)) } }); j = await r.json();
  ok('an approved tech file is locked: a change without "Start a new draft" is refused', r.status === 409 && j.code === 'locked' && /Start a new draft/.test(j.error));
  r = await call('PUT', `/api/replications/${id}`, ac, { ...cur, specs: { ...cur.specs, coreMaterial: 'Changed' } });
  ok('  that includes the spec fields on it', r.status === 409);
  r = await call('PUT', `/api/replications/${id}`, ac, { ...cur, status: 'sample_production' }); j = await r.json(); cur = j.replication;
  ok('  but saves that do not change the tech file still work (status)', r.status === 200 && cur.status === 'sample_production' && (await hist()).length === 3);
  const dbEdit = await a.from('replication_revisions').update({ changes: ['tampered'] }).eq('id', rev1.id);
  const dbDel = await a.from('replication_revisions').delete().eq('id', rev1.id);
  const dbPdf = await a.from('replication_revisions').update({ pdf_path: 'x/other.pdf', pdf_sha256: 'a'.repeat(64) }).eq('id', rev1.id);
  ok('the database refuses to edit or delete a revision, or to replace its PDF, even for the server', !!dbEdit.error && !!dbDel.error && !!dbPdf.error, dbEdit.error?.message);
  r = await call('PUT', `/api/replications/${id}`, ac, { ...cur, newDraft: true, aiAnalysis: { ...cur.aiAnalysis, measurements: cur.aiAnalysis.measurements.map((m, i) => (i === 0 ? { ...m, m: '26' } : m)) } }); j = await r.json(); cur = j.replication;
  h = await hist();
  ok('"Start a new draft": the change saves as a draft revision; Rev 1 stays approved', r.status === 200 && cur.aiAnalysis.review.status === 'draft' && h[0].seq === 4 && h[0].status === 'draft' && h[0].changes.includes('New draft started from Rev 1') && h.find((x) => x.seq === 3).status === 'approved');
  const again = Buffer.from(await (await fetch((await (await call('GET', `/api/replications/${id}/revisions/3/pdf`, ac)).json()).url)).arrayBuffer());
  ok('  and Rev 1\'s PDF is unchanged (same bytes, same fingerprint)', sha(again) === rev1.pdf.sha256);
  r = await call('GET', `/api/replications/${id}/revisions/compare?from=2&to=4`, ac); j = await r.json();
  ok('compare two revisions: what changed between them', r.status === 200 && j.changes.some((c) => c === 'Measurement A (Chest), M: "25" → "26"'), JSON.stringify(j.changes));
  r = await call('POST', `/api/replications/${id}/revisions/3/pdf`, ac); ok('"Make PDF" never replaces an existing PDF', r.status === 409);
  r = await call('POST', `/api/replications/${id}/revisions/4/pdf`, ac); ok('  and a draft has no PDF to make', r.status === 400);

  // customer approval documents
  r = await call('POST', `/api/replications/${id}/revisions/4/approvals`, ac, form(PDF, 'approval.pdf', 'application/pdf'));
  ok('a customer approval cannot be attached to a draft revision', r.status === 400);
  for (const [n, f] of [['an SVG', form(SVG, 'approval.svg', 'image/svg+xml')], ['HTML named .eml', form(HTML, 'approval.eml', 'message/rfc822')], ['a PDF named .png', form(PDF, 'approval.png', 'image/png')], ['no approver', form(PDF, 'a.pdf', 'application/pdf', { approvedBy: '' })], ['a future date', form(PDF, 'a.pdf', 'application/pdf', { approvedOn: '2030-01-01' })]]) {
    r = await call('POST', `/api/replications/${id}/revisions/3/approvals`, ac, f); ok(`refused: ${n}`, r.status === 400, String(r.status));
  }
  r = await call('POST', `/api/replications/${id}/revisions/3/approvals`, ac, form(PDF, 'Signed approval.pdf', 'application/pdf')); j = await r.json();
  ok('a signed PDF is attached to Rev 1, with its SHA-256', r.status === 200 && j.sha256 === sha(PDF), j.error || '');
  r = await call('POST', `/api/replications/${id}/revisions/3/approvals`, ac, form(EML, 'approval email.eml', 'message/rfc822', { note: 'Correction: the email itself' }));
  r = await call('POST', `/api/replications/${id}/revisions/3/approvals`, ac, form(PNG, 'photo of signature.png', 'image/png'));
  h = await hist();
  const apps = h.find((x) => x.seq === 3).approvals;
  ok('the history shows each approval: the approver, the date, the file, its SHA-256 and who attached it', apps.length === 3 && apps[0].approvedBy === 'Pat Buyer' && apps[0].approvedOn === '2026-11-10' && apps[0].uploadedBy === adm.email && apps[0].sha256 === sha(PDF) && apps.some((x) => x.fileType === 'message/rfc822' && x.sha256 === sha(EML)) && apps.some((x) => x.fileType === 'image/png'));
  r = await call('GET', `/api/replications/${id}/approvals/${apps[0].id}`, ac); j = await r.json();
  const dl = await fetch(j.url); const got = Buffer.from(await dl.arrayBuffer());
  ok('an approval downloads as a file (never opened in the browser), byte for byte', sha(got) === apps[0].sha256 && /attachment/i.test(dl.headers.get('content-disposition') || ''));
  const appEdit = await a.from('replication_customer_approvals').update({ approved_by_name: 'Someone else' }).eq('id', apps[0].id);
  const appDel = await a.from('replication_customer_approvals').delete().eq('id', apps[0].id);
  ok('the database refuses to edit or delete a customer approval, even for the server', !!appEdit.error && !!appDel.error && (await a.from('replication_customer_approvals').select('id').eq('id', apps[0].id)).data.length === 1);
  const { data: row } = await a.from('replication_customer_approvals').select('file_path').eq('id', apps[0].id).single();
  const over = await a.storage.from('tech-files').upload(row.file_path, Buffer.from('%PDF-1.4 other'), { contentType: 'application/pdf', upsert: false });
  ok('a stored file is never overwritten (upload without overwrite is refused)', !!over.error);
  const anon = createClient(U, AK, { auth: { persistSession: false } });
  const sr = createClient(U, AK, { auth: { persistSession: false } }); await sr.auth.signInWithPassword({ email: ru.email, password: pw });
  const sa = createClient(U, AK, { auth: { persistSession: false } }); await sa.auth.signInWithPassword({ email: adm.email, password: pw });
  const tries = await Promise.all([anon, sr, sa].map((c) => c.storage.from('tech-files').download(row.file_path)));
  const tables = await Promise.all([anon, sr, sa].flatMap((c) => [c.from('replication_revisions').select('id').eq('replication_id', id), c.from('replication_customer_approvals').select('id').eq('replication_id', id)]));
  ok('the files and tables are not reachable from the browser (public key, a rep, even an admin\'s browser session)', tries.every((x) => !!x.error) && tables.every((x) => !!x.error || (x.data || []).length === 0));

  // who may reach the history
  for (const [n, ck] of [['a rep (the request\'s own rep)', rc], ['a customer', cc], ['someone signed out', null]]) {
    const codes = await Promise.all([
      call('GET', `/api/replications/${id}/revisions`, ck), call('GET', `/api/replications/${id}/revisions/compare?from=1&to=2`, ck), call('GET', `/api/replications/${id}/revisions/3/pdf`, ck),
      call('POST', `/api/replications/${id}/revisions/3/pdf`, ck), call('POST', `/api/replications/${id}/revisions/3/approvals`, ck, form(PDF, 'a.pdf', 'application/pdf')), call('GET', `/api/replications/${id}/approvals/${apps[0].id}`, ck),
      call('POST', `/api/replications/${id}/archive`, ck, { archived: true }),
    ]).then((rs) => rs.map((x) => x.status));
    ok(`${n} reaches none of it (history, compare, PDF, approvals, archive)`, codes.every((c) => c === 401 || c === 403), codes.join(','));
  }
  r = await call('GET', `/api/replications/${id}`, rc); j = await r.json();
  ok('the rep still sees only where the tech file is (draft after Rev 1), never its content', r.status === 200 && j.replication.aiAnalysis === null && j.replication.techFile.status === 'draft' && j.replication.techFile.revision === 1);

  // delete is refused: archive instead
  r = await call('DELETE', `/api/replications/${id}`, ac); j = await r.json();
  ok('a request with an approved revision cannot be deleted: archive it instead', r.status === 409 && j.code === 'archive-instead');
  const guard = await a.from('replications').delete().eq('id', id);
  ok('the database refuses it too, even for the server (task-30b)', !!guard.error && /archive it instead/.test(guard.error.message), guard.error?.message || 'deleted!');
  r = await call('POST', `/api/replications/${id}/archive`, ac, { archived: true }); j = await r.json();
  ok('the admin archives it: everything is kept', r.status === 200 && !!j.replication?.archivedAt && (await hist()).length === 4, j.error || '');
  const list = async (q = '') => (await (await call('GET', `/api/replications${q}`, ac)).json()).replications.map((x) => x.id);
  const listRep = (await (await call('GET', '/api/replications', rc)).json()).replications.map((x) => x.id);
  ok('an archived request leaves the queue (admin and rep), and can be listed with ?archived=1', !(await list()).includes(id) && !listRep.includes(id) && (await list('?archived=1')).includes(id));
  r = await call('POST', `/api/replications/${id}/archive`, ac, { archived: false }); j = await r.json();
  ok('and restored to the queue', r.status === 200 && j.replication.archivedAt === null && (await list()).includes(id));
  r = await call('POST', '/api/replications', ac, { clientName: 'ZZ REV Client', productName: 'ZZ REV Draft only', garmentType: 'parka' }); j = await r.json(); const plain = j.replication.id;
  await call('PUT', `/api/replications/${plain}`, ac, { ...j.replication, aiAnalysis: draftOf('parka') });
  r = await call('DELETE', `/api/replications/${plain}`, ac);
  ok('a request with only draft revisions can still be deleted (its history goes with it)', r.status === 200 && (await a.from('replication_revisions').select('id').eq('replication_id', plain)).data.length === 0);

  // gloves and footwear
  r = await call('POST', '/api/replications', ac, { clientName: 'ZZ REV Client', productName: 'ZZ REV Glove', garmentType: 'cut-resistant-gloves' }); j = await r.json(); const gid = j.replication.id; ids.push(gid);
  const gl = { ...draftOf('cut-resistant-gloves'), sizeRun: { system: 'glove', labels: ['7', '8', '9', '10', '11'] } };
  r = await call('PUT', `/api/replications/${gid}`, ac, { ...j.replication, aiAnalysis: gl }); j = await r.json();
  r = await call('PUT', `/api/replications/${gid}`, ac, { ...j.replication, aiAnalysis: { ...gl, sizeRun: { system: 'glove', labels: ['6', '7', '8', '9', '10'] } } });
  const gh = (await (await call('GET', `/api/replications/${gid}/revisions`, ac)).json()).revisions;
  ok('a glove revision records the glove template and drawing; renaming the size columns is in its history', gh[1].templateVersions.some((v) => v.key === 'glove') && gh[1].templateVersions.some((v) => v.key === 'product-base') && gh[1].drawing?.key === 'glove' && gh[0].changes.includes('Size columns: 7, 8, 9, 10, 11 → 6, 7, 8, 9, 10'), JSON.stringify(gh[0]?.changes));
} catch (e) { console.log('ERROR', e); ok('DEV checks ran', false); } finally {
  for (const i of ids) await deleteTestRequest(a, i);
  await a.from('notifications').delete().like('body', '%ZZ REV%');
  await a.from('rep_activity').delete().like('summary', '%ZZ REV%');
  if (rep) await a.from('reps').delete().eq('id', rep.id);
  for (const u of [adm, ru, cu]) if (u) await a.auth.admin.deleteUser(u.id);
  console.log('cleaned');
}
