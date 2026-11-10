// Checks the garment template data (families, modules, the 35 types) and, when the SQL has been run, the template column on dev.
// Run: node scripts/e2e/garment-templates.test.mjs   (re-runs itself with the TypeScript loader; needs .env.local only for the last block)
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import fs from 'fs';
if (!process.env.GT_CHILD) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--import', './scripts/e2e/ts-resolve.mjs', fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, GT_CHILD: '1' } });
  process.exit(r.status ?? 1);
}
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const T = await import('../../src/lib/garment-templates.ts');
const D = await import('../../src/lib/garment-types-data.ts');
const { FAMILIES, MODULES, TYPE_TEMPLATES, familyByKey } = T;
const C = await import('../../src/lib/template-catalog.ts'); // task 26: resolving moved here; these checks use the built-in catalog
const resolveTemplate = (k, f) => C.resolveTemplate(k, f, C.BUILT_IN_CATALOG);
const familyKeyFor = (k, f) => C.familyKeyFor(k, f, C.BUILT_IN_CATALOG);

const typeKeys = D.DEFAULT_GARMENT_TYPES.map(t => t.key);
ok("41 garment types (the client's 35 plus 6 from the catalogue) in 3 categories", typeKeys.length === 41 && D.DEFAULT_GARMENT_CATEGORIES.length === 3 && new Set(typeKeys).size === 41 && D.CATALOGUE_TYPES.length === 6);
ok('every type has a template mapping', typeKeys.every(k => TYPE_TEMPLATES[k]), typeKeys.filter(k => !TYPE_TEMPLATES[k]).join(','));
ok('no mapping for a type that does not exist', Object.keys(TYPE_TEMPLATES).every(k => typeKeys.includes(k)));
ok('every mapped family and module exists', Object.values(TYPE_TEMPLATES).every(m => familyByKey(m.family) && (m.modules || []).every(x => MODULES.some(mm => mm.key === x))));
ok('family keys are unique', new Set(FAMILIES.map(f => f.key)).size === FAMILIES.length);
ok('module keys are unique', new Set(MODULES.map(m => m.key)).size === MODULES.length);

const kits = FAMILIES.filter(f => f.composedOf);
ok('kits are made of real, non-kit families', kits.length >= 4 && kits.every(k => k.composedOf.length >= 2 && k.composedOf.every(x => familyByKey(x) && !familyByKey(x).composedOf)));
for (const f of FAMILIES.filter(f => !f.composedOf)) {
  const codes = f.points.map(p => p.code), keys = f.construction.map(c => c.key);
  ok(`${f.key}: at least 3 measurement points, unique codes, all defined`, f.points.length >= 3 && new Set(codes).size === codes.length && f.points.every(p => p.name && p.definition && (p.kind === 'flat' || p.kind === 'length')));
  ok(`${f.key}: checklist keys unique, at least one required item, a size structure and drawing views`, new Set(keys).size === keys.length && f.construction.some(c => c.required) && !!f.sizing.note && f.views.length >= 1);
}
ok('trousers use independent waist and inseam sizing', familyByKey('trousers').sizing.style === 'waist-inseam');
ok('coverall has torso length, crotch depth, chest, sleeve and inseam', ['Torso length', 'Crotch depth', 'Chest', 'Sleeve length', 'Inseam'].every(n => familyByKey('coverall').points.some(p => p.name === n)));
ok('bib overall has bib height and strap length', ['Bib height', 'Strap length'].every(n => familyByKey('bib').points.some(p => p.name === n)));

