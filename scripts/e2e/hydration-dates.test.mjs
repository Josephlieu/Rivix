// Dates on pages the server draws first (2026-11-20, small-fixes): the server prints a date in Vancouver time, the browser in
// the viewer's own time zone. On a day where the two differ, React found different text when the page came alive and threw
// error #418 (hydration) on /rep/orders. This test opens the pages in headless Chrome with the viewer's time zone forced far
// from Vancouver (Pacific/Kiritimati, UTC+14), on an order made at 05:00 UTC (Nov 19 in Vancouver, Nov 20 for the viewer).
//   /rep/orders: no hydration error, and the order's date is the viewer's day (Nov 20, 2026). FAIL otherwise.
//   /rep/requests and /admin/requests (the requests board): no hydration error, and the request's date is the viewer's day.
//   /rep/customers and /admin/orders: no hydration error.
// Test project only ("ZZ HYD" data and zz- logins, deleted at the end). Requires the server on port 10001.
// Browser limits as page-requests.test.mjs: the installed Chrome, a throwaway profile, only localhost and the test project.
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
const VIEWER_TZ = 'Pacific/Kiritimati';
const MADE_AT = '2026-11-20T05:00:00.000Z'; // Nov 19 21:00 in Vancouver, Nov 20 19:00 for the viewer
const VIEWER_DAY = 'Nov 20, 2026', SERVER_DAY = 'Nov 19, 2026';
const HYDRATION = /Minified React error #418|#418|Hydration failed|hydrat/i;

if (!fs.existsSync(CHROME)) { ok('Google Chrome is installed (set CHROME_PATH otherwise)', false, CHROME); process.exit(0); }

