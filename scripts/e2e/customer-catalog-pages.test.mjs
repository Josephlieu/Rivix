// The customer catalogue pages in a real browser (2026-11-26). Opens every new page as a customer, a rep and a two-step admin
// in headless Chrome and fails on: a page error, a console error (hydration included), a failed request, an API call
// refused (4xx/5xx), a JavaScript dialog (alert) opening, or customer-typed hostile text (<script>, <img onerror>,
// markdown/HTML) turning into real elements instead of showing as plain text.
//
// Browser limits as in page-requests.test.mjs: the installed Chrome, a throwaway profile deleted afterwards, a mock keychain,
// only localhost and the test project's Supabase host reachable. Test project only ("ZZ CPG" data, deleted afterwards).
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
const BASE = 'http://localhost:10001';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const env = E2E_ENV;
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const DB_HOST = new URL(U).host;
const ALLOWED = new Set([new URL(BASE).host, DB_HOST]);
if (!fs.existsSync(CHROME)) { ok('Google Chrome is installed (set CHROME_PATH otherwise)', false, CHROME); process.exit(0); }

class CDP {
  constructor(url) { this.ws = new WebSocket(url); this.n = 0; this.wait = new Map(); this.on = []; this.ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id) { const w = this.wait.get(m.id); this.wait.delete(m.id); if (w) (m.error ? w.no(new Error(m.error.message)) : w.yes(m.result)); } else this.on.forEach((f) => f(m)); }; }
  open() { return new Promise((yes, no) => { this.ws.onopen = yes; this.ws.onerror = no; }); }
  send(method, params = {}) { const id = ++this.n; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((yes, no) => this.wait.set(id, { yes, no })); }
  async eval(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.value; }
}

const a = createClient(U, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now(), tag = String(t).slice(-6);
const HOSTILE = '<script>alert(1)</script> <img src=x onerror=alert(2)> **bold** [x](javascript:alert(3)) <b>html</b>';
const users = [];
const mk = async (n, meta) => { const u = (await a.auth.admin.createUser({ email: `zz-cpg-${n}-${t}@yopmail.com`, password: pw, email_confirm: true, ...(meta ? { app_metadata: meta } : {}) })).data.user; users.push(u); return u; };
const jarFor = async (email, two) => { const jar = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } }); await sb.auth.signInWithPassword({ email, password: pw }); if (two) await stepUp(sb); return jar; };
let chrome = null, profile = null, fam = null, rep = null, cust = null, imgPath = null;