let allFine = true, noDup = true;
for (const k of typeKeys) { const r = resolveTemplate(k); if (r.checklist.length < 8) allFine = false; if (new Set(r.checklist.map(c => c.key)).size !== r.checklist.length) noDup = false; }
ok('every type resolves to a checklist of 8 or more items', allFine);
ok('no duplicate checklist items after combining common items, family and modules', noDup);
ok('scrubs resolve to a top and pants', resolveTemplate('scrubs').parts.map(p => p.key).join() === 'scrub-top,scrub-pants');
ok('rain suit resolves to jacket and trousers, with the waterproof items', resolveTemplate('rain-suit').parts.map(p => p.key).join() === 'jacket,trousers' && resolveTemplate('rain-suit').checklist.some(c => c.key === 'membrane'));
ok('parka adds insulation items to the jacket', resolveTemplate('parka').checklist.some(c => c.key === 'insulation') && !resolveTemplate('jacket').checklist.some(c => c.key === 'insulation'));
ok('hi-vis vest asks for the reflective tape layout', resolveTemplate('high-visibility-vest').checklist.some(c => c.key === 'tape-layout'));

const protective = ['high-visibility-vest', 'high-visibility-clothing', 'fr-coveralls', 'arc-rated-clothing', 'welding-jacket', 'welding-apron', 'firefighter-turnout-coat', 'firefighter-turnout-pants', 'chemical-protective-suit', 'survival-suit', 'aluminized-suit'];
ok('protective garments list the standards to check and warn that a brand certification does not transfer', protective.every(k => { const p = resolveTemplate(k).protective; return p && p.standards.length >= 1 && /does not transfer/.test(p.evidence); }));
ok('ordinary garments make no protective claim', ['jacket', 'pants', 'work-shirt', 'hoodie', 'scrubs', 'lab-coat'].every(k => resolveTemplate(k).protective === null));
ok('an unknown type uses the general template', resolveTemplate('something-new').family.key === 'generic' && familyKeyFor('something-new') === 'generic');
ok('a family saved on a type wins; an invalid one is ignored', familyKeyFor('something-new', 'coverall') === 'coverall' && familyKeyFor('jacket', 'nope') === 'jacket');
ok('readable names for stored keys', D.garmentTypeLabel('high-visibility-vest') === 'High Visibility Vest' && D.garmentTypeLabel('pants') === 'Work Pants' && D.garmentTypeLabel('some-new-thing') === 'Some New Thing');

// The SQL file (kept outside git) must agree with the code
const sqlPath = 'audit-docs/deliverables/dev-patch-garment-families.sql';
if (fs.existsSync(sqlPath)) {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const rows = [...sql.matchAll(/set template_family = '([^']+)' where key = '([^']+)'/g)];
  ok('the SQL file sets the same family as the code for all 35 types', rows.length === 35 && rows.every(([, f, k]) => TYPE_TEMPLATES[k]?.family === f));
} else console.log('SKIP SQL file check (audit-docs not on this machine)');

// The catalogue SQL file must agree with the code too
const catPath = 'audit-docs/deliverables/dev-patch-garment-types-catalogue.sql';
if (fs.existsSync(catPath)) {
  const rows = [...fs.readFileSync(catPath, 'utf8').matchAll(/\('([^']+)', '([^']+)', '([^']+)', (\d+), '([^']+)'\)/g)];
  ok('the catalogue SQL file matches the code (6 types: key, label, category, sort, family)', rows.length === 6 && rows.every(([, k, l, c, so, f]) => { const t = D.CATALOGUE_TYPES.find(x => x.key === k); return t && t.label === l && t.category === c && t.sort === Number(so) && TYPE_TEMPLATES[k]?.family === f; }));
}

// The column on dev (after dev-patch-garment-families.sql)
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const { createClient } = await import('@supabase/supabase-js');
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const r = await a.from('garment_types').select('key, template_family');
if (r.error) console.log('SKIP template column check (run dev-patch-garment-families.sql on dev first)');
else ok('dev: every garment type has the family the code expects (the 6 catalogue types once their SQL is run)', r.data.length >= 35 && r.data.filter(x => TYPE_TEMPLATES[x.key]).every(x => x.template_family === TYPE_TEMPLATES[x.key].family), r.data.filter(x => TYPE_TEMPLATES[x.key] && x.template_family !== TYPE_TEMPLATES[x.key].family).map(x => x.key).join(','));
