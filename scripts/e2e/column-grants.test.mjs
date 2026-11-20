// H2/H3 (2026-11-20): what a signed-in customer, a signed-in rep and a visitor (anon) may do in the database, through the
// API exactly as the browser can (publishable key + their own session), after 90-harden-grants.sql.
//   - the allowed columns of the 10 readable tables read fine (and the customer's own rows come back);
//   - every other column of those tables is refused with a permission error, and so is select('*');
//   - the other 19 public tables (including account_change_requests, order_requests, templates, template_versions, audit_log)
//     are refused completely;
//   - no insert, update or delete on any of the 29 tables;
//   - no function can be called through rpc except the two policy helpers (revoke_user_sessions and the rest refused);
//   - anon gets nothing at all;
//   - every portal, rep and admin page loads in headless Chrome with no refused database call and no page error, and
//     the three file routes that read with the user's own session still work.
// Test project only ("ZZ CGR" data and zz- logins, deleted at the end). Requires the server on port 10001.
import { env as E2E_ENV } from './env.mjs'; // the test project only (guarded), never Development
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { stepUp } from './mfa.mjs';

const require = createRequire(import.meta.url);
const { createServerClient } = require('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = process.env.E2E_BASE || 'http://localhost:10001';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const env = E2E_ENV;
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SB_HOST = new URL(U).host;
const a = createClient(U, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// --- the plan (the same lists as 90-harden-grants.sql) -----------------------------------------------------------------------
const ALLOWED = {
  customers: ['id', 'user_id', 'customer_code', 'company_name', 'contact_email', 'rep_id'],
  orders: ['id', 'customer_id', 'batch_number', 'product_name', 'quantity', 'material', 'origin', 'order_date', 'ship_date', 'status', 'certs_generated', 'safety_standard', 'po_number', 'delivery_location', 'carrier', 'tracking_number', 'created_at'],
  order_items: ['id', 'order_id', 'product_name', 'quantity', 'sizing', 'branding', 'position', 'size_breakdown', 'fabric', 'safety_standard'],
  order_events: ['id', 'order_id', 'status', 'note', 'customer_visible', 'created_at'],
  documents: ['id', 'customer_id', 'order_id', 'title', 'doc_type', 'file_path', 'file_name', 'file_size', 'mime_type', 'expires_on', 'created_at'],
  document_requests: ['id', 'order_id', 'customer_id', 'doc_type', 'note', 'status', 'requested_by', 'created_at'],
  product_specs: ['id', 'customer_id', 'product_name', 'safety_standard', 'fabric', 'description', 'file_url', 'file_label', 'created_at'],
  reps: ['id', 'user_id', 'name', 'title', 'email', 'phone'],
  catalogs: ['id', 'title', 'description', 'file_path', 'file_name', 'file_size', 'mime_type', 'created_at', 'updated_at'],
  notifications: ['id', 'recipient_user_id', 'kind', 'title', 'body', 'link', 'read_at', 'created_at'],
};
// Every column of those 10 tables (read from the schema on 2026-11-20); the ones not allowed must be refused.
const ALL = {
  customers: ['id', 'user_id', 'customer_code', 'company_name', 'contact_email', 'created_at', 'rep_id', 'contact_phone', 'updated_at', 'contact_name', 'billing_address', 'shipping_address'],
  orders: ['id', 'customer_id', 'batch_number', 'product_name', 'quantity', 'material', 'origin', 'order_date', 'ship_date', 'status', 'certs_generated', 'safety_standard', 'inspector_name', 'created_at', 'rep_id', 'delivery_location', 'po_number', 'pricing', 'special_requirements', 'carrier', 'tracking_number', 'updated_at'],
  order_items: ['id', 'order_id', 'product_name', 'quantity', 'sizing', 'branding', 'position', 'created_at', 'size_breakdown', 'fabric', 'safety_standard'],
  order_events: ['id', 'order_id', 'status', 'note', 'customer_visible', 'created_by', 'created_at'],
  documents: ['id', 'customer_id', 'order_id', 'title', 'doc_type', 'file_path', 'file_name', 'file_size', 'mime_type', 'uploaded_by', 'created_at', 'updated_at', 'expires_on'],
  document_requests: ['id', 'order_id', 'customer_id', 'rep_id', 'doc_type', 'note', 'status', 'created_at', 'done_at', 'done_by', 'requested_by', 'updated_at'],
  product_specs: ['id', 'customer_id', 'product_name', 'safety_standard', 'fabric', 'description', 'file_url', 'file_label', 'created_at'],
  reps: ['id', 'user_id', 'name', 'title', 'email', 'phone', 'active', 'created_at', 'rep_code', 'territory', 'updated_at'],
  catalogs: ['id', 'title', 'description', 'file_path', 'file_name', 'file_size', 'mime_type', 'uploaded_by', 'created_at', 'updated_at'],
  notifications: ['id', 'recipient_user_id', 'kind', 'title', 'body', 'link', 'order_id', 'read_at', 'created_at'],
};
// The other 19 tables, each with one of its columns (no right at all, so any column is refused).
// 2026-11-21 (approved): audit_log added (29 tables); customers and reps have no rights on it at all.
const CLOSED = {
  account_change_requests: 'id', order_requests: 'id', templates: 'key', template_versions: 'template_key', catalog_changes: 'id',
  garment_categories: 'key', garment_types: 'key', hiring_candidates: 'id', hiring_settings: 'id', link_reads: 'id', rep_activity: 'id',
  rep_invites: 'id', rep_signup_attempts: 'id', replication_customer_approvals: 'id', replication_downloads: 'id',
  replication_messages: 'id', replication_revisions: 'id', replications: 'id', audit_log: 'id',
};
const TABLES = { ...Object.fromEntries(Object.entries(ALLOWED).map(([t, c]) => [t, c[0]])), ...CLOSED };
// Functions nobody but the service role may call (rpc arguments are only there so PostgREST finds the function).
const CLOSED_FUNCTIONS = [
  ['revoke_user_sessions', { target: '00000000-0000-0000-0000-000000000000' }],
  ['create_template', { p_key: 'zz-cgr', p_kind: 'type', p_label: 'ZZ', p_description: 'ZZ', p_body: {}, p_created_by: 'zz', p_note: 'zz' }],
  ['delete_test_replication', { p_id: 'zz-none' }], ['delete_test_template', { p_key: 'zz-none' }], ['delete_test_catalog_changes', {}],
  ['generate_customer_code', {}], ['generate_order_code', {}], ['generate_rep_code', {}], ['generate_replication_code', {}],
  ['log_order_status', {}], ['set_updated_at', {}], ['rls_auto_enable', {}], ['replications_delete_guard', {}],
];
ok('the test\'s column lists match the plan (10 tables; every allowed column is a real column)', Object.keys(ALLOWED).every((t) => ALLOWED[t].every((c) => ALL[t].includes(c))) && Object.keys(TABLES).length === 29);

// A refusal from the database's rights: 42501 "permission denied for ...". Row security's own refusal ("new row violates
// row-level security policy", also 42501) does NOT count: this test is about the rights. For rpc, PostgREST may also say
// the function is not callable at all (PGRST202), which is also a refusal.
const denied = (r) => !!r.error && r.error.code === '42501' && /permission denied/i.test(r.error.message);
// Many independent API calls, 8 at a time (the suite gives each file 5 minutes).
const pool = async (items, fn, size = 8) => { const out = []; for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn))); return out; };
const rpcRefused = (r) => !!r.error && (denied(r) || r.error.code === 'PGRST202');
const code = (r) => (r.error ? `${r.error.code}` : 'no error');

