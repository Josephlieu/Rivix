// Language switcher, A1 foundation (2026-11-27, approved). Proves:
//   - offline: which locale each side draws (customer CA·EN/QC·FR/US·EN; staff English; supplier English/简体中文); the
//     browser's language before a choice; t() values, plurals and fallbacks; dates and numbers follow the region while
//     money keeps the account's currency; calendar-day keys stay YYYY-MM-DD; every French key exists with the same
//     placeholders and a review entry; the launch gate blocks protected text (certification, privacy, NDA, terms) until a
//     named fluent speaker reviewed it; no hard-coded English left on the converted sign-in pages; customer text, documents
//     and the switcher labels are marked translate="no"; the browser bundle never imports the dictionaries;
//   - live on the TEST project: the sign-in pages in each language (cookie, else Accept-Language); /api/me/locale sets the
//     cookie before login and saves the choice per user after it, so it follows them to a new device; staff pages stay in
//     English; customers, reps and visitors have no rights on user_preferences; the row goes with the login.
// Test project only (zz-i18n logins, deleted at the end). Needs the server on port 10001.
import { env as E2E_ENV } from './env.mjs'; // the test project only (guarded), never Development
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { stepUp } from './mfa.mjs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);

const C = await import('../../src/i18n/config.ts');
const TR = await import('../../src/i18n/translate.ts');
const D = await import('../../src/i18n/dictionaries.ts');
const RV = await import('../../src/i18n/review.ts');
const FMT = await import('../../src/lib/format.ts');

