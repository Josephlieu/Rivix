// The request page in a real browser (2026-11-18): a never-scanned request made the page call
// GET /api/replications/<id>/revisions in an endless loop until Chrome ran out of resources. This test opens the request page
// in headless Chrome, clicks every tab, and counts the requests: any endpoint called more than a small set number of times
// fails, and so does any failed request, any page error, a wrong photo count, or a scan problem that is not shown on screen.
//
// Cases (DEV, "ZZ PRQ" data, deleted afterwards): never scanned with 1 photo (the case that was missed), never scanned with
// no photos, a scanned boot and a scanned jacket.
//
// Browser limits: the Chrome already installed (no package); a throwaway profile created for this run and deleted after it
// (in CHROME_PROFILE_ROOT when set, else the system temp folder); never the user's own profile, cookies or passwords (mock
// keychain); only localhost and the DEV Supabase host can be reached (every other host goes to a dead proxy and fails the
// test). The scan's AI call is answered by the test inside the browser with an error, so no AI request is ever made.
// Requires the server on port 10001 (production build) and .env.local pointing at DEV.
import { env as E2E_ENV } from './env.mjs'; // the test project only (guarded), never Development
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { stepUp } from './mfa.mjs';
import { deleteTestRequest } from './cleanup.mjs';

const require = createRequire(import.meta.url);
const { createServerClient } = require('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = process.env.E2E_BASE || 'http://localhost:10001'; // E2E_BASE: only to prove the test against another local build
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const env = E2E_ENV;
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEV_HOST = new URL(U).host;
const ALLOWED = new Set([new URL(BASE).host, DEV_HOST]);

// --- limits -------------------------------------------------------------------------------------------------------------------
const MAX_CALLS = 3;                 // any one endpoint, per page load plus every tab
const CHAT_EVERY_S = 5;              // the Team chat checks for new messages every 5 s on purpose (useReplicationChat.ts)
const LOAD_WAIT = 4000, TAB_WAIT = 2500;
const TABS = [['specs', 'specs'], ['ai_analysis', 'ai'], ['review', 'review'], ['tracking', 'shipping'], ['chat', 'chat'], ['specs', 'specs']];

if (!fs.existsSync(CHROME)) { ok('Google Chrome is installed (set CHROME_PATH otherwise)', false, CHROME); process.exit(0); }
if (typeof WebSocket !== 'function') { ok('this Node has a built-in WebSocket (Node 22+)', false, process.version); process.exit(0); }

// --- a tiny DevTools client (Node's own WebSocket) ----------------------------------------------------------------------------
class CDP {
  constructor(url) { this.ws = new WebSocket(url); this.n = 0; this.wait = new Map(); this.on = []; this.ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id) { const w = this.wait.get(m.id); this.wait.delete(m.id); if (w) (m.error ? w.no(new Error(m.error.message)) : w.yes(m.result)); } else this.on.forEach((f) => f(m)); }; }
  open() { return new Promise((yes, no) => { this.ws.onopen = yes; this.ws.onerror = no; }); }
  send(method, params = {}) { const id = ++this.n; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((yes, no) => this.wait.set(id, { yes, no })); }
  async eval(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.value; }
}