try {
  const adm = await mk('a', { role: 'admin' }), ru = await mk('r', { role: 'rep' }), cu = await mk('c');
  rep = (await a.from('reps').insert({ name: 'ZZ CPG Rep', email: ru.email, user_id: ru.id, active: true }).select('id').single()).data;
  cust = (await a.from('customers').insert({ user_id: cu.id, company_name: 'ZZ CPG Co', contact_email: cu.email, customer_code: '', rep_id: rep.id }).select('id').single()).data;
  fam = (await a.from('product_families').insert({ code: `ZZ${tag}-CPG`, name: 'ZZ CPG Coverall', category: 'gloves', description: 'ZZ CPG test family', typical_sizes: ['M', 'L'], typical_colours: ['Navy'], typical_options: [{ label: 'Fabric', choices: ['FR cotton'] }], visible_to_customers: true }).select('id, code').single()).data;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  imgPath = `${fam.id}/zz-cpg-${tag}.png`;
  await a.storage.from('product-images').upload(imgPath, png, { contentType: 'image/png' });
  await a.from('family_images').insert({ family_id: fam.id, file_path: imgPath, file_name: 'zz.png', file_size: png.length, mime_type: 'image/png', file_sha256: 'c'.repeat(64) });
  const spec = { options: [{ label: 'Fabric', value: 'FR cotton' }], colour: '<b>Navy</b>', standard: null, branding: HOSTILE, details: HOSTILE };
  const draft = (await a.from('quote_drafts').insert({ customer_id: cust.id, note: HOSTILE }).select('id').single()).data;
  await a.from('quote_draft_lines').insert({ draft_id: draft.id, family_id: fam.id, spec, sizes: [{ size: 'M', qty: 60 }] });
  await a.from('saved_families').insert({ customer_id: cust.id, family_id: fam.id });
  const req = (await a.from('order_requests').insert({ customer_id: cust.id, kind: 'quote', items: [{ product_name: 'ZZ CPG Coverall', family_id: fam.id, family_code: fam.code, spec, sizes: [{ size: 'M', qty: 60 }], branding: HOSTILE }], note: HOSTILE, created_by: cu.id }).select('id').single()).data;
  await a.from('sample_requests').insert({ customer_id: cust.id, family_id: fam.id, spec, quantity: 2, note: HOSTILE, created_by: cu.id });
  const jars = { customer: await jarFor(cu.email, false), rep: await jarFor(ru.email, false), admin: await jarFor(adm.email, true) };

  profile = fs.mkdtempSync(path.join(process.env.CHROME_PROFILE_ROOT || os.tmpdir(), 'zz-chrome-profile-'));
  chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--use-mock-keychain', '--password-store=basic',
    '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-domain-reliability', '--no-pings',
    '--proxy-server=http://127.0.0.1:9', `--proxy-bypass-list=localhost;127.0.0.1;${DB_HOST}`, 'about:blank'], { stdio: 'ignore' });
  let port = null;
  for (let i = 0; i < 150 && !port; i++) { await sleep(100); try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { /* not yet */ } }
  ok('headless Chrome started with a throwaway profile', !!port);
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const cdp = new CDP(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await cdp.open();
  let failed = [], errors = [], refused = [], dialogs = [], outside = [];
  const urls = new Map();
  cdp.on.push((m) => {
    if (m.method === 'Network.requestWillBeSent') { urls.set(m.params.requestId, m.params.request.url); if (/^https?:/.test(m.params.request.url) && !ALLOWED.has(new URL(m.params.request.url).host)) outside.push(m.params.request.url); }
    if (m.method === 'Network.responseReceived' && /\/api\//.test(m.params.response.url) && m.params.response.status >= 400) refused.push(`${m.params.response.status} ${m.params.response.url}`);
    if (m.method === 'Network.loadingFailed' && m.params.errorText !== 'net::ERR_ABORTED' && !m.params.canceled) failed.push(`${m.params.errorText} ${urls.get(m.params.requestId) ?? ''}`);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? m.params.exceptionDetails?.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(`console: ${(m.params.args ?? []).map((x) => x.value ?? x.description ?? '').join(' ').slice(0, 200)}`);
    if (m.method === 'Page.javascriptDialogOpening') { dialogs.push(m.params.message); cdp.send('Page.handleJavaScriptDialog', { accept: false }); }
  });
  await cdp.send('Network.enable'); await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  const visit = async (who, url, expectPath, check) => {
    await cdp.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
    failed = []; errors = []; refused = []; dialogs = []; outside = [];
    await cdp.send('Page.navigate', { url: BASE + url });
    await sleep(3500);
    const landed = await cdp.eval('location.pathname');
    const dom = await cdp.eval(`(() => ({
      text: document.body.innerText,
      imgOnerror: document.querySelectorAll('img[onerror]').length,
      xImg: [...document.images].filter((i) => i.getAttribute('src') === 'x').length,
      bold: [...document.querySelectorAll('b')].filter((b) => /^(html|Navy)$/.test(b.textContent)).length,
      badScript: [...document.scripts].filter((s) => !s.src && /alert\\(1\\)/.test(s.textContent) && !/self\\.__next_f/.test(s.textContent)).length,
      jsLinks: document.querySelectorAll('a[href^="javascript:"]').length,
      textareas: [...document.querySelectorAll('textarea')].map((x) => x.value).join('\\n'),
    }))()`);
    const name = `${who} ${url.replace(/[0-9a-f-]{36}/g, ':id')}`;
    ok(`${name}: opens (${expectPath})`, landed === expectPath, landed);
    ok(`${name}: no page error, no console or hydration error, no failed or refused request, no dialog`, !errors.length && !failed.length && !refused.length && !dialogs.length && !outside.length, [...errors, ...failed, ...refused, ...dialogs.map((d) => `dialog ${d}`), ...outside].slice(0, 4).join(' | '));
    ok(`${name}: customer text never became elements (no img[onerror], <b>, inline alert script or javascript: link)`, dom.imgOnerror === 0 && dom.xImg === 0 && dom.bold === 0 && dom.badScript === 0 && dom.jsLinks === 0, JSON.stringify({ ...dom, text: undefined, textareas: undefined }));
    if (check) ok(`${name}: ${check[0]}`, check[1](dom), dom.text.replace(/\s+/g, " ").slice(-160));
  };
  const login = async (jar) => { await cdp.send('Network.clearBrowserCookies'); for (const [k, v] of jar) await cdp.send('Network.setCookie', { name: k, value: v, domain: 'localhost', path: '/' }); };
  const literal = (d) => d.text.includes('<script>alert(1)</script>') && d.text.includes('<img src=x onerror=alert(2)>');

  await login(jars.customer);
  await visit('customer', '/portal/browse', '/portal/browse', ['the family is listed, "Price on quote"', (d) => d.text.includes('ZZ CPG Coverall') && d.text.includes('Price on quote')]);
  await visit('customer', `/portal/browse/${fam.id}`, `/portal/browse/${fam.id}`, ['the family page, "Ask your rep about certification", the spec form', (d) => d.text.includes('Ask your rep about certification') && d.text.includes('How many do you need?')]);
  await visit('customer', '/portal/quote', '/portal/quote', ['the cart shows the hostile spec as plain text, the note in the textarea', (d) => literal(d) && d.textareas.includes('<script>alert(1)</script>')]);
  await visit('customer', '/portal/saved', '/portal/saved', ['the saved family', (d) => d.text.includes('ZZ CPG Coverall')]);
  await visit('customer', '/portal/requests', '/portal/requests', ['the request and the sample, hostile text shown literally', (d) => literal(d) && d.text.includes('Your sample requests')]);
  await login(jars.rep);
  await visit('rep', '/rep/browse', '/rep/browse', ['the same list', (d) => d.text.includes('ZZ CPG Coverall')]);
  await visit('rep', `/rep/browse/${fam.id}`, `/rep/browse/${fam.id}`, ['read-only: no Add to quote', (d) => !d.text.includes('Add to quote')]);
  await visit('rep', '/rep/requests', '/rep/requests', ['the customer\'s quote and sample, hostile text shown literally, no cart data', (d) => literal(d) && d.text.includes('Sample requests')]);
  await visit('rep', `/rep/orders/new?request=${req.id}`, '/rep/orders/new', ['"Turn into an order": the notes textarea holds the spec as text', (d) => d.textareas.includes('Customer spec, line 1') && d.textareas.includes('<script>alert(1)</script>')]);
  await login(jars.admin);
  await visit('admin', '/admin/requests', '/admin/requests', ['every customer\'s requests and samples, hostile text shown literally', (d) => literal(d) && d.text.includes('ZZ CPG Co')]);
  await visit('admin', '/admin/sourcing/families', '/admin/sourcing/families', ['the families list', (d) => d.text.includes('ZZ CPG Coverall')]);
  await visit('admin', `/admin/sourcing/families/${fam.id}`, `/admin/sourcing/families/${fam.id}`, ['the family page with images and standards', (d) => d.text.includes('Standards it can be made to') && d.text.includes('1 of 10')]);
  await visit('admin', '/admin/sourcing/catalog-settings', '/admin/sourcing/catalog-settings', ['the settings', (d) => d.text.includes('Customer minimum')]);
} catch (e) {
  ok('the customer-catalog pages test ran to the end', false, e instanceof Error ? e.stack?.split('\n').slice(0, 3).join(' | ') : String(e));
} finally {
  if (chrome) chrome.kill('SIGKILL');
  await sleep(300);
  if (profile) fs.rmSync(profile, { recursive: true, force: true });
  if (cust) { await a.from('sample_requests').delete().eq('customer_id', cust.id); await a.from('quote_drafts').delete().eq('customer_id', cust.id); await a.from('saved_families').delete().eq('customer_id', cust.id); await a.from('order_requests').delete().eq('customer_id', cust.id); }
  if (fam) { if (imgPath) await a.storage.from('product-images').remove([imgPath]); await a.from('family_images').delete().eq('family_id', fam.id); await a.from('product_families').delete().eq('id', fam.id); }
  if (cust) await a.from('customers').delete().eq('id', cust.id);
  if (rep) { await a.from('rep_activity').delete().eq('rep_id', rep.id); await a.from('reps').delete().eq('id', rep.id); }
  const uids = users.map((u) => u?.id).filter(Boolean);
  if (uids.length) await a.from('notifications').delete().in('recipient_user_id', uids);
  for (const id of uids) await a.auth.admin.deleteUser(id);
  const left = (await a.from('product_families').select('id').like('name', 'ZZ CPG%')).data?.length ?? 0;
  ok('cleaned up: no ZZ CPG family left; the throwaway profile is gone', left === 0 && (!profile || !fs.existsSync(profile)));
}
