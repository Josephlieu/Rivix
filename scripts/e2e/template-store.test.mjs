// Task 26: templates moved from code into the database, with a general shape and versions. Proves:
// - all 41 types (plus saved families, kits, an unknown type and an invalid family) resolve to EXACTLY what the old code
//   returned (scripts/e2e/fixtures/templates-v1.json, frozen before the change), from the built-in catalog AND from DEV;
// - the database seed equals the code; versions are never edited in place; reps and admins read, nobody writes from the browser;
// - the cache, and the code fallback when the templates cannot be read.
// Run on DEV only, after audit-docs/deliverables/task-26-templates.sql, with `EMAIL_DRY_RUN=1 npm run dev` (or npm start) running:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/template-store.test.mjs
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import { stepUp } from './mfa.mjs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
// Fields added after the frozen file (task 26: certification, versions; task 27: notes, standardCandidates, both empty for older types).
const oldFields = (r) => { const { certification, versions, notes, standardCandidates, ...rest } = r; void certification; void versions; void notes; void standardCandidates; return rest; };

const C = await import('../../src/lib/template-catalog.ts');
const T = await import('../../src/lib/garment-templates.ts');
const fx = JSON.parse(fs.readFileSync('scripts/e2e/fixtures/templates-v1.json', 'utf8'));
const typeKeys = Object.keys(T.TYPE_TEMPLATES); // the 41 older types (task 27 adds 42 more: categories-templates.test.mjs)
const compareAll = (catalog) => fx.cases.filter((c) => canon(oldFields(C.resolveTemplate(c.typeKey, c.savedFamily, catalog))) !== canon(c.resolved)).map((c) => `${c.typeKey}/${c.savedFamily}`);

// --- old vs new, offline (built-in catalog = the code fallback)
ok('the frozen "before" file covers all 41 types', typeKeys.length === 41 && typeKeys.every((k) => fx.cases.some((c) => c.typeKey === k && c.savedFamily === null)), `${fx.cases.length} cases`);
let diff = compareAll(C.BUILT_IN_CATALOG);
ok('built-in catalog: every case resolves exactly as the old code did (41 types, every family, unknown type, invalid family)', diff.length === 0, diff.slice(0, 5).join(' '));

// --- certification levels (decided 2026-11-10)
const lvl = (k) => C.resolveTemplate(k, null, C.BUILT_IN_CATALOG).certification;
ok('certification: plain garments are "described"', ['jacket', 'vest', 'parka', 'rain-jacket', 'scrubs', 'pants'].every((k) => lvl(k) === 'described'));
ok('certification: hi-vis, FR, arc, welding and disposable need test evidence', ['high-visibility-vest', 'fr-coveralls', 'arc-rated-clothing', 'welding-jacket', 'disposable-coveralls', 'high-visibility-clothing'].every((k) => lvl(k) === 'needs-test-evidence'));
ok('certification: firefighter, chemical, immersion and aluminized are certified equipment', ['firefighter-turnout-coat', 'firefighter-turnout-pants', 'chemical-protective-suit', 'survival-suit', 'aluminized-suit'].every((k) => lvl(k) === 'certified-equipment'));
const v = C.resolveTemplate('high-visibility-vest', null, C.BUILT_IN_CATALOG).versions;
ok('a resolved template lists the versions it used (base, family, modules)', canon(v) === canon([{ key: 'garment-base', version: 1 }, { key: 'vest', version: 1 }, { key: 'hivis', version: 1 }]), canon(v));