// =====================================================================================================================
// Offline
// =====================================================================================================================
ok('customer side: CA·EN, QC·FR, US·EN as chosen; anything else (a supplier\'s 简体中文) is drawn in CA·EN', C.effectiveLocale('fr-CA', 'customer') === 'fr-CA' && C.effectiveLocale('en-US', 'customer') === 'en-US' && C.effectiveLocale('zh-CN', 'customer') === 'en-CA' && C.effectiveLocale(null, 'customer') === 'en-CA');
ok('staff side: English for now (US·EN keeps US formats; QC·FR is drawn in CA·EN)', C.effectiveLocale('fr-CA', 'staff') === 'en-CA' && C.effectiveLocale('en-US', 'staff') === 'en-US' && C.effectiveLocale('zh-CN', 'staff') === 'en-CA');
ok('supplier side: English or 简体中文 only (QC·FR and US·EN are drawn in English)', C.effectiveLocale('zh-CN', 'supplier') === 'zh-CN' && C.effectiveLocale('fr-CA', 'supplier') === 'en-CA' && C.effectiveLocale('en-US', 'supplier') === 'en-CA');
ok('switcher labels per side, never translated', JSON.stringify(C.SIDE_LOCALES.customer.map((l) => C.LOCALE_LABEL.customer[l])) === '["CA · EN","QC · FR","US · EN"]' && JSON.stringify(C.SIDE_LOCALES.supplier.map((l) => C.LOCALE_LABEL.supplier[l])) === '["English","简体中文"]');
// Starting language by location (2026-11-27).
const G = (country, region = null) => ({ country, region });
ok('location: Quebec → QC·FR on customer pages (region "QC" or "CA-QC"); other provinces → nothing', C.locationLocale(G('CA', 'QC'), 'customer') === 'fr-CA' && C.locationLocale(G('CA', 'CA-QC'), 'customer') === 'fr-CA' && C.locationLocale(G('CA', 'ON'), 'customer') === null && C.locationLocale(G('CA', 'BC'), 'customer') === null && C.locationLocale(G('CA'), 'customer') === null);
ok('location: China → 简体中文 on supplier pages only; China on customer pages stays with nothing (CA·EN)', C.locationLocale(G('CN'), 'supplier') === 'zh-CN' && C.locationLocale(G('CN'), 'customer') === null && C.locationLocale(G('CA', 'QC'), 'supplier') === null);
ok('location: staff pages never (English for now); no location → nothing', C.locationLocale(G('CA', 'QC'), 'staff') === null && C.locationLocale(G('CN'), 'staff') === null && C.locationLocale(null, 'customer') === null && C.locationLocale(G(null), 'customer') === null);
const hdr = (o) => (n) => o[n] ?? null;
const vercel = C.geoFrom(hdr({ 'x-vercel-ip-country': 'CA', 'x-vercel-ip-country-region': 'QC', 'x-rivix-test-geo': 'CN' }), { VERCEL: '1', RIVIX_TEST_GEO: '1' });
ok('location source on Vercel: only Vercel\'s own headers; the test header is ignored there even if RIVIX_TEST_GEO were set', vercel?.country === 'CA' && vercel?.region === 'QC' && C.geoFrom(hdr({ 'x-rivix-test-geo': 'CA-QC' }), { VERCEL: '1', RIVIX_TEST_GEO: '1' }) === null);
ok('location source off Vercel: nothing (x-vercel-* headers are not trusted there); the test header only with RIVIX_TEST_GEO=1', C.geoFrom(hdr({ 'x-vercel-ip-country': 'CA', 'x-vercel-ip-country-region': 'QC' }), {}) === null && C.geoFrom(hdr({ 'x-rivix-test-geo': 'CA-QC' }), {}) === null && C.geoFrom(hdr({ 'x-rivix-test-geo': 'CA-QC' }), { RIVIX_TEST_GEO: '1' })?.region === 'QC' && C.geoFrom(hdr({ 'x-rivix-test-geo': 'not a place' }), { RIVIX_TEST_GEO: '1' }) === null);
ok('browser language counts only if this side offers it (a Chinese-first browser on a customer page → its French)', C.fromAcceptLanguage('zh-CN,fr;q=0.8', C.SIDE_LOCALES.customer) === 'fr-CA' && C.fromAcceptLanguage('zh-CN', C.SIDE_LOCALES.customer) === null && C.fromAcceptLanguage('zh-CN', C.SIDE_LOCALES.supplier) === 'zh-CN');
ok('before a choice: the browser\'s language (fr, fr-FR → QC·FR; en-US → US·EN; zh-TW → 简体中文; de → none; q-values respected)', C.fromAcceptLanguage('fr-FR,fr;q=0.9') === 'fr-CA' && C.fromAcceptLanguage('en-US,en;q=0.8') === 'en-US' && C.fromAcceptLanguage('zh-TW') === 'zh-CN' && C.fromAcceptLanguage('de-DE') === null && C.fromAcceptLanguage('de;q=0.9,fr;q=0.8') === 'fr-CA' && C.fromAcceptLanguage('fr;q=0.2,en-US;q=0.9') === 'en-US' && C.fromAcceptLanguage('') === null);
const tEn = D.tFor('en-CA'), tFr = D.tFor('fr-CA'), tUs = D.tFor('en-US');
ok('t(): a key in each language; US·EN falls back to the Canadian English text', tEn('login.submit') === 'Sign In to Portal' && tFr('login.submit') === 'Se connecter au portail' && tUs('login.submit') === 'Sign In to Portal');
ok('t(): values are inserted as plain text (markup stays text)', tEn('forgot.sentBody', { email: '<b>x@y.z</b>' }) === 'If an account exists for <b>x@y.z</b>, a password reset link is on its way.');
ok('t(): plurals follow each language (English 0/1/2; French counts 0 and 1 as singular) with the region\'s number format', tEn('common.items', { count: 0 }) === '0 items' && tEn('common.items', { count: 1 }) === '1 item' && tEn('common.items', { count: 1234 }) === '1,234 items' && tFr('common.items', { count: 0 }) === '0 article' && tFr('common.items', { count: 1 }) === '1 article' && tFr('common.items', { count: 2 }) === '2 articles' && tFr('common.items', { count: 1234 }).replace(/\s/g, ' ') === '1 234 articles');
ok('t(): an unknown key comes back as itself (the checks below make sure none ships)', TR.translator('fr-CA', {})('login.submit') === 'login.submit');
ok('t(): a key missing in a language falls back to English', D.flatMessages('zh-CN')['login.submit'] === 'Sign In to Portal' && D.flatMessages('zh-CN')['switcher.label'] === '语言和地区');
// Formats.
const day = '2026-10-03', moment = '2026-10-03T18:25:00Z';
ok('dates follow the region (en-CA "Oct 3, 2026", fr-CA "3 oct. 2026", en-US "Oct 3, 2026"), always with the month as a word', FMT.formatDateIn(day, 'UTC', '—', 'en-CA') === 'Oct 3, 2026' && FMT.formatDateIn(day, 'UTC', '—', 'fr-CA') === '3 oct. 2026' && FMT.formatDateIn(day, 'UTC', '—', 'en-US') === 'Oct 3, 2026', [FMT.formatDateIn(day, 'UTC', '—', 'fr-CA'), FMT.formatDateTimeIn(moment, 'UTC', '—', 'fr-CA')].join(' | '));
ok('numbers follow the region (1,234.5 / 1 234,5)', FMT.formatNumber(1234.5, 'en-CA') === '1,234.5' && FMT.formatNumber(1234.5, 'fr-CA').replace(/\s/g, ' ') === '1 234,5' && FMT.formatNumber(1234.5, 'en-US') === '1,234.5');
const money = ['en-CA', 'fr-CA', 'en-US'].map((l) => FMT.formatMoney(1234.5, 'CAD', l).replace(/\s/g, ' '));
ok('money: the account\'s currency (CAD) in every region; only the writing changes ($1,234.50 / 1 234,50 $ / CA$1,234.50)', JSON.stringify(money) === JSON.stringify(['$1,234.50', '1 234,50 $', 'CA$1,234.50']) && FMT.formatMoney(10, 'USD', 'en-CA') === 'US$10.00', money.join(' | '));
let threw = false; try { FMT.formatMoney(5, '', 'en-US'); } catch { threw = true; }
ok('money: a currency from the account is required (the region never supplies one)', threw);
ok('calendar-day keys stay YYYY-MM-DD whatever the region', /^\d{4}-\d{2}-\d{2}$/.test(FMT.localDateKey(new Date('2026-10-03T12:00:00Z'))));
// Dictionaries and the review gate.
const review = (l) => JSON.parse(fs.readFileSync(`src/i18n/messages/${l}.review.json`, 'utf8'));
const fr = RV.checkLocale('fr-CA', review('fr-CA')), zh = RV.checkLocale('zh-CN', review('zh-CN')), us = RV.checkLocale('en-US', null);
ok('French: every key of the customer-side namespaces, the same {placeholders} and plural blocks, none empty, none unknown, each with a review entry', !fr.missing.length && !fr.placeholderMismatch.length && !fr.empty.length && !fr.unknown.length && !fr.noReview.length, JSON.stringify({ ...fr, needsReview: fr.needsReview.length, protectedUnreviewed: fr.protectedUnreviewed.length }));
ok('简体中文: the switcher complete, with review entries; US English: only valid overrides', !zh.missing.length && !zh.noReview.length && !zh.unknown.length && !us.unknown.length && !us.placeholderMismatch.length);
ok('AI-drafted translations start as "needs review" (by "AI draft")', Object.values(review('fr-CA').keys).every((k) => k.status === 'needs_review' && /AI draft/.test(k.by)));
ok('the launch gate blocks the French certification wording until a fluent speaker reviewed it (today: 4 keys)', fr.protectedUnreviewed.length === 4 && fr.protectedUnreviewed.every((k) => k.startsWith('certification.')));
const fixture = { keys: Object.fromEntries(Object.keys(D.flatten(D.DICTS['fr-CA'])).map((k) => [k, { status: 'reviewed', by: 'Marie Tremblay (fluent, test fixture)', date: '2026-11-27' }])) };
ok('  …and passes once each protected key is reviewed by a named person with a date', RV.checkLocale('fr-CA', fixture).protectedUnreviewed.length === 0 && RV.checkLocale('fr-CA', fixture).badReview.length === 0);
const aiReviewed = { keys: { ...fixture.keys, 'certification.homeCertsTitle': { status: 'reviewed', by: 'AI draft (Claude)', date: '2026-11-27' } } };
ok('  …and "reviewed" by the AI itself, or without a date, does not count', RV.checkLocale('fr-CA', aiReviewed).badReview.includes('certification.homeCertsTitle'));
ok('protected groups: certification, privacy, NDA, terms', RV.isProtected('certification.x') && RV.isProtected('privacy.x') && RV.isProtected('nda.x') && RV.isProtected('terms.x') && !RV.isProtected('login.x'));
// Source checks.
const read = (f) => fs.readFileSync(f, 'utf8');
const CONVERTED = ['src/app/login/page.tsx', 'src/app/forgot-password/page.tsx', 'src/app/reset-password/page.tsx', 'src/app/page.tsx', 'src/app/not-found.tsx'];
const ALLOWED_TEXT = new Set(['404', 'RIVIX']);
const hardcoded = CONVERTED.flatMap((f) => {
  const s = read(f);
  // Text between tags; code that only looks like text (a JSX ternary such as ") : !validSession ? (") is skipped.
  const text = [...s.matchAll(/>\s*([^<>{}\n]*[A-Za-z]{2,}[^<>{}\n]*?)\s*</g)].map((m) => m[1].trim()).filter((x) => !ALLOWED_TEXT.has(x) && !/^[\s():!?&|.\w]*\?\s*\($/.test(x) && !/=>|&&|\|\|/.test(x));
  const attrs = [...s.matchAll(/\b(placeholder|aria-label|title)="([^"]*[A-Za-z]{2,}[^"]*)"/g)].map((m) => `${m[1]}="${m[2]}"`);
  const alts = [...s.matchAll(/\balt="([^"]*[A-Za-z]{2,}[^"]*)"/g)].map((m) => m[1]).filter((x) => !ALLOWED_TEXT.has(x));
  return [...text, ...attrs, ...alts].map((x) => `${path.basename(path.dirname(f))}: ${x}`);
});
ok('no hard-coded English left on the 5 converted sign-in pages (the brand name RIVIX and 404 excepted)', hardcoded.length === 0, hardcoded.slice(0, 6).join(' | '));
const marked = [['src/components/catalog/SpecText.tsx', 1], ['src/components/RequestsBoard.tsx', 3], ['src/components/catalog/SampleRequests.tsx', 1], ['src/app/portal/requests/page.tsx', 2], ['src/components/DocumentList.tsx', 2], ['src/components/LanguageSwitcher.tsx', 1]];
const unmarked = marked.filter(([f, n]) => (read(f).match(/translate="no"/g) ?? []).length < n).map(([f]) => f);
ok('customer-typed text, document names and the switcher labels are marked translate="no" (never machine-translated)', unmarked.length === 0, unmarked.join(', '));
const clientFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? clientFiles(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [])).filter((f) => /^['"]use client['"]/.test(read(f).trimStart()));
const bundled = clientFiles('src').filter((f) => /i18n\/dictionaries|messages\/[a-zA-Z-]+\.json/.test(read(f)));
const serverSrc = read('src/i18n/server.ts'), configSrc = read('src/i18n/config.ts');
ok('the location is never logged or stored: no console call, no cookie or database write in the locale code', !/console\./.test(serverSrc + configSrc) && !/\.set\(|upsert|insert/.test(serverSrc + configSrc));
ok('only the local test server turns the test header on (run-on-test-project.mjs sets RIVIX_TEST_GEO=1)', /RIVIX_TEST_GEO: '1'/.test(read('scripts/e2e/run-on-test-project.mjs')) && !(fs.existsSync('.env.local') && /RIVIX_TEST_GEO/.test(read('.env.local'))) && read('src/app/privacy/page.tsx').includes('approximate location'));
ok('no browser file imports the dictionaries (each page gets only its own locale\'s messages)', bundled.length === 0, bundled.join(', '));
const withSwitcher = ['src/app/portal/layout.tsx', 'src/app/rep/layout.tsx', 'src/app/admin/layout.tsx', 'src/app/login/page.tsx', 'src/app/forgot-password/page.tsx', 'src/app/reset-password/page.tsx', 'src/app/page.tsx', 'src/app/not-found.tsx', 'src/app/admin-login/page.tsx', 'src/app/admin-mfa/page.tsx', 'src/app/join/[token]/page.tsx', 'src/app/privacy/page.tsx', 'src/app/terms/page.tsx'];
const noSwitcher = withSwitcher.filter((f) => !/LanguageSwitcher side=/.test(read(f)));
ok(`the switcher is on every layout and public page (${withSwitcher.length} files)`, noSwitcher.length === 0, noSwitcher.join(', '));

// =====================================================================================================================
// Live, on the test project
// =====================================================================================================================
const env = E2E_ENV;
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const a = createClient(U, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(U, AK, { auth: { persistSession: false } });
const BASE = 'http://localhost:10001';
const pw = 'Tmp-pass-9876!', t = Date.now();
const users = [];
let rep = null, cust = null;
const mk = async (n, meta) => { const u = (await a.auth.admin.createUser({ email: `zz-i18n-${n}-${t}@yopmail.com`, password: pw, email_confirm: true, ...(meta ? { app_metadata: meta } : {}) })).data.user; users.push(u); return u; };
const signIn = async (email, two = false) => { const j = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } }); const x = await sb.auth.signInWithPassword({ email, password: pw }); if (x.error) throw x.error; if (two) await stepUp(sb); return { sb, cookie: [...j].map(([k, v]) => `${k}=${v}`).join('; ') }; };
const page = async (url, { cookie = '', lang = '', geo = '', vercel = false } = {}) => { const r = await fetch(BASE + url, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...(lang ? { 'Accept-Language': lang } : {}), ...(geo ? { 'x-rivix-test-geo': geo } : {}), ...(vercel ? { 'x-vercel-ip-country': 'CA', 'x-vercel-ip-country-region': 'QC' } : {}) }, redirect: 'manual' }); return { status: r.status, html: await r.text() }; };
const call = async (m, url, cookie, body) => { const r = await fetch(BASE + url, { method: m, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }); let j = {}; try { j = await r.json(); } catch { /* none */ } return { status: r.status, j, setCookie: r.headers.get('set-cookie') ?? '' }; };
const htmlLang = (h) => /<html[^>]*\blang="([^"]+)"/.exec(h)?.[1];
const loc = (l) => `rivix_locale=${l}`;

