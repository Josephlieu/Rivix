// Audit log (2026-11-21, approved). Proves:
//   1. Offline: secret fields are hidden by name (substring words, the _hash ending, the API-key names; short words only as the
//      exact field name), secret-looking values are hidden, and customer_code, rep_code, batch_number, key and template_key
//      stay visible. A failed write keeps the action, returns the warning and logs one line with no values.
//   2. Every logged action, done through the real API by the right role, creates EXACTLY ONE row: right person, role, route
//      pattern, record and changed fields; repeats, no-ops and lost races add none.
//   3. Rows cannot be edited or deleted, not even with the server's key (the database proof for TRUNCATE and for the trigger on
//      its own is 92-audit-log-proof.sql).
//   4. Customers and reps are refused: no rights on the table, 401 from the read route, sent away from the page.
//   5. No secret ever appears in a row: the invite token, passwords, temporary passwords, authenticator secrets, the API keys,
//      upload tokens and session tokens used in this run are searched for in every row it created.
// Test project only (zz-aud logins, "ZZ AUD" data, deleted at the end). The audit rows themselves stay: nobody can delete them.
// Requires the server on port 10001 (EMAIL_DRY_RUN=1).
import { env as E2E_ENV } from './env.mjs'; // the test project only (guarded), never Development
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import { enrollTotp } from './mfa.mjs';
import { confirmAll } from './confirm.mjs';
import { deleteTestRequest } from './cleanup.mjs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const AU = await import('../../src/lib/audit.ts');

// =====================================================================================================================
// 1. Offline
// =====================================================================================================================
const hiddenNames = ['code', 'otp', 'totp', 'mfa_code', 'recovery_code', 'qr_code', 'QRCode', 'link', 'signed_url', 'signedUrl', 'upload_url', 'session', 'jwt', 'cookie',
  'set_cookie', 'Set-Cookie', 'authorization', 'Authorization', 'password', 'newPassword', 'temp_password', 'passwd', 'secret', 'totpSecret', 'client_secret', 'SUPABASE_SECRET_KEY',
  'token', 'token_hash', 'accessToken', 'refresh_token', 'invite_token', 'ip_hash', 'api_key', 'apiKey', 'apikey', 'private_key', 'service_role_key', 'publishableKey', 'anon_key'];
const visibleNames = ['customer_code', 'rep_code', 'request_code', 'batch_number', 'key', 'template_key', 'target_key', 'status', 'link_label', 'session_count', 'otp_sent', 'file_sha256', 'email', 'company_name'];
const wrongHidden = visibleNames.filter((n) => AU.isHiddenName(n)), wrongShown = hiddenNames.filter((n) => !AU.isHiddenName(n));
ok('offline: customer_code, rep_code, batch_number, key and template_key stay visible (and other names that only contain a short word)', wrongHidden.length === 0, wrongHidden.join(', '));
ok('offline: code, link and session are hidden as exact names', ['code', 'link', 'session'].every((n) => AU.isHiddenName(n)));
ok(`offline: all ${hiddenNames.length} secret names are hidden (substring words, _hash, API-key names, exact short words, camelCase and dashes)`, wrongShown.length === 0, wrongShown.join(', '));
const red = AU.redact({ status: 'Shipped', customer_code: 'C-1', key: 'parka', code: '123456', nested: { password: 'p', items: [{ apiKey: 'k', name: 'n' }] }, link: 'https://x/join/abc',
  jwt_like: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJl', key_value: 'sb_secret_abcdef', otpauth: 'otpauth://totp/RIVIX?secret=ABC', url: 'https://x.example/cb?access_token=abc',
  header: 'Bearer abcdefghijklmnop', plain_url: 'https://rivix.ca/catalog.pdf' });
ok('offline: hidden by name at any depth, and secret-looking values hidden whatever the name', red.code === AU.HIDDEN && red.link === AU.HIDDEN && red.nested.password === AU.HIDDEN && red.nested.items[0].apiKey === AU.HIDDEN
  && red.nested.items[0].name === 'n' && ['jwt_like', 'key_value', 'otpauth', 'url', 'header'].every((k) => red[k] === AU.HIDDEN), JSON.stringify(red));
ok('offline: ordinary values stay (status, customer_code, key, a plain link to a file)', red.status === 'Shipped' && red.customer_code === 'C-1' && red.key === 'parka' && red.plain_url === 'https://rivix.ca/catalog.pdf');
const cf = AU.changedFields({ status: 'A', carrier: 'X', note: null }, { status: 'B', carrier: 'X', note: null });
ok('offline: only the changed fields are kept', JSON.stringify(cf) === JSON.stringify({ before: { status: 'A' }, after: { status: 'B' } }) && AU.changedFields({ a: 1 }, { a: 1 }) === null);

// A failed write: the action stays, the route gets the warning, and the server logs one line with no values.
const fake = (error) => { const sent = []; return { sent, from: () => ({ insert: async (row) => { sent.push(row); return { error }; } }) }; };
const actor = { userId: '11111111-1111-1111-1111-111111111111', role: 'admin', email: 'zz-offline@example.com' };
const entry = { action: 'order.stage_change', table: 'orders', id: 'ord-1', route: 'PATCH /api/admin/orders/[id]', before: { status: 'Secret-old-value', password: 'pw-1' }, after: { status: 'Secret-new-value' } };
const logged = []; const realError = console.error; console.error = (...x) => logged.push(x.join(' '));
let res;
try {
  res = await AU.audit(fake({ code: '42501', message: 'permission denied' }), actor, entry);
} finally { console.error = realError; }
ok('offline: a failed write returns the warning for the response (the action is kept)', res.auditWarning === AU.AUDIT_NOT_RECORDED && /saved, but it could not be written to the audit log/.test(res.auditWarning));
const line = logged[0] ?? ''; const parsed = (() => { try { return JSON.parse(line.slice(line.indexOf('{'))); } catch { return null; } })();
ok('offline: the server logs one line: action, record table + id, actor id and route, enough to add the row later', logged.length === 1 && parsed && parsed.action === entry.action && parsed.record_table === 'orders'
  && parsed.record_id === 'ord-1' && parsed.actor_user_id === actor.userId && parsed.route === entry.route, line);