// --- the general shape
const body = (k) => C.BUILT_IN_TEMPLATES.find((t) => t.key === k).body;
ok('every template has all sections (empty where they do not apply)', C.BUILT_IN_TEMPLATES.every((t) => ['points', 'items', 'sizing', 'views', 'protective', 'certification'].every((s) => s in t.body)));
ok('points carry a "how to measure" note; items say spec or construction, photo or document, required or not', body('jacket').points.every((p) => p.howToMeasure && p.method) && C.BUILT_IN_TEMPLATES.flatMap((t) => t.body.items).every((i) => ['spec', 'construction'].includes(i.section) && ['photo', 'document'].includes(i.source) && typeof i.required === 'boolean'));
ok('templates are 2 bases, 34 families and 20 modules (task 26: 1, 24, 11; task 27 adds 1, 10, 9)', C.BUILT_IN_TEMPLATES.length === 56 && C.BUILT_IN_TEMPLATES.filter((t) => t.kind === 'base').length === 2 && C.BUILT_IN_TEMPLATES.filter((t) => t.kind === 'family').length === 34 && C.BUILT_IN_TEMPLATES.filter((t) => t.kind === 'module').length === 20);
ok('the older types have no notes and no standard candidates (nothing new on their screens)', typeKeys.every((k) => { const r = C.resolveTemplate(k, null, C.BUILT_IN_CATALOG); return r.notes.length === 0 && r.standardCandidates.length === 0; }));

// --- the cache and the code fallback (a fake database, no network)
const S = await import('../../src/lib/template-store.ts');
const fakeDb = (rows, counter) => ({ from: (table) => ({ select: () => { counter.n++; return Promise.resolve(rows[table] ? { data: rows[table], error: null } : { data: null, error: { message: `relation "${table}" does not exist` } }); } }) });
let calls = { n: 0 };
S.clearTemplateCache();
let cat = await S.getTemplateCatalog(fakeDb({}, calls));
ok('templates table missing: the code fallback is used (the scan and the PDF keep working)', cat.source === 'built-in' && compareAll(cat).length === 0);
const real = {
  templates: C.BUILT_IN_TEMPLATES.map((t) => ({ key: t.key, kind: t.kind, label: t.label, description: t.description, current_version: 1, active: true })),
  template_versions: C.BUILT_IN_TEMPLATES.map((t) => ({ template_key: t.key, version: 1, body: t.body })),
  garment_types: typeKeys.map((k) => ({ key: k, category: 'outerwear', template_family: T.TYPE_TEMPLATES[k].family, template_modules: T.TYPE_TEMPLATES[k].modules ?? [] })),
  garment_categories: [{ key: 'outerwear', base_template: 'garment-base' }],
};
S.clearTemplateCache(); calls = { n: 0 };
cat = await S.getTemplateCatalog(fakeDb(real, calls));
const first = calls.n;
await S.getTemplateCatalog(fakeDb(real, calls));
ok('database readable: catalog from the database, and a second read within 60 s does not query it again', cat.source === 'database' && first === 4 && calls.n === 4, `${calls.n} queries`);
S.clearTemplateCache(); await S.getTemplateCatalog(fakeDb(real, calls));
ok('clearing the cache reads the database again (an admin change)', calls.n === 8);
const bumped = { ...real, templates: real.templates.map((t) => (t.key === 'vest' ? { ...t, current_version: 2 } : t)), template_versions: [...real.template_versions, { template_key: 'vest', version: 2, body: { ...body('vest'), points: [] } }] };
S.clearTemplateCache(); cat = await S.getTemplateCatalog(fakeDb(bumped, { n: 0 }));
ok('only the CURRENT version of a template is used (an older version stays for old tech files)', C.resolveTemplate('vest', null, cat).family.points.length === 0 && C.resolveTemplate('vest', null, cat).versions.some((x) => x.key === 'vest' && x.version === 2));
S.clearTemplateCache();