const pw = 'Tmp-pass-9876!', t = Date.now();
const users = [];
let rep = null, cust = null, order = null, chrome = null, profile = null;
try {
  const mk = async (tag, meta) => { const u = (await a.auth.admin.createUser({ email: `zz-hyd-${tag}-${t}@yopmail.com`, password: pw, email_confirm: true, ...(meta ? { app_metadata: meta } : {}) })).data.user; users.push(u); return u; };
  const ru = await mk('r', { role: 'rep' }), au = await mk('a', { role: 'admin' }), cu = await mk('c');
  rep = (await a.from('reps').insert({ name: 'ZZ HYD Rep', email: ru.email, user_id: ru.id, active: true }).select('id').single()).data;
  cust = (await a.from('customers').insert({ user_id: cu.id, company_name: 'ZZ HYD Co', contact_email: cu.email, customer_code: '', rep_id: rep.id }).select('id').single()).data;
  order = (await a.from('orders').insert({ customer_id: cust.id, rep_id: rep.id, batch_number: '', product_name: 'ZZ HYD Parka', quantity: 2, created_at: MADE_AT }).select('id, batch_number, created_at').single()).data;
  await a.from('order_requests').insert({ customer_id: cust.id, kind: 'quote', items: [{ product_name: 'ZZ HYD Vest', sizes: [{ size: 'M', qty: 2 }] }], note: 'ZZ HYD', created_by: cu.id, created_at: MADE_AT });
  ok('test data: an order and a request made at 05:00 UTC (a different day in Vancouver and for the viewer)', !!order?.batch_number && new Date(order.created_at).toISOString() === MADE_AT);

  const jar = async (u) => { const j = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } }); const r = await sb.auth.signInWithPassword({ email: u.email, password: pw }); if (r.error) throw r.error; await stepUp(sb); return j; };
  const jars = { rep: await jar(ru), admin: await jar(au) };

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
  const send = (method, params = {}) => { const id = ++n; ws.send(JSON.stringify({ id, method, params })); return new Promise((yes) => wait.set(id, (m) => yes(m))); };
  const evalJs = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true }))?.result?.result?.value;
  let errors = [];
  on.push((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? m.params.exceptionDetails?.text ?? '');
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((x) => x.value ?? x.description ?? '').join(' ').slice(0, 200));
  });
  await send('Network.enable'); await send('Runtime.enable'); await send('Page.enable');
  const tz = await send('Emulation.setTimezoneOverride', { timezoneId: VIEWER_TZ });
  ok(`the browser's time zone is set to ${VIEWER_TZ}`, !tz.error && (await evalJs('Intl.DateTimeFormat().resolvedOptions().timeZone')) === VIEWER_TZ);

  const open = async (role, route) => {
    await send('Network.clearBrowserCookies');
    for (const [name, value] of jars[role]) await send('Network.setCookie', { name, value, domain: 'localhost', path: '/' });
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300);
    errors = [];
    await send('Page.navigate', { url: BASE + route });
    await sleep(4000);
    return { landed: await evalJs('location.pathname'), text: (await evalJs('document.body ? document.body.innerText : ""')) || '', hydration: errors.filter((e) => HYDRATION.test(e)) };
  };

  // The fix: /rep/orders.
  const ro = await open('rep', '/rep/orders');
  ok('/rep/orders opens for the rep', ro.landed === '/rep/orders' && ro.text.includes(order.batch_number), ro.landed);
  ok('/rep/orders: no React hydration error (#418) when the viewer\'s day differs from Vancouver\'s', ro.hydration.length === 0, ro.hydration.slice(0, 2).join(' | '));
  const row = ro.text.split('\n').find((l) => l.includes(order.batch_number)) || '';
  ok(`/rep/orders: the order's date is the viewer's day (${VIEWER_DAY}), not Vancouver's (${SERVER_DAY})`, row.includes(VIEWER_DAY) && !row.includes(SERVER_DAY), row.replace(/\s+/g, ' ').slice(0, 160));

  // The requests board (2026-11-20): the same fix, and the same checks.
  for (const [role, route] of [['rep', '/rep/requests'], ['admin', '/admin/requests']]) {
    const r = await open(role, route);
    ok(`${route} (${role}) opens and lists the request`, r.landed === route && r.text.includes('ZZ HYD Co'), r.landed);
    ok(`${route} (${role}): no React hydration error (#418) when the viewer's day differs from Vancouver's`, r.hydration.length === 0, r.hydration.slice(0, 2).join(' | '));
    const line = r.text.split('\n').find((l) => /Quote request · /.test(l)) || '';
    ok(`${route} (${role}): the request's date is the viewer's day (${VIEWER_DAY}), not Vancouver's`, line.includes(`Quote request · ${VIEWER_DAY}`) && !line.includes(SERVER_DAY), line.slice(0, 120));
  }
  // Other server-drawn pages with dates: no hydration error either.
  for (const [role, route] of [['rep', '/rep/customers'], ['admin', '/admin/orders']]) {
    const r = await open(role, route);
    ok(`${route} (${role}): opens with no React hydration error`, r.landed === route && r.hydration.length === 0, r.landed !== route ? `landed on ${r.landed}` : r.hydration.slice(0, 1).join(''));
  }
  ws.close();
} catch (err) {
  ok('the hydration test ran to the end', false, err instanceof Error ? err.message : String(err));
} finally {
  if (chrome) { chrome.kill('SIGTERM'); await sleep(1500); if (chrome.exitCode === null) chrome.kill('SIGKILL'); }
  if (profile) { for (let i = 0; i < 10; i++) { try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(500); } } }
  if (cust) { await a.from('order_requests').delete().eq('customer_id', cust.id); }
  if (order) { await a.from('order_events').delete().eq('order_id', order.id); await a.from('order_items').delete().eq('order_id', order.id); await a.from('orders').delete().eq('id', order.id); }
  if (cust) await a.from('customers').delete().eq('id', cust.id);
  if (rep) { await a.from('rep_activity').delete().eq('rep_id', rep.id); await a.from('reps').delete().eq('id', rep.id); }
  const ids = users.map((u) => u.id);
  if (ids.length) await a.from('notifications').delete().in('recipient_user_id', ids);
  for (const u of users) await a.auth.admin.deleteUser(u.id);
  const left = await Promise.all([a.from('customers').select('id').like('company_name', 'ZZ HYD%'), a.from('orders').select('id').like('product_name', 'ZZ HYD%')]);
  const l = left.reduce((s, r) => s + (r.data?.length ?? 0), 0);
  ok('cleaned up: no ZZ HYD customer or order left; profile deleted', l === 0 && (!profile || !fs.existsSync(profile)), `${l} left`);
}