ok('offline: that line holds no values and no secrets (no before/after, no email)', !/Secret-old-value|Secret-new-value|pw-1|zz-offline/.test(line) && !('before' in (parsed || {})) && !('after' in (parsed || {})));
const good = fake(null); logged.length = 0; console.error = (...x) => logged.push(x.join(' '));
try { res = await AU.audit(good, actor, entry); } finally { console.error = realError; }
ok('offline: a good write returns no warning; the row sent already has the password hidden', !res.auditWarning && logged.length === 0 && good.sent[0].before.password === AU.HIDDEN && good.sent[0].before.status === 'Secret-old-value');
logged.length = 0; console.error = (...x) => logged.push(x.join(' '));
try { res = await AU.audit(fake({ code: '23505' }), actor, { ...entry, action: 'admin_2fa.enrolled' }, { once: true }); } finally { console.error = realError; }
ok('offline: "once" (two-step set-up): a row already there is not an error', !res.auditWarning && logged.length === 0);

// Every route that logs returns the warning in its JSON (the result of audit() is spread into the response).
const routeFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? routeFiles(path.join(dir, d.name)) : d.name === 'route.ts' ? [path.join(dir, d.name)] : []));
const callers = routeFiles('src/app/api').filter((f) => /\baudit\(/.test(fs.readFileSync(f, 'utf8')));
const noWarning = callers.filter((f) => { const s = fs.readFileSync(f, 'utf8'); const vars = [...s.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:[^;]*\?\s*)?await audit\(/g)].map((m) => m[1]); return !(vars.length || /audited = r/.test(s)) || !/\.\.\.(audited|warning)\b/.test(s); });
const EXPECTED_CALLERS = 29;
ok(`offline: all ${EXPECTED_CALLERS} routes that log return the warning in their response`, callers.length === EXPECTED_CALLERS && noWarning.length === 0, `${callers.length} callers; without the warning: ${noWarning.join(', ')}`);

// =====================================================================================================================
// 2-5. On the test project, through the real API
// =====================================================================================================================
const env = E2E_ENV;
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SK = env.SUPABASE_SECRET_KEY;
const a = createClient(U, SK, { auth: { persistSession: false } });
const anon = createClient(U, AK, { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', NEW_PW = 'Zz-Aud-New-pass-' + Date.now().toString(36), t = Date.now();
const started = new Date(Date.now() - 5000).toISOString();
const secrets = [pw, NEW_PW, SK, AK];
const users = [];
const mk = async (tag, meta) => { const u = (await a.auth.admin.createUser({ email: `zz-aud-${tag}-${t}@yopmail.com`, password: pw, email_confirm: true, ...(meta ? { app_metadata: meta } : {}) })).data.user; users.push(u); return u; };
let ipN = 0; const freshIp = () => `10.${t % 250}.${Math.floor(t / 250) % 250}.${10 + (ipN++ % 240)}`;
const call = (m, url, ck, body) => fetch('http://localhost:10001' + url, { method: m, headers: { ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), 'x-real-ip': freshIp(), ...(ck ? { Cookie: ck } : {}) },
  body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, redirect: 'manual' });
// A signed-in session: its cookie for the server, and the client itself (the browser's view of the database).
const signIn = async (email, { mfa = false } = {}) => {
  const j = new Map();
  const sb = createServerClient(U, AK, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } });
  const x = await sb.auth.signInWithPassword({ email, password: pw }); if (x.error) throw x.error;
  let factor = null;
  if (mfa) { factor = await enrollTotp(sb); secrets.push(factor.secret); }
  const s = (await sb.auth.getSession()).data.session; if (s) secrets.push(s.access_token, s.refresh_token);
  return { sb, factor, cookie: () => [...j].map(([k, v]) => `${k}=${v}`).join('; ') };
};
const rowsFor = async (action, id) => (await a.from('audit_log').select('*').eq('action', action).eq('record_id', String(id)).gte('at', started).order('id')).data ?? [];
const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
const fieldsMatch = (want, got) => !want || Object.entries(want).every(([k, v]) => same(got?.[k], v));
/** Exactly `n` rows (default 1) for this action and record; the newest one is checked. */
const expectRows = async (label, action, id, { actor: who, role, route, before, after, keys, n = 1, note }) => {
  const rows = await rowsFor(action, id); const r = rows[rows.length - 1];
  const good = rows.length === n && r && r.actor_user_id === who && r.actor_role === role && r.route === route && fieldsMatch(before, r.before) && fieldsMatch(after, r.after)
    && (!keys || (same(Object.keys(r.before ?? {}).sort(), keys) && same(Object.keys(r.after ?? {}).sort(), keys))) && (note === undefined || r.note === note);
  ok(`${label}: ${n === 1 ? 'exactly one' : `exactly ${n}`} "${action}" row (person, role, route, changed fields)`, good,
    rows.length !== n ? `${rows.length} rows` : JSON.stringify({ who: r.actor_user_id === who, role: r.actor_role, route: r.route, before: r.before, after: r.after }).slice(0, 400));
  return r;
};
const countAll = async () => (await a.from('audit_log').select('id', { count: 'exact', head: true })).count;