// --- DEV data -----------------------------------------------------------------------------------------------------------------
const a = createClient(U, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const call = (m, url, ck, body, form) => fetch(BASE + url, { method: m, headers: { ...(form ? {} : { 'Content-Type': 'application/json' }), ...(ck ? { Cookie: ck } : {}) }, body: body ? (form ? body : JSON.stringify(body)) : undefined, redirect: 'manual' });
const photo = () => { const f = new FormData(); f.append('photo', new Blob([PNG], { type: 'image/png' }), 'p.png'); return f; };

let adm = null, chrome = null, profile = null;
const ids = [];
try {
  adm = (await a.auth.admin.createUser({ email: `zz-prq-a-${t}@yopmail.com`, password: pw, email_confirm: true, app_metadata: { role: 'admin' } })).data.user;
  const jar = new Map();
  const sb = createServerClient(U, AK, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  await sb.auth.signInWithPassword({ email: adm.email, password: pw });
  await stepUp(sb); // the two-step sign-in, so the admin pages open
  const ck = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

  const make = async (name, type, photos, analysis) => {
    let r = await call('POST', '/api/replications', ck, { clientName: `ZZ PRQ ${name}`, productName: `ZZ PRQ ${name}`, garmentType: type });
    let j = await r.json(); const id = j.replication.id; ids.push(id);
    for (let i = 0; i < photos; i++) { r = await call('POST', `/api/replications/${id}/photos`, ck, photo(), true); j = await r.json(); }
    if (analysis) { r = await call('PUT', `/api/replications/${id}`, ck, { ...j.replication, aiAnalysis: { ...analysis, analyzedAt: new Date().toISOString() }, scan: true }); j = await r.json(); }
    // The product type confirmed by an admin (task 28), so "Run AI Scan" is allowed when there are photos.
    const row = (await a.from('replications').select('specs').eq('id', id).single()).data;
    await a.from('replications').update({ specs: { ...row.specs, typeCheck: { confirmedType: type, confirmedBy: adm.email, confirmedAt: new Date().toISOString() } } }).eq('id', id);
    return { id, code: j.replication.requestCode, photos, scanned: !!analysis, name };
  };
  const S = await import('../../src/lib/scan-template.ts');
  const C = await import('../../src/lib/template-catalog.ts');
  const D = await import('../../src/lib/garment-types-data.ts');
  const fake = { productIdentification: { mode: 'visual', brand: null, model: null, source: 'photos' }, garmentClass: 'ZZ', overallConfidence: 80, components: [], colorway: { bodyColor: 'navy', contrastColors: [], hardwareFinish: '' }, labelPlacements: [], washCare: { instructions: [] }, suggestions: {}, markings: [], fields: {}, flags: [] };
  const scanOf = async (k) => (await S.runTemplateScan({ template: C.resolveTemplate(k, null, C.BUILT_IN_CATALOG), typeKey: k, typeName: D.garmentTypeLabel(k), photoCount: 1, customerNotes: '', ask: async () => JSON.stringify(fake) })).analysis;
  const cases = [
    await make('never scanned, 1 photo', 'hi-vis-jacket', 1, null),
    await make('never scanned, no photo', 'jacket', 0, null),
    await make('scanned boot', 'safety-boots', 1, await scanOf('safety-boots')),
    await make('scanned jacket', 'jacket', 1, await scanOf('jacket')),
  ];
  ok('DEV: four ZZ PRQ requests made (2 never scanned)', cases.every((c) => c.code) && cases.filter((c) => !c.scanned).length === 2, cases.map((c) => c.code).join(', '));

  // --- headless Chrome, throwaway profile --------------------------------------------------------------------------------------
  const root = process.env.CHROME_PROFILE_ROOT || os.tmpdir();
  profile = fs.mkdtempSync(path.join(root, 'zz-chrome-profile-'));
  chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--use-mock-keychain', '--password-store=basic', '--disable-extensions', '--disable-sync', '--disable-background-networking',
    '--disable-component-update', '--disable-default-apps', '--disable-domain-reliability', '--disable-client-side-phishing-detection',
    '--no-pings', '--metrics-recording-only', '--disable-features=OptimizationHints,MediaRouter,Translate',
    // Only localhost and DEV Supabase: everything else goes to a proxy that does not exist (and fails the test below).
    '--proxy-server=http://127.0.0.1:9', `--proxy-bypass-list=localhost;127.0.0.1;${DEV_HOST}`,
    'about:blank',
  ], { stdio: 'ignore' });
  let port = null;
  for (let i = 0; i < 150 && !port; i++) { await sleep(100); try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { /* not yet */ } }
  ok('headless Chrome started with a throwaway profile', !!port, profile.startsWith(root) ? 'profile in the given folder' : '');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const cdp = new CDP(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await cdp.open();

  // What the page does: every request, every failure, every page error.
  let log = [], failed = [], errors = [];
  const reqUrl = new Map();
  cdp.on.push((m) => {
    if (m.method === 'Network.requestWillBeSent') { reqUrl.set(m.params.requestId, m.params.request.url); log.push({ url: m.params.request.url, method: m.params.request.method, type: m.params.type }); }
    if (m.method === 'Network.loadingFailed' && m.params.errorText !== 'net::ERR_ABORTED' && !m.params.canceled) failed.push(`${m.params.errorText} ${reqUrl.get(m.params.requestId) ?? ''}`);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? m.params.exceptionDetails?.text);
  });
  // The scan's AI call is answered here with an error (nothing reaches the server or the AI).
  cdp.on.push((m) => { if (m.method === 'Fetch.requestPaused') cdp.send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 500, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ error: 'ZZ test: the AI service is unavailable.' })).toString('base64') }); });
  await cdp.send('Network.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/analyze-garment*', requestStage: 'Request' }] });
  for (const c of jar.keys()) await cdp.send('Network.setCookie', { name: c, value: jar.get(c), domain: 'localhost', path: '/' });

  const norm = (u) => { try { const x = new URL(u); return `${x.host}${x.pathname}`.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id').replace(/RQ-\d+/g, ':code'); } catch { return u; } };
  const counted = (e) => !/^(data|blob|about|chrome):/.test(e.url) && !new URL(e.url).pathname.startsWith('/_next/static/');
  const text = () => cdp.eval('document.body.innerText');
  const tabButtons = `[...document.querySelectorAll('div.flex.border-b.border-slate-100.overflow-x-auto > button')]`;

  for (const c of cases) {
    // A blank page first, so nothing still running from the previous request is counted for this one.
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(1000);
    log = []; failed = []; errors = [];
    const started = Date.now();
    await cdp.send('Page.navigate', { url: `${BASE}/admin/replication/${c.code}` });
    await sleep(LOAD_WAIT);
    const landed = await cdp.eval('location.pathname');
    ok(`${c.name}: the request page opens (signed in, two-step done)`, landed === `/admin/replication/${c.code}`, landed);
    for (const [, q] of TABS) {
      const n = await cdp.eval(`(() => { const b = ${tabButtons}; const i = ${JSON.stringify(TABS.map((x) => x[1]))}.indexOf('${q}'); b[i]?.click(); return b.length; })()`);
      await sleep(TAB_WAIT);
      const tab = await cdp.eval(`new URLSearchParams(location.search).get('tab')`);
      if (n !== 5 || tab !== q) ok(`${c.name}: tab "${q}" opened`, false, `${n} tab buttons, now on ${tab}`);
    }
    // Photos and the scan, checked on screen.
    await cdp.eval(`${tabButtons}[0].click()`); await sleep(800);
    ok(`${c.name}: the page shows ${c.photos} of 12 photos`, (await text()).includes(`${c.photos} of 12 photos`));
    await cdp.eval(`${tabButtons}[1].click()`); await sleep(800);
    const aiText = await text();
    if (c.photos === 0) {
      const disabled = await cdp.eval(`[...document.querySelectorAll('button')].find(b => /Run AI Scan/i.test(b.textContent))?.disabled`);
      ok(`${c.name}: AI tab says to add photos first, and "Run AI Scan" is disabled`, aiText.includes('Add photos first') && disabled === true, String(disabled));
    }
    if (!c.scanned && c.photos > 0) {
      await cdp.eval(`[...document.querySelectorAll('button')].find(b => /Run AI Scan/i.test(b.textContent))?.click()`);
      await sleep(3000);
      const after = await text();
      ok(`${c.name}: a failed scan shows its reason on the AI tab, next to the scan button`, after.includes('The scan did not work.') && after.includes('ZZ test: the AI service is unavailable.'), after.includes('The scan did not work.') ? '' : 'not shown');
    }
    const seconds = (Date.now() - started) / 1000;
    // Count.
    const counts = new Map();
    for (const e of log.filter(counted)) { const k = `${e.method} ${norm(e.url)}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
    const limitOf = (k) => (/\/messages$/.test(k) && k.startsWith('GET') ? Math.floor(seconds / CHAT_EVERY_S) + 2 : MAX_CALLS);
    const over = [...counts].filter(([k, n]) => n > limitOf(k));
    const top = [...counts].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, n]) => `${n}× ${k.replace(DEV_HOST, 'dev')}`).join('; ');
    ok(`${c.name}: no endpoint called more than ${MAX_CALLS} times (chat: once per ${CHAT_EVERY_S} s) over ${Math.round(seconds)} s and ${TABS.length} tab clicks`, over.length === 0, over.length ? over.map(([k, n]) => `${n}× ${k}`).join('; ') : top);
    ok(`${c.name}: the revision history is loaded at most ${MAX_CALLS} times`, (counts.get(`GET ${new URL(BASE).host}/api/replications/:id/revisions`) ?? 0) <= MAX_CALLS, String(counts.get(`GET ${new URL(BASE).host}/api/replications/:id/revisions`) ?? 0));
    const outside = log.filter((e) => /^https?:/.test(e.url) && !ALLOWED.has(new URL(e.url).host)).map((e) => e.url);
    ok(`${c.name}: only localhost and DEV Supabase were contacted`, outside.length === 0, outside.slice(0, 3).join(' '));
    ok(`${c.name}: no request failed (no ERR_INSUFFICIENT_RESOURCES)`, failed.length === 0, failed.slice(0, 3).join(' | '));
    ok(`${c.name}: no error on the page`, errors.length === 0, errors.slice(0, 2).join(' | '));
  }
  cdp.ws.close();
} catch (err) {
  ok('the page test ran to the end', false, err instanceof Error ? err.message : String(err));
} finally {
  if (chrome) { chrome.kill('SIGTERM'); await sleep(1500); if (chrome.exitCode === null) chrome.kill('SIGKILL'); }
  if (profile) { for (let i = 0; i < 10; i++) { try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(500); } } }
  ok('the throwaway Chrome profile was deleted', !profile || !fs.existsSync(profile));
  for (const id of ids) await deleteTestRequest(a, id);
  if (adm) await a.auth.admin.deleteUser(adm.id);
  const { data: left } = await a.from('replications').select('id').like('client_name', 'ZZ PRQ%');
  console.log('cleaned; leftover ZZ PRQ requests:', left?.length ?? 0);
}