// --- DEV database
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, A = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a = createClient(U, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now();
const mk = async (e, x) => (await a.auth.admin.createUser({ email: e, password: pw, email_confirm: true, ...(x ? { app_metadata: x } : {}) })).data.user;
const adm = await mk(`zz-tpl-a-${t}@yopmail.com`, { role: 'admin' }), ru = await mk(`zz-tpl-r-${t}@yopmail.com`, { role: 'rep' }), roff = await mk(`zz-tpl-off-${t}@yopmail.com`, { role: 'rep' }), cu = await mk(`zz-tpl-c-${t}@yopmail.com`);
const { data: rep } = await a.from('reps').insert({ name: 'ZZ TPL Rep', email: ru.email, user_id: ru.id }).select().single();
const { data: repOff } = await a.from('reps').insert({ name: 'ZZ TPL Off', email: roff.email, user_id: roff.id, active: false }).select().single();
const { data: c } = await a.from('customers').insert({ user_id: cu.id, company_name: 'ZZ TPL Co', contact_email: cu.email, customer_code: '' }).select().single();
const signIn = async (e) => { const s = createClient(U, A, { auth: { persistSession: false } }); await s.auth.signInWithPassword({ email: e, password: pw }); return s; };
const cookie = async (e) => { const j = new Map(); const sb = createServerClient(U, A, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } }); const x = await sb.auth.signInWithPassword({ email: e, password: pw }); if (x.error) throw x.error; await stepUp(sb); return [...j].map(([k, v]) => `${k}=${v}`).join('; '); };
const call = (m, url, ck, b) => fetch('http://localhost:10001' + url, { method: m, headers: { 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}) }, body: b ? JSON.stringify(b) : undefined, redirect: 'manual' });
let zzType = null;
try {
  // seed = code
  const { data: trows } = await a.from('templates').select('key, kind, label, description, current_version');
  const { data: vrows } = await a.from('template_versions').select('template_key, version, body').eq('version', 1);
  ok('DEV has all the templates at version 1 (36 from task 26, 20 from task 27)', trows?.length >= 36 && C.BUILT_IN_TEMPLATES.every((x) => trows.some((r) => r.key === x.key && r.kind === x.kind && r.current_version >= 1)));
  const mismatch = C.BUILT_IN_TEMPLATES.filter((x) => { const r = vrows.find((y) => y.template_key === x.key); return !r || canon(r.body) !== canon(x.body); }).map((x) => x.key);
  ok('every version 1 body in the database equals the code', mismatch.length === 0, mismatch.join(','));
  const { data: grows } = await a.from('garment_types').select('key, template_family, template_modules');
  ok("every type's family and add-on modules in the database match the code", typeKeys.every((k) => { const r = grows.find((x) => x.key === k); return r && r.template_family === T.TYPE_TEMPLATES[k].family && canon(r.template_modules) === canon(T.TYPE_TEMPLATES[k].modules ?? []); }));
  const up = await a.from('template_versions').update({ created_by: 'edited' }).eq('template_key', 'jacket').eq('version', 1);
  ok('a template version can never be edited in place, not even by the server', !!up.error && /never edited/.test(up.error.message));
  const del = await a.from('template_versions').delete().eq('template_key', 'jacket').eq('version', 1);
  ok('  nor deleted', !!del.error && (await a.from('template_versions').select('version').eq('template_key', 'jacket').eq('version', 1)).data?.length === 1);
  const sqlFile = 'audit-docs/deliverables/task-26-templates.sql';
  if (fs.existsSync(sqlFile)) ok('the SQL seed file has the same 36 templates', (fs.readFileSync(sqlFile, 'utf8').match(/^insert into public\.template_versions /gm) || []).length === 36);

  // who may read (row security)
  const counts = async (s) => (await s.from('templates').select('key')).data?.length ?? 0;
  ok('an admin can read the templates directly', (await counts(await signIn(adm.email))) >= 36);
  ok('an active rep can read them', (await counts(await signIn(ru.email))) >= 36);
  ok('an inactive rep cannot', (await counts(await signIn(roff.email))) === 0);
  ok('a customer cannot', (await counts(await signIn(cu.email))) === 0);
  ok('the public key cannot', (await counts(createClient(U, A, { auth: { persistSession: false } }))) === 0);
  const jacketLabel = (await a.from('templates').select('label').eq('key', 'jacket').single()).data.label;
  for (const [n, e] of [['an admin', adm.email], ['a rep', ru.email]]) {
    const s = await signIn(e);
    const ins = await s.from('templates').insert({ key: `zz-${t}`, kind: 'family', label: 'x' });
    const insV = await s.from('template_versions').insert({ template_key: 'jacket', version: 99, body: {} });
    await s.from('templates').update({ label: 'Hacked' }).eq('key', 'jacket');
    ok(`${n} cannot add or change templates from the browser`, !!ins.error && !!insV.error && (await a.from('templates').select('label').eq('key', 'jacket').single()).data.label === jacketLabel, jacketLabel);
  }

  // the API (admins and reps) resolves from the DATABASE exactly as the old code did
  const ac = await cookie(adm.email), rc = await cookie(ru.email), cc = await cookie(cu.email);
  let r = await call('GET', '/api/replications/garment-types', ac); let j = await r.json();
  ok('the API gives admins the template catalog, read from the database', r.status === 200 && j.templates?.source === 'database' && j.templates.templates.length >= 36, j.templates?.source);
  diff = compareAll(j.templates);
  ok('DATABASE catalog: every case resolves exactly as the old code did (all 41 types, every family, unknown type, invalid family)', diff.length === 0, diff.slice(0, 5).join(' '));
  const savedDiff = typeKeys.filter((k) => { const fam = j.types.find((x) => x.key === k)?.templateFamily ?? null; const f = fx.cases.find((x) => x.typeKey === k && x.savedFamily === null); return canon(oldFields(C.resolveTemplate(k, fam, j.templates))) !== canon(f.resolved); });
  ok("  and with each type's saved family, as the screens and the scan call it", savedDiff.length === 0, savedDiff.join(','));
  r = await call('GET', '/api/replications/garment-types', rc); j = await r.json();
  ok('a rep gets the catalog too', r.status === 200 && j.templates?.templates?.length >= 36);
  for (const [n, ck] of [['customer', cc], ['signed-out', null]]) { r = await call('GET', '/api/replications/garment-types', ck); ok(`a ${n} gets no catalog`, r.status === 401 || r.status === 403); }

  // an admin change to a type clears the server's cache
  r = await call('POST', '/api/admin/garment-types', ac, { label: `ZZ TPL Type ${t}`, category: 'outerwear', templateFamily: 'vest' }); j = await r.json();
  zzType = j.type?.key || (await a.from('garment_types').select('key').ilike('label', `ZZ TPL Type ${t}`).maybeSingle()).data?.key;
  r = await call('GET', '/api/replications/garment-types', ac); j = await r.json();
  ok('an admin-made type appears in the catalog with its family and no add-ons', !!zzType && j.templates.types[zzType]?.family === 'vest' && canon(j.templates.types[zzType].modules) === '[]', zzType);
  await a.from('garment_types').update({ template_modules: ['hivis'] }).eq('key', zzType);
  r = await call('GET', '/api/replications/garment-types', ac); j = await r.json();
  ok('a change made outside the app shows only after the cache expires (cached up to 60 s)', canon(j.templates.types[zzType].modules) === '[]');
  r = await call('PATCH', `/api/admin/garment-types/${zzType}`, ac, { active: true });
  r = await call('GET', '/api/replications/garment-types', ac); j = await r.json();
  ok('an admin change on a type clears the cache at once', canon(j.templates.types[zzType]?.modules) === '["hivis"]', canon(j.templates.types[zzType]?.modules));
  ok('  and that type now resolves with the hi-vis add-on and its certification level', C.resolveTemplate(zzType, 'vest', j.templates).certification === 'needs-test-evidence');
  r = await call('POST', '/api/admin/garment-types', ac, { label: `ZZ Bad ${t}`, category: 'outerwear', templateFamily: 'no-such-template' });
  ok('a family that is not a template is refused', r.status === 400);
  const page = await fetch('http://localhost:10001/admin/replication/garment-types', { headers: { Cookie: ac } }); ok('the Garment types screen loads', page.status === 200);
} catch (e) { console.log('ERROR', e); } finally {
  if (zzType) await a.from('garment_types').delete().eq('key', zzType);
  await a.from('garment_types').delete().ilike('label', `ZZ Bad ${t}%`);
  await a.from('customers').delete().eq('id', c.id); await a.from('reps').delete().in('id', [rep.id, repOff.id]);
  for (const u of [adm, ru, roff, cu]) await a.auth.admin.deleteUser(u.id);
  console.log('cleaned');
}