// The fake AI scan (as in checklist-confirm.test.mjs): fills every field, so the checklist can be confirmed and approved.
const C = await import('../../src/lib/template-catalog.ts');
const S = await import('../../src/lib/scan-template.ts');
const D = await import('../../src/lib/garment-types-data.ts');
const scan = async (k) => {
  const tpl = C.resolveTemplate(k, null, C.BUILT_IN_CATALOG);
  const fields = Object.fromEntries(tpl.checklist.map((c) => [c.key, { value: `seen ${c.key}`, photo: 1 }]));
  const ans = { productIdentification: { mode: 'visual', brand: null, model: null, source: 'photos' }, garmentClass: 'ZZ', overallConfidence: 90, components: [], colorway: { bodyColor: 'tan', contrastColors: [], hardwareFinish: '' },
    labelPlacements: [{ type: 'Cuff label', location: 'cuff' }], washCare: { instructions: [] }, suggestions: {}, markings: [{ kind: 'size', text: '9', photo: 1, location: 'cuff' }], fields, flags: [] };
  return (await S.runTemplateScan({ template: tpl, typeKey: k, typeName: D.garmentTypeLabel(k), photoCount: 1, customerNotes: '', ask: async () => JSON.stringify(ans) })).analysis;
};
const PDF = Buffer.from('%PDF-1.4\n%\xe2\xe3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'binary');

const made = { orders: [], requests: [], acr: [], reps: [], inviteEmails: [], catalogs: [], catalogPaths: [], specPaths: [], docPaths: [], templates: [], cats: [], types: [], tfs: [] };
let rep = null, cust = null;
try {
  const admA = await mk('a', { role: 'admin' }), admB = await mk('b', { role: 'admin' }), ru = await mk('r', { role: 'rep' }), cu = await mk('c');
  rep = (await a.from('reps').insert({ name: 'ZZ AUD Rep', email: ru.email, user_id: ru.id, active: true }).select('id').single()).data; made.reps.push(rep.id);
  cust = (await a.from('customers').insert({ user_id: cu.id, company_name: 'ZZ AUD Co', contact_email: cu.email, customer_code: '', rep_id: rep.id }).select('id').single()).data;
  const A_ = await signIn(admA.email, { mfa: true }), B_ = await signIn(admB.email, { mfa: true }), R_ = await signIn(ru.email), CU_ = await signIn(cu.email);
  const Apw = await signIn(admA.email); // password only (aal1): not trusted
  const ac = A_.cookie(), rc = R_.cookie(), cc = CU_.cookie(), apw = Apw.cookie();
  const total0 = await countAll();

  // ---- Order stage change ---------------------------------------------------------------------------------------------
  const order = (await a.from('orders').insert({ customer_id: cust.id, rep_id: rep.id, batch_number: '', product_name: 'ZZ AUD Parka', quantity: 3, status: 'Order Received' }).select('id, batch_number').single()).data; made.orders.push(order.id);
  let r = await call('PATCH', `/api/admin/orders/${order.id}`, ac, { status: 'In Production', note: 'ZZ AUD moving on' });
  await expectRows('order stage change', 'order.stage_change', order.id, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/orders/[id]', before: { status: 'Order Received' }, after: { status: 'In Production' }, keys: ['status'], note: 'ZZ AUD moving on' });
  await call('PATCH', `/api/admin/orders/${order.id}`, ac, { status: 'In Production' });
  await call('PATCH', `/api/admin/orders/${order.id}`, ac, { carrier: 'ZZ Carrier' });
  ok('  the same stage again, or a carrier change only, adds no stage row', (await rowsFor('order.stage_change', order.id)).length === 1);

  // ---- Account change requests ----------------------------------------------------------------------------------------
  const acr = async (field, oldV, newV) => { const d = (await a.from('account_change_requests').insert({ customer_id: cust.id, field, old_value: oldV, new_value: newV, requested_by: cu.id }).select('id').single()).data; made.acr.push(d.id); return d.id; };
  const acr1 = await acr('company_name', 'ZZ AUD Co', 'ZZ AUD Co Renamed');
  r = await call('PATCH', `/api/admin/account-requests/${acr1}`, ac, { decision: 'approve' });
  await expectRows('account change approved', 'account_request.approve', acr1, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/account-requests/[id]', before: { status: 'pending', company_name: 'ZZ AUD Co' }, after: { status: 'approved', company_name: 'ZZ AUD Co Renamed' }, keys: ['company_name', 'status'] });
  r = await call('PATCH', `/api/admin/account-requests/${acr1}`, ac, { decision: 'reject' });
  ok('  deciding it again is refused and adds no row', r.status === 409 && (await rowsFor('account_request.approve', acr1)).length === 1 && (await rowsFor('account_request.reject', acr1)).length === 0);
  const acr2 = await acr('shipping_address', null, 'ZZ AUD 1 Test Street');
  await call('PATCH', `/api/admin/account-requests/${acr2}`, ac, { decision: 'reject', note: 'ZZ AUD please call us' });
  await expectRows('account change rejected', 'account_request.reject', acr2, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/account-requests/[id]', before: { status: 'pending' }, after: { status: 'rejected' }, keys: ['status'], note: 'ZZ AUD please call us' });

  // ---- Order requests: decline (rep) and turn into an order (admin, rep) -----------------------------------------------
  const orq = async () => { const d = (await a.from('order_requests').insert({ customer_id: cust.id, kind: 'quote', items: [{ product_name: 'ZZ AUD Vest', sizes: [{ size: 'M', qty: 2 }] }], note: 'ZZ AUD', created_by: cu.id }).select('id').single()).data; made.requests.push(d.id); return d.id; };
  const q1 = await orq();
  await call('PATCH', `/api/order-requests/${q1}`, rc, { action: 'decline', reason: 'ZZ AUD not this season' });
  await expectRows('order request declined by the rep', 'order_request.decline', q1, { actor: ru.id, role: 'rep', route: 'PATCH /api/order-requests/[id]', before: { status: 'open' }, after: { status: 'declined' }, note: 'ZZ AUD not this season' });
  r = await call('PATCH', `/api/order-requests/${q1}`, ac, { action: 'decline', reason: 'again' });
  ok('  declining it again (admin) is refused and adds no row', r.status === 409 && (await rowsFor('order_request.decline', q1)).length === 1);
  const body = (rid) => ({ customer_id: cust.id, request_id: rid, items: [{ product_name: 'ZZ AUD Vest', sizes: [{ size: 'M', qty: 2 }] }] });
  const q2 = await orq();
  r = await call('POST', '/api/admin/orders', ac, body(q2)); let j = await r.json(); if (j.order?.id) made.orders.push(j.order.id);
  await expectRows('order request turned into an order by an admin', 'order_request.convert', q2, { actor: admA.id, role: 'admin', route: 'POST /api/admin/orders', before: { status: 'open' }, after: { status: 'converted', order_id: j.order?.id ?? 'none' } });
  r = await call('POST', '/api/admin/orders', ac, body(q2)); j = await r.json(); if (j.order?.id) made.orders.push(j.order.id);
  ok('  using the same request again is refused and adds no row', r.status === 409 && (await rowsFor('order_request.convert', q2)).length === 1, String(r.status));
  const q3 = await orq();
  r = await call('POST', '/api/rep/orders', rc, body(q3)); j = await r.json(); if (j.order?.id) made.orders.push(j.order.id);
  await expectRows('order request turned into an order by the rep', 'order_request.convert', q3, { actor: ru.id, role: 'rep', route: 'POST /api/rep/orders', after: { status: 'converted', order_id: j.order?.id ?? 'none' } });

  // ---- Rep invites, approvals, rep status, roles -----------------------------------------------------------------------
  const invite = async (tag) => { const email = `zz-aud-new${tag}-${t}@yopmail.com`; made.inviteEmails.push(email); const x = await call('POST', '/api/admin/rep-invites', ac, { email }); const y = await x.json(); const token = y.link?.split('/join/')[1]; if (token) secrets.push(token); return { id: y.invite?.id, email, token }; };
  const inv1 = await invite(1);
  await expectRows('rep invite created', 'rep_invite.create', inv1.id, { actor: admA.id, role: 'admin', route: 'POST /api/admin/rep-invites', after: { email: inv1.email } });
  r = await call('POST', `/api/rep-invites/${inv1.token}`, null, { name: 'ZZ AUD New Rep', password: NEW_PW });
  const newUser1 = (await a.from('rep_invites').select('used_by_user_id, rep_id').eq('id', inv1.id).single()).data;
  if (newUser1?.used_by_user_id) users.push({ id: newUser1.used_by_user_id });
  await expectRows('rep invite accepted (the new rep signs up)', 'rep_invite.accept', inv1.id, { actor: newUser1?.used_by_user_id, role: 'rep', route: 'POST /api/rep-invites/[token]', before: { used: false }, after: { used: true, role: 'rep', rep_id: newUser1?.rep_id } });
  await call('POST', `/api/admin/rep-invites/${inv1.id}/approve`, ac);
  await expectRows('rep approved after the invite', 'rep_invite.approve', inv1.id, { actor: admA.id, role: 'admin', route: 'POST /api/admin/rep-invites/[id]/approve', after: { approved: true, rep_active: true } });
  r = await call('POST', `/api/admin/rep-invites/${inv1.id}/approve`, ac);
  ok('  approving again is refused and adds no row', r.status === 409 && (await rowsFor('rep_invite.approve', inv1.id)).length === 1);
  const inv2 = await invite(2);
  await call('POST', `/api/admin/rep-invites/${inv2.id}/cancel`, ac);
  await expectRows('rep invite cancelled', 'rep_invite.cancel', inv2.id, { actor: admA.id, role: 'admin', route: 'POST /api/admin/rep-invites/[id]/cancel', after: { cancelled: true } });
  r = await call('POST', `/api/admin/rep-invites/${inv2.id}/cancel`, ac);
  ok('  cancelling again is refused and adds no row', r.status === 409 && (await rowsFor('rep_invite.cancel', inv2.id)).length === 1);
  // Switching a rep off and on: one row each time; switching on a rep who joined by invite also approves it (same row).
  const inv3 = await invite(3);
  await call('POST', `/api/rep-invites/${inv3.token}`, null, { name: 'ZZ AUD New Rep 3', password: NEW_PW });
  const nu3 = (await a.from('rep_invites').select('used_by_user_id, rep_id').eq('id', inv3.id).single()).data;
  if (nu3?.used_by_user_id) users.push({ id: nu3.used_by_user_id });
  await call('PATCH', `/api/admin/reps/${nu3?.rep_id}`, ac, { active: true });
  await expectRows('rep switched on (approves the invite in the same click)', 'rep.status_change', nu3?.rep_id, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/reps/[id]', before: { active: false }, after: { active: true, invite_approved: true } });
  ok('  ...and that click adds no separate invite-approval row', (await rowsFor('rep_invite.approve', inv3.id)).length === 0);
  await call('PATCH', `/api/admin/reps/${nu3?.rep_id}`, ac, { active: true });
  await call('PATCH', `/api/admin/reps/${nu3?.rep_id}`, ac, { phone: '403 555 0101' });
  ok('  switching on an active rep, or a phone change, adds no status row', (await rowsFor('rep.status_change', nu3?.rep_id)).length === 1);
  await call('PATCH', `/api/admin/reps/${nu3?.rep_id}`, ac, { active: false });
  await expectRows('rep switched off', 'rep.status_change', nu3?.rep_id, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/reps/[id]', before: { active: true }, after: { active: false }, keys: ['active'], n: 2 });
  // Role given: a new rep with a login; a login for a rep who had none; a password reset is not a role change.
  r = await call('POST', '/api/admin/reps', ac, { name: 'ZZ AUD Rep Two', email: `zz-aud-r2-${t}@yopmail.com`, create_login: true }); j = await r.json();
  const rep2 = j.rep?.id; made.reps.push(rep2); if (j.credentials?.password) secrets.push(j.credentials.password);
  const rep2User = (await a.from('reps').select('user_id').eq('id', rep2).single()).data?.user_id; if (rep2User) users.push({ id: rep2User });
  await expectRows('rep role given (new rep with a login)', 'role.grant', rep2, { actor: admA.id, role: 'admin', route: 'POST /api/admin/reps', before: { role: null }, after: { role: 'rep', user_id: rep2User } });
  r = await call('POST', `/api/admin/reps/${rep2}/login`, ac); j = await r.json(); if (j.credentials?.password) secrets.push(j.credentials.password);
  ok('  a password reset gives no role and adds no row', j.reset === true && (await rowsFor('role.grant', rep2)).length === 1);
  const rep3 = (await a.from('reps').insert({ name: 'ZZ AUD Rep Three', email: `zz-aud-r3-${t}@yopmail.com`, active: true }).select('id').single()).data.id; made.reps.push(rep3);
  r = await call('POST', `/api/admin/reps/${rep3}/login`, ac); j = await r.json(); if (j.credentials?.password) secrets.push(j.credentials.password);
  const rep3User = (await a.from('reps').select('user_id').eq('id', rep3).single()).data?.user_id; if (rep3User) users.push({ id: rep3User });
  await expectRows('rep role given (a login for an existing rep)', 'role.grant', rep3, { actor: admA.id, role: 'admin', route: 'POST /api/admin/reps/[id]/login', after: { role: 'rep', user_id: rep3User } });
  await call('DELETE', `/api/admin/reps/${rep2}`, ac);
  await expectRows('rep role removed (rep and login deleted)', 'role.revoke', rep2, { actor: admA.id, role: 'admin', route: 'DELETE /api/admin/reps/[id]', before: { role: 'rep', user_id: rep2User }, after: { role: null } });

  // ---- Admin two-step sign-in ------------------------------------------------------------------------------------------
  r = await call('POST', '/api/admin/mfa/enrolled', ac); j = await r.json();
  await expectRows('admin two-step set up (reported by the page after the code)', 'admin_2fa.enrolled', A_.factor.factorId, { actor: admA.id, role: 'admin', route: 'POST /api/admin/mfa/enrolled', after: { status: 'verified', factor_type: 'totp' } });
  r = await call('POST', '/api/admin/mfa/enrolled', ac); j = await r.json();
  ok('  reported again: no second row for the same authenticator', j.recorded === 0 && (await rowsFor('admin_2fa.enrolled', A_.factor.factorId)).length === 1, JSON.stringify(j));
  for (const [n, ck] of [['customer', cc], ['rep', rc], ['password-only admin', apw], ['signed-out', null]]) { r = await call('POST', '/api/admin/mfa/enrolled', ck); ok(`  ${n}: the two-step report route answers 401`, r.status === 401, String(r.status)); }
  await call('POST', `/api/admin/admins/${admB.id}/reset-mfa`, ac);
  await expectRows("another admin's two-step reset", 'admin_2fa.reset', admB.id, { actor: admA.id, role: 'admin', route: 'POST /api/admin/admins/[userId]/reset-mfa', before: { authenticators: 1 }, after: { authenticators: 0 } });

  // ---- Catalogue, document and product spec uploads and deletes ---------------------------------------------------------
  const up = async (url, bucket, bodyExtra, buf = PDF, name = 'zz-aud.pdf') => {
    const x = await call('POST', url, ac, { file_name: name, size: buf.length, mime: 'application/pdf', ...bodyExtra }); const y = await x.json();
    if (y.token) secrets.push(y.token);
    if (y.path) { const u = await anon.storage.from(bucket).uploadToSignedUrl(y.path, y.token, buf, { contentType: 'application/pdf' }); if (u.error) throw new Error(`upload failed: ${u.error.message}`); }
    return y.path;
  };
  const cp1 = await up('/api/admin/catalogs/upload-url', 'catalogs', {}); made.catalogPaths.push(cp1);
  r = await call('POST', '/api/admin/catalogs', ac, { path: cp1, file_name: 'zz-aud.pdf', title: 'ZZ AUD Catalogue' }); j = await r.json(); const cat = j.id; made.catalogs.push(cat);
  await expectRows('catalogue uploaded', 'catalog.upload', cat, { actor: admA.id, role: 'admin', route: 'POST /api/admin/catalogs', after: { title: 'ZZ AUD Catalogue', file_name: 'zz-aud.pdf' } });
  await call('PATCH', `/api/admin/catalogs/${cat}`, ac, { title: 'ZZ AUD Catalogue renamed' });
  const cp2 = await up('/api/admin/catalogs/upload-url', 'catalogs', {}, Buffer.concat([PDF, Buffer.from('v2')]), 'zz-aud-v2.pdf'); made.catalogPaths.push(cp2);
  await call('PATCH', `/api/admin/catalogs/${cat}`, ac, { path: cp2, file_name: 'zz-aud-v2.pdf' });
  await expectRows('catalogue file replaced (a title edit alone adds nothing)', 'catalog.replace_file', cat, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/catalogs/[id]', before: { file_name: 'zz-aud.pdf' }, after: { file_name: 'zz-aud-v2.pdf' } });
  await call('DELETE', `/api/admin/catalogs/${cat}`, ac);
  await expectRows('catalogue deleted', 'catalog.delete', cat, { actor: admA.id, role: 'admin', route: 'DELETE /api/admin/catalogs/[id]', before: { title: 'ZZ AUD Catalogue renamed', file_name: 'zz-aud-v2.pdf' } });
  const dp = await up(`/api/admin/orders/${order.id}/documents/upload-url`, 'documents', {}); made.docPaths.push(dp);
  r = await call('POST', `/api/admin/orders/${order.id}/documents`, ac, { path: dp, file_name: 'zz-aud.pdf', title: 'ZZ AUD Certificate', doc_type: 'Other' }); j = await r.json(); const doc = j.id;
  await expectRows('document uploaded', 'document.upload', doc, { actor: admA.id, role: 'admin', route: 'POST /api/admin/orders/[id]/documents', after: { title: 'ZZ AUD Certificate', file_name: 'zz-aud.pdf', order: order.batch_number } });
  await call('PATCH', `/api/admin/documents/${doc}`, ac, { expires_on: '2030-01-01' });
  await call('DELETE', `/api/admin/documents/${doc}`, ac);
  await expectRows('document deleted (an expiry edit adds nothing)', 'document.delete', doc, { actor: admA.id, role: 'admin', route: 'DELETE /api/admin/documents/[docId]', before: { title: 'ZZ AUD Certificate' } });
  ok('  the document has exactly 2 rows: upload and delete', (await a.from('audit_log').select('id').eq('record_id', doc).gte('at', started)).data.length === 2);
  const sp1 = await up('/api/admin/product-specs/upload-url', 'product-specs', { customer_id: cust.id }); made.specPaths.push(sp1);
  r = await call('POST', '/api/admin/product-specs', ac, { customer_id: cust.id, product_name: 'ZZ AUD Spec', path: sp1 }); j = await r.json(); const spec = j.id;
  await expectRows('product spec uploaded', 'product_spec.upload', spec, { actor: admA.id, role: 'admin', route: 'POST /api/admin/product-specs', after: { product_name: 'ZZ AUD Spec', file_path: sp1 } });
  const sp2 = await up('/api/admin/product-specs/upload-url', 'product-specs', { customer_id: cust.id }, Buffer.concat([PDF, Buffer.from('v2')])); made.specPaths.push(sp2);
  await call('PATCH', `/api/admin/product-specs/${spec}`, ac, { path: sp2 });
  await expectRows('product spec file replaced', 'product_spec.replace_file', spec, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/product-specs/[id]', before: { file_path: sp1 }, after: { file_path: sp2 } });
  await call('PATCH', `/api/admin/product-specs/${spec}`, ac, { description: 'ZZ AUD text only' });
  await call('PATCH', `/api/admin/product-specs/${spec}`, ac, { remove_file: true });
  await expectRows('product spec file removed (a text edit adds nothing)', 'product_spec.remove_file', spec, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/product-specs/[id]', before: { file_path: sp2 }, after: { file_path: null } });
  await call('DELETE', `/api/admin/product-specs/${spec}`, ac);
  await expectRows('product spec deleted', 'product_spec.delete', spec, { actor: admA.id, role: 'admin', route: 'DELETE /api/admin/product-specs/[id]', before: { product_name: 'ZZ AUD Spec' } });

  // ---- Templates, categories, product types ----------------------------------------------------------------------------
  r = await call('POST', '/api/admin/templates', ac, { fromKey: 'jacket', label: `ZZ AUD Parka ${t}` }); j = await r.json(); const tk = j.key; made.templates.push(tk);
  await expectRows('template created', 'template.create', tk, { actor: admA.id, role: 'admin', route: 'POST /api/admin/templates', after: { version: 1 } });
  j = await (await call('GET', `/api/admin/templates/${tk}`, ac)).json(); const v1 = j.versions?.[0];
  const b2 = { ...v1.body, points: [...v1.body.points, { code: 'N', name: 'Collar spread', howToMeasure: 'Across the collar points', method: 'flat' }] };
  await call('POST', `/api/admin/templates/${tk}/versions`, ac, { label: `ZZ AUD Parka ${t}`, description: v1.body.description ?? 'x', body: b2, note: 'ZZ AUD add the collar spread', baseVersion: 1 });
  await expectRows('template version published', 'template.version', tk, { actor: admA.id, role: 'admin', route: 'POST /api/admin/templates/[key]/versions', before: { version: 1 }, after: { version: 2 }, note: 'ZZ AUD add the collar spread' });
  await call('PATCH', `/api/admin/templates/${tk}`, ac, { active: false });
  await expectRows('template switched off', 'template.edit', tk, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/templates/[key]', before: { active: true }, after: { active: false } });
  r = await call('POST', '/api/admin/garment-categories', ac, { label: `ZZ AUD Cat ${t}`, baseTemplate: 'product-base' }); j = await r.json(); const ck = j.key; made.cats.push(ck);
  await expectRows('category created', 'category.create', ck, { actor: admA.id, role: 'admin', route: 'POST /api/admin/garment-categories', after: { label: `ZZ AUD Cat ${t}`, base_template: 'product-base' } });
  await call('PATCH', `/api/admin/garment-categories/${ck}`, ac, { label: `ZZ AUD Cat renamed ${t}` });
  await expectRows('category renamed', 'category.edit', ck, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/garment-categories/[key]', before: { label: `ZZ AUD Cat ${t}` }, after: { label: `ZZ AUD Cat renamed ${t}` }, keys: ['label'] });
  r = await call('POST', '/api/admin/garment-types', ac, { label: `ZZ AUD Type ${t}`, category: 'outerwear' }); j = await r.json(); const ty = j.type?.key; made.types.push(ty);
  await expectRows('product type created', 'type.create', ty, { actor: admA.id, role: 'admin', route: 'POST /api/admin/garment-types', after: { label: `ZZ AUD Type ${t}`, category: 'outerwear' } });
  await call('PATCH', `/api/admin/garment-types/${ty}`, ac, { active: false });
  await expectRows('product type switched off', 'type.edit', ty, { actor: admA.id, role: 'admin', route: 'PATCH /api/admin/garment-types/[key]', before: { active: true }, after: { active: false }, keys: ['active'] });

  // ---- Tech file: confirmations, approval, the customer's approval -----------------------------------------------------
  r = await call('POST', '/api/replications', ac, { clientName: 'ZZ AUD glove', productName: 'ZZ AUD glove', garmentType: 'leather-work-gloves', repId: rep.id }); j = await r.json();
  const tf = j.replication?.id; made.tfs.push(tf);
  const sc = await scan('leather-work-gloves');
  r = await call('PUT', `/api/replications/${tf}`, ac, { ...j.replication, aiAnalysis: { ...sc, analyzedAt: new Date().toISOString() }, scan: true, confirmations: confirmAll(sc) }); j = await r.json();
  ok('tech file: a scan save confirms nothing and logs no confirmation', r.status === 200 && (await rowsFor('tech_file.confirm', tf)).length === 0, String(r.status));
  const filled = { ...j.replication.aiAnalysis, flags: [], measurements: j.replication.aiAnalysis.measurements.map((m) => ({ ...m, m: m.m || '10' })) };
  const two = filled.checklist.filter((c) => c.value).slice(0, 2);
  r = await call('PUT', `/api/replications/${tf}`, ac, { ...j.replication, aiAnalysis: filled, confirmations: two.map((c) => ({ list: 'checklist', ref: c.key })) }); j = await r.json();
  await expectRows('tech file items confirmed by a person (one row for the save)', 'tech_file.confirm', tf, { actor: admA.id, role: 'admin', route: 'PUT /api/replications/[id]', after: { confirmed: two.map((c) => `checklist: ${c.label ?? c.key}`) } });
  r = await call('PUT', `/api/replications/${tf}`, ac, { ...j.replication, approve: true, confirmations: confirmAll(j.replication.aiAnalysis) }); j = await r.json();
  ok('tech file: approved', r.status === 200 && j.replication?.aiAnalysis?.review?.status === 'approved', j.error ?? '');
  const confirmRows = await rowsFor('tech_file.confirm', tf);
  ok('  the approving save confirmed the rest: exactly one more confirmation row (2 in all), naming only the newly confirmed items',
    confirmRows.length === 2 && !confirmRows[1].after.confirmed.some((x) => two.some((c) => x === `checklist: ${c.label ?? c.key}`)) && confirmRows[1].after.confirmed.length > 2, `${confirmRows.length} rows`);
  await expectRows('tech file approved', 'tech_file.approve', tf, { actor: admA.id, role: 'admin', route: 'PUT /api/replications/[id]', after: { review_status: 'approved', revision: j.replication?.aiAnalysis?.review?.revision } });
  const revs = (await (await call('GET', `/api/replications/${tf}/revisions`, ac)).json()).revisions ?? [];
  const seq = revs.find((x) => x.status === 'approved')?.seq;
  const f = new FormData(); f.append('file', new Blob([PDF], { type: 'application/pdf' }), 'zz-aud-approval.pdf'); f.append('approvedBy', 'ZZ AUD Buyer'); f.append('approvedOn', '2026-11-10'); f.append('note', 'ZZ AUD signed');
  r = await call('POST', `/api/replications/${tf}/revisions/${seq}/approvals`, ac, f); j = await r.json();
  await expectRows("customer's approval attached", 'tech_file.customer_approval_added', j.id, { actor: admA.id, role: 'admin', route: 'POST /api/replications/[id]/revisions/[seq]/approvals', after: { file_name: 'zz-aud-approval.pdf', approved_by_name: 'ZZ AUD Buyer' } });

  // =====================================================================================================================
  // 3. Rows cannot be edited or deleted, not even with the server's key.
  // =====================================================================================================================
  const one = (await rowsFor('order.stage_change', order.id))[0];
  const totalBefore = await countAll();
  const upd = await a.from('audit_log').update({ note: 'changed' }).eq('id', one.id);
  const del = await a.from('audit_log').delete().eq('id', one.id);
  const delAll = await a.from('audit_log').delete().gte('id', 0);
  const again = (await a.from('audit_log').select('*').eq('id', one.id).single()).data;
  ok('server key (service role): UPDATE is refused', !!upd.error, upd.error?.message ?? 'no error');
  ok('server key (service role): DELETE of one row, and of every row, is refused', !!del.error && !!delAll.error, `${del.error?.message ?? 'no error'} / ${delAll.error?.message ?? 'no error'}`);
  ok('  the row is unchanged and the row count is the same', same(again, one) && (await countAll()) === totalBefore);
  const forged = await a.from('audit_log').insert({ id: 1, actor_role: 'system', action: 'order.stage_change', record_table: 'orders', record_id: 'zz-aud-forged', route: 'TEST' });
  ok('server key: a forged id is refused (only new rows, numbered by the database)', !!forged.error);

  // The database hides secrets even when a caller sends them, and sets the time itself.
  const raw = await a.from('audit_log').insert({ actor_role: 'system', actor_email: `zz-aud-direct-${t}@yopmail.com`, action: 'order.stage_change', record_table: 'orders', record_id: `zz-aud-direct-${t}`, route: 'TEST direct insert',
    at: '2000-01-01T00:00:00Z', before: { password: 'zz-direct-pw', nested: { apiKey: 'zz-direct-key', code: '123456', key: 'parka' }, customer_code: 'C-9', template_key: 'jacket' },
    after: { link: 'https://x.example/join/zz-direct-token', session: 'zz-direct-session', status: 'Shipped' }, note: 'see https://x.example/cb?access_token=zz-direct-token' }).select('at, before, after, note').single();
  const d = raw.data;
  ok('database: secrets sent straight to the table are hidden (password, apiKey, code, link, session, a token in the note)', !!d && d.before.password === '[hidden]' && d.before.nested.apiKey === '[hidden]' && d.before.nested.code === '[hidden]'
    && d.after.link === '[hidden]' && d.after.session === '[hidden]' && d.note === '[hidden]' && !JSON.stringify(d).includes('zz-direct'), raw.error?.message ?? '');
  ok('database: key, customer_code, template_key and status stay; a forged time is replaced by now', d && d.before.nested.key === 'parka' && d.before.customer_code === 'C-9' && d.before.template_key === 'jacket' && d.after.status === 'Shipped' && Date.parse(d.at) > Date.now() - 10 * 60 * 1000);

  // =====================================================================================================================
  // 4. Customers and reps are refused.
  // =====================================================================================================================
  for (const [n, s] of [['customer', CU_.sb], ['rep', R_.sb], ['visitor (anon)', anon]]) {
    const sel = await s.from('audit_log').select('id').limit(1);
    const ins = await s.from('audit_log').insert({ actor_role: 'customer', action: 'order.stage_change', record_table: 'orders', record_id: 'zz-aud-x', route: 'x' });
    const u2 = await s.from('audit_log').update({ note: 'x' }).eq('id', one.id);
    const d2 = await s.from('audit_log').delete().eq('id', one.id);
    ok(`${n}: select, insert, update and delete on audit_log are all refused by the database`, [sel, ins, u2, d2].every((x) => !!x.error), [sel, ins, u2, d2].map((x) => x.error?.code ?? 'ok').join(','));
    const fns = await Promise.all([s.rpc('audit_redact', { j: {} }), s.rpc('audit_hidden_name', { name: 'x' }), s.rpc('audit_hidden_value', { v: 'x' })]);
    ok(`${n}: the audit functions cannot be called`, fns.every((x) => !!x.error), fns.map((x) => x.error?.code ?? 'ok').join(','));
  }
  for (const [n, c2] of [['customer', cc], ['rep', rc], ['password-only admin', apw], ['signed-out', null]]) {
    r = await call('GET', '/api/admin/audit-log', c2); ok(`${n}: the read route answers 401`, r.status === 401, String(r.status));
    r = await call('GET', '/admin/audit-log', c2); ok(`${n}: the Audit log page is not shown (sent away)`, r.status >= 300 && r.status < 400, String(r.status));
  }
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) { r = await call(m, '/api/admin/audit-log', ac, {}); if (r.status !== 405) ok(`the read route has no ${m}`, false, String(r.status)); }
  ok('the read route has only GET (POST, PUT, PATCH, DELETE answer 405)', true);
  r = await call('GET', '/admin/audit-log', ac); ok('a two-step admin opens the Audit log page', r.status === 200, String(r.status));
  j = await (await call('GET', `/api/admin/audit-log?action=order.stage_change&record=${order.id}`, ac)).json();
  ok('admin filters: by action and record: the one stage-change row', j.rows?.length === 1 && j.rows[0].record_id === order.id && j.total === 1);
  j = await (await call('GET', `/api/admin/audit-log?user=${encodeURIComponent(`zz-aud-a-${t}`)}`, ac)).json();
  const mine = j.total;
  ok('admin filters: by user (part of the email): only that admin\'s rows', mine > 30 && j.rows.every((x) => x.actor_email === admA.email), `${mine} rows`);
  j = await (await call('GET', `/api/admin/audit-log?user=${ru.id}&table=order_requests`, ac)).json();
  ok('admin filters: by user id and record type', j.total === 2 && j.rows.every((x) => x.actor_user_id === ru.id && x.record_table === 'order_requests'), String(j.total));
  j = await (await call('GET', `/api/admin/audit-log?user=${encodeURIComponent(admA.email)}&from=${encodeURIComponent('2000-01-01T00:00:00Z')}&to=${encodeURIComponent('2000-12-31T00:00:00Z')}`, ac)).json();
  const j2 = await (await call('GET', `/api/admin/audit-log?user=${encodeURIComponent(admA.email)}&from=${encodeURIComponent(started)}`, ac)).json();
  ok('admin filters: by date (a year with nothing, and since this run started)', j.total === 0 && j2.total === mine);
  r = await call('GET', '/api/admin/audit-log?action=drop.table', ac); ok('admin filters: an unknown action is refused', r.status === 400);

  // =====================================================================================================================
  // 5. No secret ever appears in a row.
  // =====================================================================================================================
  const ids = users.map((u) => u.id).filter(Boolean);
  const rows = [...((await a.from('audit_log').select('*').in('actor_user_id', ids).gte('at', started)).data ?? []), ...((await a.from('audit_log').select('*').like('actor_email', `zz-aud-%-${t}@yopmail.com`).is('actor_user_id', null)).data ?? [])];
  const leaks = [];
  const walk = (v, where) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (AU.isHiddenName(k) && x !== AU.HIDDEN) leaks.push(`${where}.${k}`); walk(x, `${where}.${k}`); }
  };
  for (const row of rows) { walk(row.before, `#${row.id}.before`); walk(row.after, `#${row.id}.after`); }
  ok(`no secret field: every field with a hidden name reads "[hidden]" (${rows.length} rows of this run)`, rows.length >= 40 && leaks.length === 0, leaks.slice(0, 5).join(', '));
  const used = [...new Set(secrets.filter((x) => typeof x === 'string' && x.length >= 8))];
  const found = rows.filter((row) => used.some((s) => JSON.stringify(row).includes(s)));
  ok(`no secret value: none of the ${used.length} secrets used in this run (invite tokens, passwords, temporary passwords, authenticator secrets, API keys, upload and session tokens) is in any row`, found.length === 0, found.map((x) => `#${x.id} ${x.action}`).join(', '));
  ok('no secret value: no row holds anything shaped like a JWT, a Supabase key or an authenticator link', !rows.some((row) => /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.|sb_(secret|publishable)_|otpauth:\/\//.test(JSON.stringify(row))));
  ok('the route is always a pattern: no row stores the invite token address', !rows.some((row) => row.route.includes(inv1.token)) && rows.filter((x) => x.action === 'rep_invite.accept').every((x) => x.route === 'POST /api/rep-invites/[token]'));
  console.log(`NOTE audit_log rows added by this run: ${(await countAll()) - total0}`);
} catch (e) {
  ok('the audit-log test ran to the end', false, e instanceof Error ? e.stack?.split('\n').slice(0, 3).join(' | ') : String(e));
} finally {
  for (const id of made.tfs) if (id) await deleteTestRequest(a, id);
  if (made.catalogs.length) await a.from('catalogs').delete().in('id', made.catalogs.filter(Boolean));
  if (made.catalogPaths.length) await a.storage.from('catalogs').remove(made.catalogPaths.filter(Boolean));
  if (made.specPaths.length) await a.storage.from('product-specs').remove(made.specPaths.filter(Boolean));
  if (made.docPaths.length) await a.storage.from('documents').remove(made.docPaths.filter(Boolean));
  if (cust) {
    await a.from('product_specs').delete().eq('customer_id', cust.id);
    await a.from('documents').delete().eq('customer_id', cust.id);
    await a.from('account_change_requests').delete().eq('customer_id', cust.id);
    await a.from('order_requests').delete().eq('customer_id', cust.id);
    const { data: os } = await a.from('orders').select('id').eq('customer_id', cust.id);
    const oids = (os ?? []).map((o) => o.id);
    if (oids.length) { await a.from('order_events').delete().in('order_id', oids); await a.from('order_items').delete().in('order_id', oids); await a.from('orders').delete().in('id', oids); }
    await a.from('customers').delete().eq('id', cust.id);
  }
  for (const k of made.types) if (k) await a.from('garment_types').delete().eq('key', k);
  for (const k of made.cats) if (k) await a.from('garment_categories').delete().eq('key', k);
  for (const k of made.templates) if (k) await a.rpc('delete_test_template', { p_key: k });
  await a.rpc('delete_test_catalog_changes');
  const { data: invReps } = await a.from('rep_invites').select('rep_id').in('email', made.inviteEmails);
  const repIds = [...made.reps, ...(invReps ?? []).map((x) => x.rep_id)].filter(Boolean);
  await a.from('rep_invites').delete().in('email', made.inviteEmails);
  if (repIds.length) { await a.from('rep_activity').delete().in('rep_id', repIds); await a.from('reps').delete().in('id', repIds); }
  await a.from('rep_signup_attempts').delete().gte('created_at', started);
  const uids = users.map((u) => u?.id).filter(Boolean);
  if (uids.length) await a.from('notifications').delete().in('recipient_user_id', uids);
  await a.from('notifications').delete().like('title', '%ZZ AUD%');
  await a.from('notifications').delete().like('body', '%ZZ AUD%');
  for (const id of uids) await a.auth.admin.deleteUser(id).catch(() => null);
  const { data: { users: all } } = await a.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const leftUsers = all.filter((u) => (u.email || '').startsWith('zz-aud-')).length;
  const leftCust = (await a.from('customers').select('id').like('company_name', 'ZZ AUD%')).data?.length ?? 0;
  const leftReps = (await a.from('reps').select('id').like('name', 'ZZ AUD%')).data?.length ?? 0;
  const leftReq = (await a.from('replications').select('id').like('client_name', 'ZZ AUD%')).data?.length ?? 0;
  ok('cleaned up: no zz-aud login, ZZ AUD customer, rep or tech file left (the audit rows stay, by design)', leftUsers + leftCust + leftReps + leftReq === 0, `${leftUsers} logins, ${leftCust} customers, ${leftReps} reps, ${leftReq} requests`);
}