try {
  // Sign-in pages in each language.
  let p = await page('/login', { cookie: loc('fr-CA') });
  ok('/login with QC·FR chosen: French text, <html lang="fr-CA">, the switcher on QC·FR', p.status === 200 && htmlLang(p.html) === 'fr-CA' && p.html.includes('Se connecter au portail') && p.html.includes('Adresse courriel') && /data-testid="language-switcher"/.test(p.html) && /<option value="fr-CA" selected="">QC · FR<\/option>/.test(p.html), htmlLang(p.html));
  p = await page('/login', { lang: 'fr-CA,fr;q=0.9' });
  ok('/login before any choice, browser in French: French', htmlLang(p.html) === 'fr-CA' && p.html.includes('Se connecter au portail'));
  p = await page('/login', { lang: 'en-US,en;q=0.9' });
  ok('/login before any choice, browser in US English: English, lang en-US', htmlLang(p.html) === 'en-US' && p.html.includes('Sign In to Portal'));
  p = await page('/login', { cookie: loc('fr-CA'), lang: 'en-US' });
  ok('the choice (cookie) wins over the browser\'s language', htmlLang(p.html) === 'fr-CA');
  p = await page('/login', { cookie: loc('zh-CN') });
  ok('/login (customer side) with 简体中文 chosen: drawn in CA·EN', htmlLang(p.html) === 'en-CA' && p.html.includes('Sign In to Portal'));
  p = await page('/login', { cookie: 'rivix_locale=de-DE' });
  ok('an unknown cookie value is ignored (CA·EN)', htmlLang(p.html) === 'en-CA');
  const others = await Promise.all([page('/', { cookie: loc('fr-CA') }), page('/forgot-password', { cookie: loc('fr-CA') }), page('/reset-password', { cookie: loc('fr-CA') }), page('/zz-no-such-page', { cookie: loc('fr-CA') })]);
  ok('the landing, forgot-password, reset-password and 404 pages are in French with QC·FR', others[0].html.includes('Portail des') && others[0].html.includes('Certificats de conformité') && others[1].html.includes('Envoyer le lien') && others[2].html.includes('NOUVEAU') && others[3].status === 404 && others[3].html.includes('Page introuvable'), others.map((o) => o.status).join(','));
  const pub = await Promise.all(['/admin-login', '/privacy', '/terms'].map((u) => page(u, { cookie: loc('fr-CA') })));
  ok('the admin sign-in, privacy and terms pages show the switcher too', pub.every((x) => x.status === 200 && /data-testid="language-switcher"/.test(x.html)));

  // Starting language by location (the local test server stands in for Vercel's headers with x-rivix-test-geo).
  const geo = async (url, place, extra = {}) => page(url, { ...extra, ...(place ? { geo: place } : {}) });
  ok('location Quebec, nothing chosen: /login opens in French', htmlLang((await geo('/login', 'CA-QC')).html) === 'fr-CA');
  ok('location Ontario or BC: CA·EN; with a French browser, the browser\'s French (location gives nothing there)', htmlLang((await geo('/login', 'CA-ON')).html) === 'en-CA' && htmlLang((await geo('/login', 'CA-BC')).html) === 'en-CA' && htmlLang((await geo('/login', 'CA-ON', { lang: 'fr-CA' })).html) === 'fr-CA');
  ok('location China on a customer page: CA·EN, even with a Chinese browser', htmlLang((await geo('/login', 'CN')).html) === 'en-CA' && htmlLang((await geo('/login', 'CN', { lang: 'zh-CN,zh;q=0.9' })).html) === 'en-CA');
  ok('no location: CA·EN (or the browser\'s language)', htmlLang((await geo('/login', null)).html) === 'en-CA' && htmlLang((await geo('/login', null, { lang: 'en-US' })).html) === 'en-US');
  const sideOpens = async (side, place, cookie = '') => (await fetch(`${BASE}/api/me/locale?side=${side}`, { headers: { ...(place ? { 'x-rivix-test-geo': place } : {}), ...(cookie ? { Cookie: cookie } : {}) } }).then((x) => x.json())).opens;
  ok('supplier pages: China → 简体中文; Quebec → English; no location → English', (await sideOpens('supplier', 'CN')) === 'zh-CN' && (await sideOpens('supplier', 'CA-QC')) === 'en-CA' && (await sideOpens('supplier', null)) === 'en-CA');
  ok('staff pages: English whatever the location (Quebec, China)', (await sideOpens('staff', 'CA-QC')) === 'en-CA' && (await sideOpens('staff', 'CN')) === 'en-CA');
  ok('Vercel\'s own headers sent to this (non-Vercel) server are ignored: they cannot be faked here', htmlLang((await page('/login', { vercel: true })).html) === 'en-CA');
  ok('the cookie beats the location (US·EN chosen, Quebec location → US·EN; CA·EN chosen in China on a supplier page → English)', htmlLang((await geo('/login', 'CA-QC', { cookie: loc('en-US') })).html) === 'en-US' && (await sideOpens('supplier', 'CN', loc('en-CA'))) === 'en-CA');
  const pl = await fetch(`${BASE}/login`, { headers: { 'x-rivix-test-geo': 'CA-QC' } });
  ok('the location is never stored: opening a page from Quebec sets no language cookie', !/rivix_locale/.test(pl.headers.get('set-cookie') ?? ''));

  // /api/me/locale before login.
  let r = await call('POST', '/api/me/locale', null, { locale: 'fr-CA' });
  ok('before login: choosing sets the cookie (a year, HttpOnly, SameSite=Lax), nothing saved', r.status === 200 && r.j.saved === false && /rivix_locale=fr-CA/.test(r.setCookie) && /HttpOnly/i.test(r.setCookie) && /SameSite=lax/i.test(r.setCookie) && /Max-Age=31536000/i.test(r.setCookie), r.setCookie);
  ok('an unknown language or a bad body is refused (400)', (await call('POST', '/api/me/locale', null, { locale: 'de-DE' })).status === 400 && (await call('POST', '/api/me/locale', null, 'not json')).status === 400 && (await call('POST', '/api/me/locale', null, { locale: ['fr-CA'] })).status === 400);
  r = await call('GET', '/api/me/locale', loc('en-US'));
  ok('before login, GET only reports the cookie', r.status === 200 && r.j.locale === 'en-US' && r.j.saved === false);

  // After login: saved per user, follows them to a new device.
  const cu = await mk('c'), ru = await mk('r', { role: 'rep' }), au = await mk('a', { role: 'admin' });
  rep = (await a.from('reps').insert({ name: 'ZZ I18N Rep', email: ru.email, user_id: ru.id, active: true }).select('id').single()).data;
  cust = (await a.from('customers').insert({ user_id: cu.id, company_name: 'ZZ I18N Co', contact_email: cu.email, customer_code: '', rep_id: rep.id }).select('id').single()).data;
  const C1 = await signIn(cu.email);
  r = await call('POST', '/api/me/locale', C1.cookie, { locale: 'fr-CA' });
  const row = (await a.from('user_preferences').select('locale').eq('user_id', cu.id).maybeSingle()).data;
  ok('signed in: choosing QC·FR saves it for this login (and sets the cookie)', r.status === 200 && r.j.saved === true && row?.locale === 'fr-CA' && /rivix_locale=fr-CA/.test(r.setCookie));
  const C2 = await signIn(cu.email); // a new device: no locale cookie
  r = await call('GET', '/api/me/locale', C2.cookie);
  ok('a new device: after sign-in the saved choice comes back and is put in the cookie', r.j.locale === 'fr-CA' && /rivix_locale=fr-CA/.test(r.setCookie));
  r = await call('GET', '/api/me/locale', `${C2.cookie}; ${loc('en-US')}`);
  ok('  the saved choice wins over a different cookie on that device', r.j.locale === 'fr-CA' && /rivix_locale=fr-CA/.test(r.setCookie));
  // The saved choice beats the cookie and the location.
  await call('POST', '/api/me/locale', C1.cookie, { locale: 'en-US' });
  p = await page('/portal', { cookie: `${C1.cookie}; ${loc('fr-CA')}`, geo: 'CA-QC' });
  ok('saved US·EN beats a QC·FR cookie and a Quebec location', htmlLang(p.html) === 'en-US', htmlLang(p.html));
  p = await page('/portal', { cookie: C2.cookie, geo: 'CA-QC' });
  ok('saved US·EN beats a Quebec location on a device with no cookie', htmlLang(p.html) === 'en-US', htmlLang(p.html));
  await call('POST', '/api/me/locale', C1.cookie, { locale: 'fr-CA' });
  const nu = await mk('n');
  const N1 = await signIn(nu.email);
  r = await fetch(`${BASE}/api/me/locale`, { headers: { Cookie: N1.cookie, 'x-rivix-test-geo': 'CA-QC' } }).then(async (x) => ({ j: await x.json(), sc: x.headers.get('set-cookie') ?? '' }));
  ok('the location is never saved: signing in from Quebec with nothing chosen saves nothing and sets no cookie', r.j.locale === null && !/rivix_locale/.test(r.sc) && !(await a.from('user_preferences').select('user_id').eq('user_id', nu.id)).data?.length);
  const R1 = await signIn(ru.email);
  r = await call('GET', '/api/me/locale', `${R1.cookie}; ${loc('en-US')}`);
  ok('a choice made before signing in is saved at sign-in when there is none yet', r.j.locale === 'en-US' && (await a.from('user_preferences').select('locale').eq('user_id', ru.id).single()).data?.locale === 'en-US');
  p = await page('/portal', { cookie: `${C1.cookie}; ${loc('fr-CA')}` });
  ok('the customer portal: <html lang="fr-CA"> and the switcher in the header', p.status === 200 && htmlLang(p.html) === 'fr-CA' && /data-testid="language-switcher"/.test(p.html), String(p.status));
  await call('POST', '/api/me/locale', R1.cookie, { locale: 'fr-CA' }); // the rep chooses QC·FR (saved: it now beats the cookie)
  p = await page('/rep', { cookie: `${R1.cookie}; ${loc('fr-CA')}` });
  ok('rep pages stay in English with QC·FR chosen (the staff area is lang en-CA); the switcher shows QC·FR', p.status === 200 && /<div lang="en-CA"/.test(p.html) && p.html.includes('Sales') && /<option value="fr-CA" selected="">QC · FR<\/option>/.test(p.html) && p.html.includes('Staff pages are in English for now'));
  const A1 = await signIn(au.email, true);
  p = await page('/admin', { cookie: `${A1.cookie}; ${loc('en-US')}` });
  ok('admin pages: English, US formats with US·EN (lang en-US), the switcher in the header', p.status === 200 && /<div lang="en-US"/.test(p.html) && /data-testid="language-switcher"/.test(p.html));

  // Rights on the new table.
  const open = [];
  for (const [n, s] of [['customer', C1.sb], ['rep', R1.sb], ['visitor', anon]]) {
    for (const [k, q] of [['select', () => s.from('user_preferences').select('user_id').limit(1)], ['insert', () => s.from('user_preferences').insert({ user_id: cu.id, locale: 'en-CA' })], ['update', () => s.from('user_preferences').update({ locale: 'en-CA' }).eq('user_id', cu.id)], ['delete', () => s.from('user_preferences').delete().eq('user_id', cu.id)]]) {
      const x = await q(); if (!x.error || x.error.code !== '42501') open.push(`${n} ${k} (${x.error?.code ?? 'allowed'})`);
    }
  }
  ok('customers, reps and visitors: select, insert, update and delete on user_preferences refused (permission denied)', open.length === 0, open.join('; '));
} catch (e) {
  ok('the i18n test ran to the end', false, e instanceof Error ? e.stack?.split('\n').slice(0, 3).join(' | ') : String(e));
} finally {
  if (cust) await a.from('customers').delete().eq('id', cust.id);
  if (rep) { await a.from('rep_activity').delete().eq('rep_id', rep.id); await a.from('reps').delete().eq('id', rep.id); }
  const ids = users.map((u) => u?.id).filter(Boolean);
  if (ids.length) await a.from('notifications').delete().in('recipient_user_id', ids);
  for (const id of ids) await a.auth.admin.deleteUser(id);
  const left = ids.length ? (await a.from('user_preferences').select('user_id').in('user_id', ids)).data?.length ?? 0 : 0;
  ok('cleaned up: the zz-i18n logins are gone, and their saved choices went with them', left === 0, `${left} left`);
}