const pw = 'Tmp-pass-9876!', t = Date.now();
const made = { users: [], orders: [], customers: [], reps: [], specs: [], catalogs: [], files: [] };
const PDF = Buffer.from('%PDF-1.4\n%ZZ CGR test file\n%%EOF\n');
const signIn = async (email) => {
  const c = createClient(U, AK, { auth: { persistSession: false, autoRefreshToken: false } });
  const r = await c.auth.signInWithPassword({ email, password: pw });
  if (r.error) throw new Error(`sign-in: ${r.error.message}`);
  return c;
};
const cookieJar = async (email) => {
  const jar = new Map();
  const sb = createServerClient(U, AK, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const r = await sb.auth.signInWithPassword({ email, password: pw });
  if (r.error) throw new Error(`sign-in: ${r.error.message}`);
  await stepUp(sb); // admins only: the two-step sign-in
  return jar;
};

// The database checks for one role (client = their API session, or a session-less client for anon).
async function checkRole(who, c, { ownRows = {}, mustBeAbleToCallHelpers }) {
  // 1. Allowed columns read fine; own rows come back where the policy gives them.
  const readable = [], refusedAllowed = [];
  const reads = await pool(Object.entries(ALLOWED), async ([tbl, cols]) => [tbl, await c.from(tbl).select(cols.join(', '))]);
  for (const [tbl, r] of reads) {
    if (r.error) refusedAllowed.push(`${tbl} (${code(r)})`);
    else readable.push(tbl);
    if (ownRows[tbl] && !r.error) ok(`${who}: ${tbl} returns their own row(s) with the allowed columns`, (r.data?.length ?? 0) >= ownRows[tbl], `${r.data?.length} rows`);
  }
  if (who === 'anon') ok('anon: none of the 10 tables can be read, not even the allowed columns', readable.length === 0, readable.join(', '));
  else ok(`${who}: the allowed columns of all 10 tables can be read`, refusedAllowed.length === 0, refusedAllowed.join('; '));

  // 2. Every other column of those 10 tables, one by one, and select('*'): refused.
  const hidden = Object.entries(ALL).flatMap(([tbl, cols]) => cols.filter((col) => who === 'anon' || !ALLOWED[tbl].includes(col)).map((col) => [tbl, col]));
  const leaked = (await pool(hidden, async ([tbl, col]) => { const r = await c.from(tbl).select(col).limit(1); return denied(r) ? null : `${tbl}.${col} (${code(r)})`; })).filter(Boolean);
  ok(`${who}: every staff-only or unused column is refused with a permission error (${hidden.length} columns, incl. orders.pricing, special_requirements, inspector_name, reps.territory)`, leaked.length === 0, leaked.slice(0, 8).join('; '));
  // select('*') is refused wherever a column is hidden: 9 of the 10 tables (every product_specs column is allowed, so
  // there '*' means exactly the allowed columns and must work, except for anon).
  const withHidden = Object.keys(ALLOWED).filter((tbl) => who === 'anon' || ALL[tbl].length > ALLOWED[tbl].length);
  const star = (await pool(withHidden, async (tbl) => { const r = await c.from(tbl).select('*').limit(1); return denied(r) ? null : `${tbl} (${code(r)})`; })).filter(Boolean);
  ok(`${who}: select('*') is refused on the ${withHidden.length} tables with a hidden column`, star.length === 0 && withHidden.length === (who === 'anon' ? 10 : 9), star.join('; '));
  if (who !== 'anon') { const ps = await c.from('product_specs').select('*').limit(1); ok(`${who}: select('*') on product_specs (no hidden column) works`, !ps.error, code(ps)); }

  // 3. The other 19 tables: refused.
  const open = (await pool(Object.entries(CLOSED), async ([tbl, col]) => { const r = await c.from(tbl).select(col).limit(1); return denied(r) ? null : `${tbl} (${code(r)})`; })).filter(Boolean);
  ok(`${who}: the 19 other tables are refused (incl. account_change_requests, order_requests, templates, template_versions, audit_log)`, open.length === 0, open.join('; '));

  // 4. Writes on all 29 tables: refused (insert, update, delete). The values never reach a row: the right is checked first.
  // (Each filter matches no row: the first column is never empty. A write that got through would change nothing.)
  // rep_signup_attempts.id is "generated always": writing it is refused before rights are checked, so use ip_hash there.
  // audit_log.id too (2026-11-21): use note there.
  const WRITE_COL = { ...TABLES, rep_signup_attempts: 'ip_hash', audit_log: 'note' };
  const attempts = Object.entries(WRITE_COL).flatMap(([tbl, col]) => [
    ['insert', tbl, () => c.from(tbl).insert({ [col]: null })],
    ['update', tbl, () => c.from(tbl).update({ [col]: null }).is(col, null)],
    ['delete', tbl, () => c.from(tbl).delete().is(col, null)],
  ]);
  const writes = (await pool(attempts, async ([k, tbl, run]) => { const r = await run(); return denied(r) ? null : `${k} ${tbl} (${code(r)})`; })).filter(Boolean);
  ok(`${who}: insert, update and delete are refused on all 29 tables`, writes.length === 0, writes.slice(0, 8).join('; '));

  // 5. Functions through rpc.
  const called = (await pool(CLOSED_FUNCTIONS, async ([fn, args]) => { const r = await c.rpc(fn, args); return rpcRefused(r) ? null : `${fn} (${code(r)})`; })).filter(Boolean);
  ok(`${who}: revoke_user_sessions and every other non-helper function are refused through rpc (${CLOSED_FUNCTIONS.length} functions)`, called.length === 0, called.join('; '));
  const rus = await c.rpc('revoke_user_sessions', { target: '00000000-0000-0000-0000-000000000000' });
  ok(`${who}: revoke_user_sessions in particular is refused`, rpcRefused(rus), code(rus));
  const h1 = await c.rpc('is_admin_or_active_rep'), h2 = await c.rpc('is_my_rep_customer', { p_customer_id: '00000000-0000-0000-0000-000000000000' });
  if (mustBeAbleToCallHelpers) ok(`${who}: the two policy helpers can still be called`, !h1.error && !h2.error, `${code(h1)} / ${code(h2)}`);
  else ok(`${who}: the two policy helpers cannot be called`, rpcRefused(h1) && rpcRefused(h2), `${code(h1)} / ${code(h2)}`);
}

let chrome = null, profile = null;
try {
  // --- ZZ CGR data (service role) ------------------------------------------------------------------------------------------
  const mk = async (tag, meta) => { const u = (await a.auth.admin.createUser({ email: `zz-cgr-${tag}-${t}@yopmail.com`, password: pw, email_confirm: true, ...(meta ? { app_metadata: meta } : {}) })).data.user; made.users.push(u); return u; };
  const cu = await mk('c'), ru = await mk('r', { role: 'rep' }), au = await mk('a', { role: 'admin' });
  const rep = (await a.from('reps').insert({ name: 'ZZ CGR Rep', email: ru.email, user_id: ru.id, active: true, territory: 'ZZ secret territory' }).select('id').single()).data; made.reps.push(rep.id);
  const cust = (await a.from('customers').insert({ user_id: cu.id, company_name: 'ZZ CGR Co', contact_email: cu.email, customer_code: '', rep_id: rep.id }).select('id').single()).data; made.customers.push(cust.id);
  const order = (await a.from('orders').insert({ customer_id: cust.id, rep_id: rep.id, batch_number: '', product_name: 'ZZ CGR Parka', quantity: 3, pricing: 'ZZ staff pricing', special_requirements: 'ZZ staff note', inspector_name: 'ZZ Inspector' }).select('id, batch_number').single()).data; made.orders.push(order.id);
  await a.from('order_items').insert({ order_id: order.id, product_name: 'ZZ CGR Parka', quantity: 3, position: 0 });
  await a.from('order_events').insert({ order_id: order.id, status: 'In Production', note: 'ZZ CGR visible note', customer_visible: true, created_by: 'zz-staff@example.com' });
  const docPath = `zz-cgr/${t}.pdf`, specPath = `zz-cgr/${t}.pdf`, catPath = `zz-cgr/${t}.pdf`;
  for (const [bucket, p] of [['documents', docPath], ['product-specs', specPath], ['catalogs', catPath]]) {
    const up = await a.storage.from(bucket).upload(p, PDF, { contentType: 'application/pdf', upsert: true });
    if (!up.error) made.files.push([bucket, p]);
  }
  const doc = (await a.from('documents').insert({ customer_id: cust.id, order_id: order.id, title: 'ZZ CGR Certificate', doc_type: 'Other', file_path: docPath, file_name: 'zz.pdf', file_size: PDF.length, mime_type: 'application/pdf', uploaded_by: 'zz-staff@example.com' }).select('id').single()).data;
  await a.from('document_requests').insert({ order_id: order.id, customer_id: cust.id, rep_id: rep.id, doc_type: 'Other', note: 'ZZ CGR request', requested_by: 'customer', status: 'open' });
  const spec = (await a.from('product_specs').insert({ customer_id: cust.id, product_name: 'ZZ CGR Spec', file_url: specPath, file_label: 'zz.pdf' }).select('id').single()).data; made.specs.push(spec.id);
  const cat = (await a.from('catalogs').insert({ title: 'ZZ CGR Catalog', file_path: catPath, file_name: 'zz.pdf', file_size: PDF.length, mime_type: 'application/pdf', uploaded_by: 'zz-staff@example.com' }).select('id').single()).data; made.catalogs.push(cat.id);
  await a.from('notifications').insert({ recipient_user_id: cu.id, kind: 'order_status', title: 'ZZ CGR notification', body: 'ZZ', link: '/portal/orders' });
  ok('test data made (customer with rep, order with staff-only values, item, event, document, request, spec, catalog, notification, 3 files)', !!order?.batch_number && !!doc?.id && !!spec?.id && !!cat?.id && made.files.length === 3, made.files.length + ' files');

  // --- the database, role by role ------------------------------------------------------------------------------------------
  await checkRole('customer', await signIn(cu.email), {
    ownRows: { customers: 1, orders: 1, order_items: 1, order_events: 1, documents: 1, document_requests: 1, product_specs: 1, reps: 1, catalogs: 1, notifications: 1 },
    mustBeAbleToCallHelpers: true,
  });
  // The customer's own reads through the embeds the app uses.
  const cc = await signIn(cu.email);
  const repEmbed = await cc.from('customers').select('rep:reps(name, title, email, phone)').eq('user_id', cu.id).maybeSingle();
  ok('customer: their rep through the embed rep:reps(name, title, email, phone)', !repEmbed.error && repEmbed.data?.rep?.name === 'ZZ CGR Rep', code(repEmbed));
  const terr = await cc.from('customers').select('rep:reps(name, territory)').eq('user_id', cu.id).maybeSingle();
  ok('customer: reps.territory through the embed is refused', denied(terr), code(terr));
  await checkRole('rep', await signIn(ru.email), { ownRows: { catalogs: 1 }, mustBeAbleToCallHelpers: true });
  await checkRole('anon', createClient(U, AK, { auth: { persistSession: false } }), { mustBeAbleToCallHelpers: false });

  // --- the three file routes that read with the user's own session -----------------------------------------------------------
  const jars = { customer: await cookieJar(cu.email), rep: await cookieJar(ru.email), admin: await cookieJar(au.email) };
  const ck = (j) => [...j].map(([k, v]) => `${k}=${v}`).join('; ');
  for (const [name, url] of [['document', `/api/documents/${doc.id}/file`], ['product spec', `/api/portal/product-specs/${spec.id}/file`], ['catalog', `/api/catalogs/${cat.id}/file`]]) {
    const r = await fetch(BASE + url, { headers: { Cookie: ck(jars.customer) } });
    const j = await r.json().catch(() => ({}));
    ok(`customer: the ${name} file route still gives a download link (reads the row with the customer's session)`, r.status === 200 && typeof j.url === 'string', String(r.status));
  }

  // --- every page in headless Chrome ------------------------------------------------------------------------------------------
  if (!fs.existsSync(CHROME) || typeof WebSocket !== 'function') ok('headless Chrome and a built-in WebSocket are available', false);
  else {
    const root = process.env.CHROME_PROFILE_ROOT || os.tmpdir();
    profile = fs.mkdtempSync(path.join(root, 'zz-chrome-profile-'));
    chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
      '--use-mock-keychain', '--password-store=basic', '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update',
      '--disable-default-apps', '--disable-domain-reliability', '--no-pings', '--disable-features=OptimizationHints,MediaRouter,Translate',
      '--proxy-server=http://127.0.0.1:9', `--proxy-bypass-list=localhost;127.0.0.1;${SB_HOST}`, 'about:blank'], { stdio: 'ignore' });
    let port = null;
    for (let i = 0; i < 150 && !port; i++) { await sleep(100); try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { /* not yet */ } }
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
    let n = 0; const wait = new Map(); const on = [];
    ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id) { const w = wait.get(m.id); wait.delete(m.id); w?.(m); } else on.forEach((f) => f(m)); };
    await new Promise((yes, no) => { ws.onopen = yes; ws.onerror = no; });
    const send = (method, params = {}) => { const id = ++n; ws.send(JSON.stringify({ id, method, params })); return new Promise((yes) => wait.set(id, (m) => yes(m.result))); };
    const evalJs = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true }))?.result?.value;
    // bad: anything that points at a refused right (fails). other: page errors with nothing to do with rights (printed as
    // NOTE lines, not counted: e.g. an existing React hydration warning on /rep/orders, reported separately).
    let bad = [], other = [], docStatus = null;
    on.push((m) => {
      if (m.method === 'Network.responseReceived') {
        const { url, status } = m.params.response;
        if (m.params.type === 'Document') docStatus = status;
        if (url.includes(SB_HOST) && url.includes('/rest/v1/') && status >= 400) bad.push(`${status} ${new URL(url).pathname}`);
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const msg = m.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? m.params.exceptionDetails?.text ?? '';
        (/permission denied|42501|not authori[sz]ed|forbidden/i.test(msg) ? bad : other).push(`page error: ${msg.slice(0, 120)}`);
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const msg = m.params.args.map((x) => x.value ?? x.description ?? '').join(' ');
        if (/permission denied|42501/i.test(msg)) bad.push(`console: ${msg.slice(0, 120)}`);
      }
    });
    await send('Network.enable'); await send('Runtime.enable'); await send('Page.enable');
    const ROUTES = {
      customer: [['/portal', 'ZZ CGR Co'], ['/portal/orders', order.batch_number], [`/portal/orders/${order.batch_number}`, 'ZZ CGR visible note'], ['/portal/certificates', 'ZZ CGR Certificate'],
        ['/portal/products', 'ZZ CGR Spec'], ['/portal/catalogs', 'ZZ CGR Catalog'], ['/portal/notifications', 'ZZ CGR notification'], ['/portal/requests', null], ['/portal/account', null]],
      rep: [['/rep', null], ['/rep/customers', 'ZZ CGR Co'], ['/rep/orders', order.batch_number], ['/rep/orders/new', null], ['/rep/catalogs', 'ZZ CGR Catalog'], ['/rep/notifications', null],
        ['/rep/requests', null], ['/rep/replication', null], ['/rep/account', null]],
      admin: [['/admin', null], ['/admin/orders', order.batch_number], ['/admin/orders/new', null], ['/admin/clients', 'ZZ CGR Co'], ['/admin/catalogs', 'ZZ CGR Catalog'], ['/admin/products', null],
        ['/admin/requests', null], ['/admin/team', null], ['/admin/notifications', null], ['/admin/import', null], ['/admin/hiring', null], ['/admin/replication', null],
        ['/admin/replication/templates', null], ['/admin/replication/garment-types', null]],
    };
    for (const [role, routes] of Object.entries(ROUTES)) {
      await send('Network.clearBrowserCookies');
      for (const [name, value] of jars[role]) await send('Network.setCookie', { name, value, domain: 'localhost', path: '/' });
      const problems = [];
      for (const [route, mustShow] of routes) {
        await send('Page.navigate', { url: 'about:blank' }); await sleep(300);
        bad = []; other = []; docStatus = null;
        await send('Page.navigate', { url: BASE + route });
        await sleep(3500);
        const landed = await evalJs('location.pathname');
        const text = (await evalJs('document.body ? document.body.innerText : ""')) || '';
        const why = [];
        if (landed !== route) why.push(`landed on ${landed}`);
        if (docStatus !== 200) why.push(`page status ${docStatus}`);
        if (/Application error|permission denied/i.test(text)) why.push('error text on the page');
        if (mustShow && !text.includes(mustShow)) why.push('expected test data not shown');
        if (bad.length) why.push(bad.slice(0, 3).join(' | '));
        if (why.length) problems.push(`${route}: ${why.join('; ')}`);
        for (const o of other) console.log(`NOTE ${role} ${route}: ${o} (not a rights problem; not counted)`);
      }
      ok(`${role}: all ${routes.length} pages load with no refused database call or permission error, and show the test data`, problems.length === 0, problems.slice(0, 4).join(' || '));
    }
    ws.close();
  }
} catch (err) {
  ok('the column-rights test ran to the end', false, err instanceof Error ? err.message : String(err));
} finally {
  if (chrome) { chrome.kill('SIGTERM'); await sleep(1500); if (chrome.exitCode === null) chrome.kill('SIGKILL'); }
  if (profile) { for (let i = 0; i < 10; i++) { try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(500); } } }
  for (const [bucket, p] of made.files) await a.storage.from(bucket).remove([p]);
  const uid = made.users.map((u) => u.id);
  if (uid.length) await a.from('notifications').delete().in('recipient_user_id', uid);
  for (const id of made.orders) {
    await a.from('document_requests').delete().eq('order_id', id);
    await a.from('documents').delete().eq('order_id', id);
    await a.from('order_events').delete().eq('order_id', id);
    await a.from('order_items').delete().eq('order_id', id);
    await a.from('orders').delete().eq('id', id);
  }
  for (const id of made.specs) await a.from('product_specs').delete().eq('id', id);
  for (const id of made.catalogs) await a.from('catalogs').delete().eq('id', id);
  for (const id of made.customers) await a.from('customers').delete().eq('id', id);
  for (const id of made.reps) { await a.from('rep_activity').delete().eq('rep_id', id); await a.from('reps').delete().eq('id', id); }
  for (const u of made.users) await a.auth.admin.deleteUser(u.id);
  const left = await Promise.all([a.from('customers').select('id').like('company_name', 'ZZ CGR%'), a.from('orders').select('id').like('product_name', 'ZZ CGR%'), a.from('catalogs').select('id').like('title', 'ZZ CGR%')]);
  const l = left.reduce((s, r) => s + (r.data?.length ?? 0), 0);
  ok('cleaned up: no ZZ CGR customer, order or catalog left; profile deleted', l === 0 && (!profile || !fs.existsSync(profile)), `${l} left`);
}
