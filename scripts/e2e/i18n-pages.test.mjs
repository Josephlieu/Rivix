// The language switcher in a real browser (2026-11-27). Opens the sign-in pages, the customer portal, a rep page and an
// admin page in headless Chrome, in each region, and fails on: a page error, a console or hydration error (dates are
// drawn on the server and in the browser with the same locale), a failed or refused request, or the wrong <html lang>.
// Also switches the language with the switcher itself (select → change) and checks the page redraws in that language,
// and that the choice survives a reload. Browser limits as in page-requests.test.mjs (throwaway profile; only localhost
// and the test project's Supabase host). Test project only (zz-i18np logins, deleted afterwards).
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
const pw = 'Tmp-pass-9876!', t = Date.now();
const users = [];
const mk = async (n, meta) => { const u = (await a.auth.admin.createUser({ email: `zz-i18np-${n}-${t}@yopmail.com`, password: pw, email_confirm: true, ...(meta ? { app_metadata: meta } : {}) })).data.user; users.push(u); return u; };
const jarFor = async (email, two) => { const jar = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } }); await sb.auth.signInWithPassword({ email, password: pw }); if (two) await stepUp(sb); return jar; };
let chrome = null, profile = null, rep = null, cust = null;

try {
  const cu = await mk('c'), ru = await mk('r', { role: 'rep' }), au = await mk('a', { role: 'admin' });
  rep = (await a.from('reps').insert({ name: 'ZZ I18NP Rep', email: ru.email, user_id: ru.id, active: true }).select('id').single()).data;
  cust = (await a.from('customers').insert({ user_id: cu.id, company_name: 'ZZ I18NP Co', contact_email: cu.email, customer_code: '', rep_id: rep.id }).select('id').single()).data;
  // One open request, so the boards draw a date (the hydration risk).
  await a.from('order_requests').insert({ customer_id: cust.id, kind: 'quote', items: [{ product_name: 'ZZ I18NP vest', sizes: [{ size: 'M', qty: 60 }], branding: null }], note: 'ZZ', created_by: cu.id });
  const jars = { customer: await jarFor(cu.email, false), rep: await jarFor(ru.email, false), admin: await jarFor(au.email, true) };

  profile = fs.mkdtempSync(path.join(process.env.CHROME_PROFILE_ROOT || os.tmpdir(), 'zz-chrome-profile-'));
  chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--use-mock-keychain', '--password-store=basic',
    '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-domain-reliability', '--no-pings', '--lang=en-CA',
    '--proxy-server=http://127.0.0.1:9', `--proxy-bypass-list=localhost;127.0.0.1;${DB_HOST}`, 'about:blank'], { stdio: 'ignore' });
  let port = null;
  for (let i = 0; i < 150 && !port; i++) { await sleep(100); try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { /* not yet */ } }
  ok('headless Chrome started with a throwaway profile', !!port);
  const cdp = new CDP((await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((p) => p.type === 'page').webSocketDebuggerUrl);
  await cdp.open();
  let failed = [], errors = [], refused = [], outside = [];
  const urls = new Map();
  cdp.on.push((m) => {
    if (m.method === 'Network.requestWillBeSent') { urls.set(m.params.requestId, m.params.request.url); if (/^https?:/.test(m.params.request.url) && !ALLOWED.has(new URL(m.params.request.url).host)) outside.push(m.params.request.url); }
    if (m.method === 'Network.responseReceived' && /\/api\//.test(m.params.response.url) && m.params.response.status >= 400) refused.push(`${m.params.response.status} ${m.params.response.url}`);
    if (m.method === 'Network.loadingFailed' && m.params.errorText !== 'net::ERR_ABORTED' && !m.params.canceled) failed.push(`${m.params.errorText} ${urls.get(m.params.requestId) ?? ''}`);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? m.params.exceptionDetails?.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(`console: ${(m.params.args ?? []).map((x) => x.value ?? x.description ?? '').join(' ').slice(0, 160)}`);
  });
  await cdp.send('Network.enable'); await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  const setCookies = async (jar, locale) => {
    await cdp.send('Network.clearBrowserCookies');
    for (const [k, v] of jar ?? []) await cdp.send('Network.setCookie', { name: k, value: v, domain: 'localhost', path: '/' });
    if (locale) await cdp.send('Network.setCookie', { name: 'rivix_locale', value: locale, domain: 'localhost', path: '/' });
  };
  const visit = async (who, url, expectLang, expectText, { jar = null, locale = null, expectPath = url.split('?')[0] } = {}) => {
    await cdp.send('Page.navigate', { url: 'about:blank' }); await sleep(250);
    await setCookies(jar, locale);
    failed = []; errors = []; refused = []; outside = [];
    await cdp.send('Page.navigate', { url: BASE + url });
    await sleep(3000);
    const d = await cdp.eval(`({ path: location.pathname, lang: document.documentElement.lang, staffLang: document.querySelector('div[lang]')?.getAttribute('lang') ?? null, text: document.body.innerText, switcher: !!document.querySelector('[data-testid="language-switcher"] select') })`);
    const name = `${who} ${url} (${locale ?? 'no choice'})`;
    ok(`${name}: opens, <html lang="${expectLang}">, switcher present`, d.path === expectPath && d.lang === expectLang && d.switcher, `${d.path} ${d.lang} ${d.switcher}`);
    ok(`${name}: no page, console or hydration error; no failed or refused request`, !errors.length && !failed.length && !refused.length && !outside.length, [...errors, ...failed, ...refused, ...outside].slice(0, 3).join(' | '));
    if (expectText) ok(`${name}: shows "${expectText}"`, d.text.includes(expectText), d.text.replace(/\s+/g, ' ').slice(0, 120));
    return d;
  };

  // Sign-in pages, signed out, each region.
  await visit('visitor', '/login', 'en-CA', 'Sign In to Portal');
  await visit('visitor', '/login', 'fr-CA', 'Se connecter au portail', { locale: 'fr-CA' });
  await visit('visitor', '/login', 'en-US', 'Sign In to Portal', { locale: 'en-US' });
  await visit('visitor', '/', 'fr-CA', 'Certificats de conformité', { locale: 'fr-CA' });
  await visit('visitor', '/forgot-password', 'fr-CA', 'Envoyer le lien', { locale: 'fr-CA' });
  await visit('visitor', '/reset-password', 'fr-CA', null, { locale: 'fr-CA' });
  // Switching with the switcher itself.
  await visit('visitor', '/login', 'en-CA', 'Sign In to Portal');
  await cdp.eval(`(() => { const s = document.querySelector('[data-testid="language-switcher"] select'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'fr-CA'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(2500);
  let d = await cdp.eval(`({ lang: document.documentElement.lang, text: document.body.innerText, cookie: document.cookie })`);
  ok('the switcher: choosing QC · FR redraws /login in French (lang fr-CA)', d.lang === 'fr-CA' && d.text.includes('Se connecter au portail'), `${d.lang}`);
  await cdp.send('Page.reload'); await sleep(2500);
  d = await cdp.eval(`({ lang: document.documentElement.lang, text: document.body.innerText, cookie: document.cookie })`);
  ok('  the choice survives a reload (cookie, HttpOnly: not readable by page scripts)', d.lang === 'fr-CA' && d.text.includes('Se connecter au portail') && !d.cookie.includes('rivix_locale'));
  // Location (the local test server stands in for Vercel's headers): Quebec opens in French; the switcher overrides it,
  // and the override is remembered even though the location still says Quebec.
  await cdp.send('Network.setExtraHTTPHeaders', { headers: { 'x-rivix-test-geo': 'CA-QC' } });
  await visit('visitor in Quebec', '/login', 'fr-CA', 'Se connecter au portail');
  await cdp.eval(`(() => { const s = document.querySelector('[data-testid="language-switcher"] select'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'en-CA'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(2500);
  d = await cdp.eval(`({ lang: document.documentElement.lang, text: document.body.innerText })`);
  ok('visitor in Quebec: choosing CA · EN in the switcher overrides the location (English)', d.lang === 'en-CA' && d.text.includes('Sign In to Portal'), d.lang);
  await cdp.send('Page.reload'); await sleep(2500);
  d = await cdp.eval(`({ lang: document.documentElement.lang, text: document.body.innerText })`);
  ok('  …and stays English after a reload, though the location still says Quebec (the choice is remembered)', d.lang === 'en-CA' && d.text.includes('Sign In to Portal'), d.lang);
  await cdp.send('Network.setExtraHTTPHeaders', { headers: {} });

  // Signed-in areas.
  await visit('customer', '/portal', 'fr-CA', null, { jar: jars.customer, locale: 'fr-CA' });
  await visit('customer', '/portal/requests', 'fr-CA', 'ZZ I18NP vest', { jar: jars.customer, locale: 'fr-CA' });
  d = await visit('rep', '/rep/requests', 'fr-CA', 'Customer requests', { jar: jars.rep, locale: 'fr-CA' });
  ok('rep pages stay in English with QC·FR chosen (the staff area is lang en-CA)', d.staffLang === 'en-CA');
  d = await visit('admin', '/admin/requests', 'en-US', 'Customer requests', { jar: jars.admin, locale: 'en-US' });
  ok('admin pages: English with US formats (the staff area is lang en-US)', d.staffLang === 'en-US');
} catch (e) {
  ok('the i18n pages test ran to the end', false, e instanceof Error ? e.stack?.split('\n').slice(0, 3).join(' | ') : String(e));
} finally {
  if (chrome) chrome.kill('SIGKILL');
  await sleep(300);
  if (profile) fs.rmSync(profile, { recursive: true, force: true });
  if (cust) { await a.from('order_requests').delete().eq('customer_id', cust.id); await a.from('customers').delete().eq('id', cust.id); }
  if (rep) { await a.from('rep_activity').delete().eq('rep_id', rep.id); await a.from('reps').delete().eq('id', rep.id); }
  const ids = users.map((u) => u?.id).filter(Boolean);
  if (ids.length) await a.from('notifications').delete().in('recipient_user_id', ids);
  for (const id of ids) await a.auth.admin.deleteUser(id);
  ok('cleaned up: no zz-i18np login left; the throwaway profile is gone', (!profile || !fs.existsSync(profile)));
}
