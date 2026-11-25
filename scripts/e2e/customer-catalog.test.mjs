// Customer catalogue and quote cart, built around product families (2026-11-26, approved). Proves:
//   - offline: the spec, sizes, minimum (49 refused, 50/299 with a note, 300 without) and settings (1 to 50) rules; which
//     standards customers may see (only a Compliant third-party certificate or accredited lab report of an ACTIVE linked
//     product, this exact edition); image types by content; customer text stays plain text in emails (escaped, never
//     linkified); no dangerouslySetInnerHTML in src/ (except the static style block in the root layout); no rep or admin
//     route reads unsubmitted carts;
//   - live on the TEST project: unpublished/inactive families are invisible; no supplier, product, cost, price, margin or
//     factory data in any customer or rep response; customer A cannot read, change, delete or submit customer B's cart lines,
//     saved families or sample requests by changing an id; reps see only their own customers' submitted quote and sample
//     requests and NO cart data (nor do admins); images re-encoded (a JPEG with GPS comes back with no EXIF at all); submit
//     is atomic (two at once: 1 request, 1 notification, the other "already submitted"); an unpublished
//     family is refused at submit and named; hostile text (<script>, <img onerror>, markdown/HTML) is stored exactly and
//     rendered escaped on the boards and the New Order form; customers, reps and visitors have no rights on the 8 tables;
//     every admin and rep change writes exactly one audit row.
// Test project only ("ZZ CAT" data, zz-cat logins, deleted at the end; audit rows stay). Needs the server on port 10001,
// EMAIL_DRY_RUN=1. The limits (10 images, 25 lines, 10 open samples) are in customer-catalog-limits.test.mjs.
import { env as E2E_ENV } from './env.mjs'; // the test project only (guarded), never Development
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { stepUp } from './mfa.mjs';
const require = createRequire(import.meta.url);
const { createServerClient } = require('@supabase/ssr');
const sharp = require('sharp');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);

const F = await import('../../src/lib/catalog-families.ts');
const IMG = await import('../../src/lib/image-files.ts');
const EM = await import('../../src/lib/order-request-emails.ts');

// =====================================================================================================================
// Offline
// =====================================================================================================================
const HOSTILE = '<script>alert(1)</script> <img src=x onerror=alert(2)> **bold** [x](javascript:alert(3)) <b>html</b> https://zz-evil.example/x';
const fam = { typical_options: [{ label: 'Fabric', choices: ['Nitrile 4 mil', 'Nitrile 8 mil'] }, { label: 'Cuff', choices: ['Beaded'] }] };
let r = F.checkSpec({ options: { Fabric: 'Nitrile 8 mil', Cuff: 'Other: extended 30 cm' }, colour: 'Blue', standard: 'EN 374', details: HOSTILE }, fam, ['EN 374']);
ok('spec: listed choices, "Other: …", colour, a shown standard; customer text kept exactly as typed', r.value && r.value.options.length === 2 && r.value.options[1].value === 'Other: extended 30 cm' && r.value.details === HOSTILE, JSON.stringify(r).slice(0, 200));
ok('spec: an unlisted choice, an unknown group, a standard not shown, NUL characters and over-long text are refused', ['error' in F.checkSpec({ options: { Fabric: 'Latex' } }, fam, []), 'error' in F.checkSpec({ options: { Colour: 'x' } }, fam, []), 'error' in F.checkSpec({ standard: 'EN 999' }, fam, ['EN 374']), 'error' in F.checkSpec({ details: 'a\u0000b' }, fam, []), 'error' in F.checkSpec({ details: 'x'.repeat(2001) }, fam, [])].every(Boolean));
ok('sizes: empty boxes skipped; whole numbers 1 to 1,000,000; no duplicates', F.checkSizes([{ size: 'M', qty: 10 }, { size: 'L', qty: '' }, { size: 'XL', qty: 0 }]).value?.length === 1 && 'error' in F.checkSizes([{ size: 'M', qty: 1.5 }]) && 'error' in F.checkSizes([{ size: 'M', qty: 1 }, { size: 'm', qty: 2 }]) && 'error' in F.checkSizes([]));
const S = { min_order_qty: 50, note_below_qty: 300 };
ok('minimum: 49 refused; 50 and 299 allowed with a gentle note; 300 allowed without', !F.minimumCheck(49, S).ok && F.minimumCheck(50, S).ok && F.minimumCheck(50, S).note && F.minimumCheck(299, S).note && F.minimumCheck(300, S).ok && F.minimumCheck(300, S).note === null);
ok('settings: the minimum is 1 to 50 (never block above 50); the note level at or above it', 'error' in F.checkSettings({ min_order_qty: 51 }, S) && 'error' in F.checkSettings({ min_order_qty: 0 }, S) && 'error' in F.checkSettings({ min_order_qty: 40, note_below_qty: 30 }, S) && F.checkSettings({ min_order_qty: 1 }, S).value?.min_order_qty === 1 && F.checkSettings({ min_order_qty: 50, note_below_qty: 500 }, S).value?.note_below_qty === 500);
ok('options: at most 12 groups of 20 choices; duplicate group names refused', 'error' in F.checkOptions(Array.from({ length: 13 }, (_, i) => ({ label: `G${i}`, choices: ['a'] }))) && 'error' in F.checkOptions([{ label: 'A', choices: Array.from({ length: 21 }, (_, i) => `c${i}`) }]) && 'error' in F.checkOptions([{ label: 'A', choices: ['x'] }, { label: 'a', choices: ['y'] }]));
// Which standards customers see.
const T = '2026-11-26';
const fs_ = (id, checked = true) => ({ standard_id: id, designation: `D-${id}`, checked });
const cert = (o) => ({ product_id: 'P1', standard_id: 'OK', status: 'verified', expires_on: '2030-01-01', document_type: 'third_party_certificate', ...o });
const shown = F.backedStandards(
  [fs_('OK'), fs_('LAB'), fs_('DECL'), fs_('UPL'), fs_('EXP'), fs_('UNCHK', false), fs_('WRONG'), fs_('INACT')],
  [{ id: 'P1', active: true }, { id: 'P2', active: false }],
  ['OK', 'LAB', 'DECL', 'UPL', 'EXP', 'UNCHK', 'OLD'].map((s) => ({ product_id: 'P1', standard_id: s })).concat([{ product_id: 'P2', standard_id: 'INACT' }]),
  [cert({ standard_id: 'OK' }), cert({ standard_id: 'LAB', document_type: 'accredited_lab_report' }), cert({ standard_id: 'DECL', document_type: 'manufacturer_declaration' }), cert({ standard_id: 'UPL', status: 'uploaded' }), cert({ standard_id: 'EXP', expires_on: '2026-11-25' }), cert({ standard_id: 'UNCHK' }), cert({ standard_id: 'OLD' }), cert({ product_id: 'P2', standard_id: 'INACT' })],
  T);
ok('standards shown: only a Compliant third-party certificate or lab report (not a declaration, uploaded, expired, unchecked, wrong-edition or inactive-product one)', JSON.stringify(shown) === JSON.stringify(['D-OK', 'D-LAB']), JSON.stringify(shown));
ok('images: JPEG, PNG and WebP by content; a PDF and an HTML file named .png are refused', IMG.checkImageFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).type === 'image/jpeg' && IMG.checkImageFile(Buffer.from('RIFF0000WEBPVP8 ')).type === 'image/webp' && 'error' in IMG.checkImageFile(Buffer.from('%PDF-1.4')) && 'error' in IMG.checkImageFile(Buffer.from('<html>')));
// Emails: customer text escaped, never turned into links.
const spec = { options: [{ label: 'Fabric', value: HOSTILE.slice(0, 80) }], colour: '<b>Red</b>', standard: null, branding: HOSTILE, details: HOSTILE };
const em = EM.orderRequestEmail({ to: 'rep@example.com', handler: 'rep', company: 'ZZ Co', kind: 'quote', items: [{ product_name: '<i>Glove</i>', sizes: [{ size: 'M', qty: 60 }], branding: HOSTILE, spec }], note: HOSTILE });
const sm = EM.sampleRequestEmail({ to: 'rep@example.com', handler: 'rep', company: 'ZZ Co', family: 'Glove', quantity: 2, spec, note: HOSTILE });
for (const [n, m] of [['quote email', em], ['sample email', sm]]) {
  ok(`${n}: hostile customer text is escaped (no <script, no <img src=x, no <b>/<i> from the customer; &lt;script&gt; shown)`, !/<script/i.test(m.html) && !/<img src=x/i.test(m.html) && !m.html.includes('<b>Red</b>') && !m.html.includes('<i>Glove</i>') && !m.html.includes('<b>html</b>') && m.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && m.html.includes('&lt;img src=x onerror=alert(2)&gt;'));
  ok(`${n}: no link is made from customer text (no javascript: and no zz-evil link)`, !/href="javascript:/i.test(m.html) && !/<a [^>]*zz-evil/.test(m.html) && m.text.includes(HOSTILE));
}
// Source checks.
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(tsx?|mjs)$/.test(e.name) ? [path.join(d, e.name)] : []));
const inner = walk('src').filter((f) => /dangerouslySetInnerHTML/.test(fs.readFileSync(f, 'utf8')));
ok('no dangerouslySetInnerHTML anywhere in src/ except the static style block of the root layout', inner.length === 1 && inner[0] === path.join('src', 'app', 'layout.tsx'), inner.join(', '));
const cartReaders = walk('src').filter((f) => /quote_draft/.test(fs.readFileSync(f, 'utf8'))).map((f) => f.split(path.sep).join('/')).sort();
ok('only the customer\'s own cart code reads carts (src/lib/quote-cart.ts and /api/portal/quote-cart); no rep or admin route', cartReaders.every((f) => f === 'src/lib/quote-cart.ts' || f.startsWith('src/app/api/portal/quote-cart/')), cartReaders.join(', '));
ok('no rep or admin cart route exists (/api/rep/quote-carts, /api/admin/quote-carts)', !fs.existsSync('src/app/api/rep/quote-carts') && !fs.existsSync('src/app/api/admin/quote-carts'));

// =====================================================================================================================
// Live, on the test project
// =====================================================================================================================
const env = E2E_ENV;
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const a = createClient(U, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(U, AK, { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now(), tag = String(t).slice(-6), started = new Date(Date.now() - 5000).toISOString();
const users = [];
const mk = async (n, meta) => { const u = (await a.auth.admin.createUser({ email: `zz-cat-${n}-${t}@yopmail.com`, password: pw, email_confirm: true, ...(meta ? { app_metadata: meta } : {}) })).data.user; users.push(u); return u; };
const signIn = async (email, two = false) => { const j = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } }); const x = await sb.auth.signInWithPassword({ email, password: pw }); if (x.error) throw x.error; if (two) await stepUp(sb); return { sb, cookie: [...j].map(([k, v]) => `${k}=${v}`).join('; ') }; };
const call = async (m, url, ck, body) => { const res = await fetch('http://localhost:10001' + url, { method: m, headers: { 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }); const text = await res.text(); let j = {}; try { j = JSON.parse(text); } catch { /* page */ } return { status: res.status, j, text, location: res.headers.get('location') }; };
const auditRows = async (action, id) => (await a.from('audit_log').select('id, after, before').eq('action', action).eq('record_id', String(id)).gte('at', started)).data ?? [];
const seen = []; // every customer and rep JSON response, scanned for supplier data at the end
const as = async (who, ...args) => { const x = await call(...args); if (who === 'customer' || who === 'rep') seen.push(`${args[1]} ${x.text}`); return x; };
const IMG_BUCKET = 'product-images';
const ids = { families: [], standards: [], products: [], suppliers: [], customers: [], reps: [] };
let restoreSettings = null;

try {
  const adm = await mk('a', { role: 'admin' }), ru1 = await mk('r1', { role: 'rep' }), ru2 = await mk('r2', { role: 'rep' });
  const cuA = await mk('ca'), cuB = await mk('cb'), cuC = await mk('cc');
  const rep1 = (await a.from('reps').insert({ name: 'ZZ CAT Rep 1', email: ru1.email, user_id: ru1.id, active: true }).select('id').single()).data; ids.reps.push(rep1.id);
  const rep2 = (await a.from('reps').insert({ name: 'ZZ CAT Rep 2', email: ru2.email, user_id: ru2.id, active: true }).select('id').single()).data; ids.reps.push(rep2.id);
  const cA = (await a.from('customers').insert({ user_id: cuA.id, company_name: 'ZZ CAT Alpha', contact_email: cuA.email, customer_code: '', rep_id: rep1.id }).select('id').single()).data;
  const cB = (await a.from('customers').insert({ user_id: cuB.id, company_name: 'ZZ CAT Bravo', contact_email: cuB.email, customer_code: '', rep_id: rep2.id }).select('id').single()).data;
  const cC = (await a.from('customers').insert({ user_id: cuC.id, company_name: 'ZZ CAT Charlie', contact_email: cuC.email, customer_code: '', rep_id: rep1.id }).select('id').single()).data;
  ids.customers.push(cA.id, cB.id, cC.id);
  const A = await signIn(adm.email, true), R1 = await signIn(ru1.email), R2 = await signIn(ru2.email), CA = await signIn(cuA.email), CB = await signIn(cuB.email), CC = await signIn(cuC.email);
  const ac = A.cookie;
  restoreSettings = (await a.from('catalog_settings').select('min_order_qty, note_below_qty').eq('id', 1).single()).data;

  // ---- Rights: customers, reps and visitors get nothing on the 8 tables -------------------------------------------------
  const TABLES = { product_families: 'id', family_images: 'id', family_standards: 'family_id', catalog_settings: 'id', quote_drafts: 'id', quote_draft_lines: 'id', saved_families: 'customer_id', sample_requests: 'id' };
  for (const [n, s] of [['customer', CA.sb], ['rep', R1.sb], ['visitor (anon)', anon]]) {
    const open = [];
    for (const [tb, col] of Object.entries(TABLES)) {
      for (const [k, q] of [['select', () => s.from(tb).select(col).limit(1)], ['insert', () => s.from(tb).insert({ [col]: null })], ['update', () => s.from(tb).update({ [col]: null }).is(col, null)], ['delete', () => s.from(tb).delete().is(col, null)]]) {
        const x = await q(); if (!x.error || x.error.code !== '42501') open.push(`${k} ${tb} (${x.error?.code ?? 'allowed'})`);
      }
    }
    ok(`${n}: select, insert, update and delete refused (permission denied) on all 8 catalogue tables`, open.length === 0, open.slice(0, 4).join('; '));
  }

  // ---- Admin: families, a supplier product behind them, standards -------------------------------------------------------
  const famBody = (code, name, extra = {}) => ({ code, name, category: 'gloves', description: `ZZ CAT ${name}`, typical_sizes: 'S; M; L', typical_colours: 'Blue; Black', typical_options: [{ label: 'Fabric', choices: ['Nitrile 4 mil', 'Nitrile 8 mil'] }], ...extra });
  let x = await call('POST', '/api/admin/families', ac, famBody(`ZZ${tag}-GLV`, 'ZZ CAT Nitrile glove'));
  const F1 = x.j.family; ids.families.push(F1?.id);
  ok('admin: a family is created hidden (not published); one family.create row', x.status === 201 && F1.visible_to_customers === false && (await auditRows('family.create', F1.id)).length === 1, x.j.error ?? '');
  x = await call('POST', '/api/admin/families', ac, famBody(`zz${tag}-glv`, 'dup'));
  ok('admin: the same code (any capitals) is refused; codes are capitals, digits and dashes', x.status === 409 && (await call('POST', '/api/admin/families', ac, famBody('bad code!', 'x'))).status === 400);
  const F2 = (await call('POST', '/api/admin/families', ac, famBody(`ZZ${tag}-TOQ`, 'ZZ CAT Knit toque', { typical_sizes: '', typical_options: [] }))).j.family; ids.families.push(F2.id);
  const F3 = (await call('POST', '/api/admin/families', ac, famBody(`ZZ${tag}-HID`, 'ZZ CAT Hidden family'))).j.family; ids.families.push(F3.id);
  const F4 = (await call('POST', '/api/admin/families', ac, famBody(`ZZ${tag}-OFF`, 'ZZ CAT Switched off family'))).j.family; ids.families.push(F4.id);
  for (const f of [F1, F2, F4]) await call('PATCH', `/api/admin/families/${f.id}`, ac, { visible_to_customers: true });
  await call('PATCH', `/api/admin/families/${F4.id}`, ac, { active: false });
  ok('admin: publishing writes one family.publish row (no family.edit row)', (await auditRows('family.publish', F1.id)).length === 1 && (await auditRows('family.edit', F1.id)).length === 0);
  x = await call('PATCH', `/api/admin/families/${F1.id}`, ac, { description: 'ZZ CAT Nitrile glove, made to your spec' });
  ok('admin: an edit writes one family.edit row with only the changed field', x.status === 200 && (await auditRows('family.edit', F1.id)).length === 1 && JSON.stringify((await auditRows('family.edit', F1.id))[0].after) === '{"description":"ZZ CAT Nitrile glove, made to your spec"}');

  // Supplier data that must never reach a customer or rep.
  const SECRET = { supplier: `ZZ CAT Secret Factory ${tag}`, sku: `ZZ-SKU-SECRET-${tag}`, web: `https://zz-cat-secret-${tag}.example.org`, note: `ZZ CAT internal note ${tag}`, origin: `ZZ-Origin-${tag}`, pcode: `ZZ-CAT-PROD-${tag}` };
  const sup = (await a.from('suppliers').insert({ code: `Supplier ${String(t).slice(-4)}`, name: SECRET.supplier, website: SECRET.web, notes: SECRET.note }).select('id, code').single()).data; ids.suppliers.push(sup.id);
  const P1 = (await a.from('products').insert({ code: SECRET.pcode, name: `ZZ CAT Product ${tag}`, sourcing: 'made_to_spec', category: 'gloves', country_of_origin: SECRET.origin, notes: SECRET.note, family_id: F1.id }).select('id').single()).data; ids.products.push(P1.id);
  const P2 = (await a.from('products').insert({ name: `ZZ CAT Inactive product ${tag}`, sourcing: 'made_to_spec', active: false, family_id: F1.id }).select('id').single()).data; ids.products.push(P2.id);
  await a.from('product_suppliers').insert({ product_id: P1.id, supplier_id: sup.id, supplier_sku: SECRET.sku });
  const std = async (n, checked = true) => { const d = (await a.from('standards').insert({ designation: `ZZ CAT ${n} ${tag}`, ...(checked ? { standard: n, edition: '2016', checked: true, checked_on: '2026-11-20', checked_by_email: 'zz' } : {}) }).select('id, designation').single()).data; ids.standards.push(d.id); return d; };
  const st = { ok: await std('OK'), lab: await std('LAB'), decl: await std('DECL'), upl: await std('UPL'), exp: await std('EXP'), unchk: await std('UNCHK', false), wrong: await std('WRONG2016'), old: await std('WRONG2003'), inact: await std('INACT') };
  for (const k of ['ok', 'lab', 'decl', 'upl', 'exp', 'unchk', 'old']) await a.from('product_compliance').insert({ product_id: P1.id, standard_id: st[k].id });
  await a.from('product_compliance').insert({ product_id: P2.id, standard_id: st.inact.id });
  const cert = (pid, sid, o = {}) => ({ product_id: pid, standard_id: sid, file_path: `zz-cat/${tag}/${sid}/${Math.random()}`, file_name: 'x.pdf', file_size: 1, mime_type: 'application/pdf', file_sha256: 'a'.repeat(64), document_type: 'third_party_certificate', issuing_body: 'ZZ Lab', expires_on: '2030-12-31', status: 'verified', verified_by: adm.id, verified_by_email: 'zz', verified_at: new Date().toISOString(), ...o });
  const certs = await a.from('certificates').insert([
    cert(P1.id, st.ok.id), cert(P1.id, st.lab.id, { document_type: 'accredited_lab_report' }), cert(P1.id, st.decl.id, { document_type: 'manufacturer_declaration' }),
    cert(P1.id, st.upl.id, { status: 'uploaded', verified_by: null, verified_by_email: null, verified_at: null }), cert(P1.id, st.exp.id, { expires_on: '2026-01-31' }),
    cert(P1.id, st.unchk.id), cert(P1.id, st.old.id), cert(P2.id, st.inact.id),
  ]);
  ok('setup: 8 certificate rows for the standards cases', !certs.error, certs.error?.message);
  for (const k of ['ok', 'lab', 'decl', 'upl', 'exp', 'unchk', 'wrong', 'inact']) await call('POST', `/api/admin/families/${F1.id}/standards`, ac, { standard_id: st[k].id });
  ok('admin: each standard listed writes one family_standard.add row', (await auditRows('family_standard.add', `${F1.id}:${st.ok.id}`)).length === 1 && (await auditRows('family_standard.add', `${F1.id}:${st.inact.id}`)).length === 1);
  x = await call('GET', `/api/admin/families/${F1.id}`, ac);
  ok('admin: the family page marks only OK and LAB as shown to customers ("No certified product behind" the other 6)', x.j.standards?.filter((s) => s.shownToCustomers).map((s) => s.id).sort().join() === [st.ok.id, st.lab.id].sort().join() && x.j.standards.length === 8);

  // ---- Images: re-encoded (no EXIF/GPS), JPEG/PNG/WebP only, at most 10 -------------------------------------------------
  const uploadImage = async (bytes, name, contentType) => {
    const u = await call('POST', `/api/admin/families/${F1.id}/images/upload-url`, ac, { size: bytes.length });
    if (u.status !== 200) return u;
    const up = await anon.storage.from(IMG_BUCKET).uploadToSignedUrl(u.j.path, u.j.token, bytes, { contentType });
    if (up.error) return { status: 0, j: { error: up.error.message } };
    return call('POST', `/api/admin/families/${F1.id}/images`, ac, { path: u.j.path, file_name: name, alt_text: 'ZZ' });
  };
  const gpsJpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 20, b: 20 } } }).jpeg()
    .withExif({ IFD0: { Make: 'ZZCam', ImageDescription: `ZZ-SECRET-PLACE-${tag}` }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '49/1 15/1 30/1', GPSLongitudeRef: 'W', GPSLongitude: '123/1 6/1 0/1' } }).toBuffer();
  const srcMeta = await sharp(gpsJpeg).metadata();
  ok('the test JPEG really carries EXIF with the GPS pointer (either byte order) and a marker text', !!srcMeta.exif && (srcMeta.exif.includes(Buffer.from([0x88, 0x25])) || srcMeta.exif.includes(Buffer.from([0x25, 0x88]))) && gpsJpeg.includes(`ZZ-SECRET-PLACE-${tag}`));
  x = await uploadImage(gpsJpeg, 'zz-gps.jpg', 'image/jpeg');
  const img1 = x.j.image;
  const stored = img1 ? (await a.from('family_images').select('file_path, file_sha256').eq('id', img1.id).single()).data : null;
  const blob = stored ? (await a.storage.from(IMG_BUCKET).download(stored.file_path)).data : null;
  const back = blob ? Buffer.from(await blob.arrayBuffer()) : Buffer.alloc(0);
  const backMeta = back.length ? await sharp(back).metadata() : {};
  ok('image: the stored file has no EXIF, GPS, XMP, IPTC or ICC data, and not the marker text', x.status === 201 && back.length > 0 && !backMeta.exif && !backMeta.xmp && !backMeta.iptc && !backMeta.icc && !back.includes(Buffer.from('Exif\0\0')) && !back.includes(`ZZ-SECRET-PLACE-${tag}`) && backMeta.format === 'jpeg', `${x.status} ${x.j.error ?? ''}`);
  ok('  one family_image.upload audit row; the stored SHA-256 is of the re-encoded file', (await auditRows('family_image.upload', img1?.id)).length === 1 && stored.file_sha256 !== (await import('crypto')).createHash('sha256').update(gpsJpeg).digest('hex'));
  x = await uploadImage(Buffer.from('%PDF-1.4\n% zz\n%%EOF\n'), 'zz.pdf', 'image/png');
  ok('image: a PDF (even sent as image/png) is refused by its content', x.status === 400 && /only JPEG, PNG or WebP/.test(x.j.error), `${x.status} ${x.j.error}`);

  // ---- What customers and reps see ----------------------------------------------------------------------------------------
  x = await as('customer', 'GET', '/api/catalog/families', CA.cookie);
  const listIds = (x.j.families ?? []).map((f) => f.id);
  ok('catalogue: published families listed; the hidden and the switched-off ones are not', listIds.includes(F1.id) && listIds.includes(F2.id) && !listIds.includes(F3.id) && !listIds.includes(F4.id));
  const v1 = (x.j.families ?? []).find((f) => f.id === F1.id);
  ok('catalogue: exactly the customer-safe keys', v1 && JSON.stringify(Object.keys(v1).sort()) === JSON.stringify(['category', 'categoryLabel', 'code', 'description', 'id', 'imageIds', 'name', 'standards', 'typicalColours', 'typicalOptions', 'typicalSizes']), JSON.stringify(Object.keys(v1 ?? {})));
  ok('catalogue: standards shown are only OK and LAB (third-party certificate, lab report)', JSON.stringify([...v1.standards].sort()) === JSON.stringify([st.ok.designation, st.lab.designation].sort()), JSON.stringify(v1.standards));
  ok('catalogue: search by code and by name, and the category filter', (await as('customer', 'GET', `/api/catalog/families?q=${encodeURIComponent(`zz${tag}-toq`)}`, CA.cookie)).j.families?.map((f) => f.id).join() === F2.id
    && (await as('customer', 'GET', '/api/catalog/families?q=nitrile%20GLOVE', CA.cookie)).j.families?.some((f) => f.id === F1.id) && (await as('customer', 'GET', '/api/catalog/families?category=footwear', CA.cookie)).j.families?.every((f) => f.category === 'footwear'));
  for (const [n, f] of [['hidden', F3], ['switched off', F4]]) {
    const d = await as('customer', 'GET', `/api/catalog/families/${f.id}`, CA.cookie), dr = await as('rep', 'GET', `/api/catalog/families/${f.id}`, R1.cookie);
    ok(`catalogue: the ${n} family's page answers 404 to a customer and a rep`, d.status === 404 && dr.status === 404);
  }
  const hidImg = (await a.from('family_images').insert({ family_id: F3.id, file_path: `zz-cat-hidden-${tag}`, file_name: 'x', file_size: 1, mime_type: 'image/png', file_sha256: 'b'.repeat(64) }).select('id').single()).data;
  ok('images: a hidden family\'s image is 404 for a customer and a rep; a published one redirects to a short signed link', (await as('customer', 'GET', `/api/catalog/images/${hidImg.id}`, CA.cookie)).status === 404 && (await as('rep', 'GET', `/api/catalog/images/${hidImg.id}`, R1.cookie)).status === 404
    && ((y) => y.status === 302 && /token=/.test(y.location ?? ''))(await call('GET', `/api/catalog/images/${img1.id}`, CA.cookie)));
  ok('images: signed out → 401', (await call('GET', `/api/catalog/images/${img1.id}`, null)).status === 401);
  x = await as('rep', 'GET', '/api/catalog/families', R1.cookie);
  ok('catalogue: a rep sees the same published list', x.status === 200 && x.j.families?.some((f) => f.id === F1.id) && !x.j.families.some((f) => f.id === F3.id));
  await as('rep', 'GET', `/api/catalog/families/${F1.id}`, R1.cookie);
  await as('customer', 'GET', `/api/catalog/families/${F1.id}`, CA.cookie);
  await as('customer', 'GET', '/api/catalog/settings', CA.cookie);

  // ---- The minimum -------------------------------------------------------------------------------------------------------
  const line = (fid, sizes, specIn = {}) => ({ family_id: fid, sizes, spec: { options: { Fabric: 'Nitrile 8 mil' }, ...specIn } });
  x = await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, line(F1.id, [{ size: 'M', qty: 40 }, { size: 'L', qty: 9 }]));
  ok('minimum: a line of 49 is refused, naming the minimum', x.status === 400 && /minimum per product is 50/.test(x.j.error), x.j.error);
  x = await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, line(F1.id, [{ size: 'M', qty: 50 }]));
  const la1 = x.j.line?.id;
  ok('minimum: 50 is allowed with a gentle note', x.status === 201 && /Small runs/.test(x.j.note ?? ''), x.j.error ?? '');
  x = await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, line(F1.id, [{ size: 'S', qty: 299 }]));
  const la2 = x.j.line?.id;
  ok('minimum: 299 is allowed with the note; 300 without', x.status === 201 && x.j.note && ((y) => y.status === 201 && y.j.note === null)(await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, line(F1.id, [{ size: 'S', qty: 300 }]))));
  x = await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, { family_id: F2.id, quantity: 60, spec: {} });
  ok('a family without sizes takes one quantity, stored as "One size"', x.status === 201 && (await a.from('quote_draft_lines').select('sizes').eq('id', x.j.line.id).single()).data.sizes[0].size === 'One size', x.j.error ?? '');
  x = await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, line(F3.id, [{ size: 'M', qty: 100 }]));
  ok('a hidden family cannot be added to a cart (404)', x.status === 404);
  for (const bad of [{ min_order_qty: 51 }, { min_order_qty: 0 }, { min_order_qty: 40, note_below_qty: 30 }]) {
    const y = await call('PATCH', '/api/admin/catalog-settings', ac, bad);
    if (y.status !== 400) ok(`settings: ${JSON.stringify(bad)} refused`, false, String(y.status));
  }
  x = await call('PATCH', '/api/admin/catalog-settings', ac, { min_order_qty: 50, note_below_qty: 300 });
  x = await call('PATCH', '/api/admin/catalog-settings', ac, { min_order_qty: 50, note_below_qty: 301 });
  ok('settings: above 50, 0 and a note level under the minimum are refused; a change writes one catalog_settings.edit row', x.status === 200 && (await auditRows('catalog_settings.edit', 1)).length === 1);
  x = await call('PATCH', '/api/admin/catalog-settings', ac, { min_order_qty: 50, note_below_qty: 300 });

  // ---- Customer isolation (A vs B) ---------------------------------------------------------------------------------------
  const UNSUB = `ZZ-UNSUBMITTED-CART-${tag}`;
  x = await as('customer', 'POST', '/api/portal/quote-cart/lines', CB.cookie, line(F1.id, [{ size: 'M', qty: 70 }], { details: UNSUB }));
  const lb = x.j.line?.id;
  const draftB = (await a.from('quote_drafts').select('id').eq('customer_id', cB.id).single()).data;
  ok('B has a cart line', x.status === 201 && !!lb && !!draftB);
  x = await as('customer', 'GET', '/api/portal/quote-cart', CA.cookie);
  ok('A\'s cart never shows B\'s line or text', x.status === 200 && !x.text.includes(lb) && !x.text.includes(UNSUB) && x.j.lines.length === 4);
  x = await as('customer', 'PATCH', `/api/portal/quote-cart/lines/${lb}`, CA.cookie, { sizes: [{ size: 'M', qty: 999 }] });
  const y = await as('customer', 'DELETE', `/api/portal/quote-cart/lines/${lb}`, CA.cookie);
  const bLine = (await a.from('quote_draft_lines').select('sizes').eq('id', lb).single()).data;
  ok('A changing or deleting B\'s line by its id: 404 both times, and B\'s line is untouched', x.status === 404 && y.status === 404 && bLine?.sizes[0].qty === 70);
  x = await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, { ...line(F1.id, [{ size: 'M', qty: 80 }]), draft_id: draftB.id, customer_id: cB.id });
  const placed = (await a.from('quote_draft_lines').select('draft_id').eq('id', x.j.line?.id).single()).data;
  ok('A naming B\'s cart or customer id in the body: ignored, the line goes into A\'s own cart', x.status === 201 && placed && placed.draft_id !== draftB.id);
  await as('customer', 'DELETE', `/api/portal/quote-cart/lines/${x.j.line.id}`, CA.cookie);
  await as('customer', 'PATCH', '/api/portal/quote-cart', CA.cookie, { note: 'A note', customer_id: cB.id });
  ok('A\'s note goes to A\'s cart only', (await a.from('quote_drafts').select('note').eq('customer_id', cB.id).single()).data.note === null);
  // Saved families.
  await as('customer', 'POST', '/api/portal/saved', CB.cookie, { family_id: F1.id });
  x = await as('customer', 'DELETE', `/api/portal/saved/${F1.id}`, CA.cookie);
  ok('saved: A removing a family only B saved: 404, and B\'s saved row stays', x.status === 404 && (await a.from('saved_families').select('family_id').eq('customer_id', cB.id)).data.length === 1);
  await as('customer', 'POST', '/api/portal/saved', CA.cookie, { family_id: F2.id });
  x = await as('customer', 'GET', '/api/portal/saved', CA.cookie);
  ok('saved: A sees only A\'s saved list (F2), B only B\'s (F1)', x.j.families?.map((f) => f.id).join() === F2.id && (await as('customer', 'GET', '/api/portal/saved', CB.cookie)).j.families?.map((f) => f.id).join() === F1.id);
  ok('saved: a hidden family cannot be saved', (await as('customer', 'POST', '/api/portal/saved', CA.cookie, { family_id: F3.id })).status === 404);
  // Sample requests.
  x = await as('customer', 'POST', '/api/portal/sample-requests', CB.cookie, { family_id: F1.id, quantity: 3, spec: { options: { Fabric: 'Nitrile 4 mil' } }, note: `ZZ CAT B sample ${tag}` });
  const sB = x.j.sample?.id;
  ok('B sends a sample request (to B\'s rep)', x.status === 201 && x.j.handledBy === 'rep');
  x = await as('customer', 'GET', '/api/portal/sample-requests', CA.cookie);
  ok('A\'s sample list never shows B\'s', x.status === 200 && !x.text.includes(sB) && !x.text.includes(`ZZ CAT B sample ${tag}`));
  ok('a customer cannot decide any sample request (403)', (await call('PATCH', `/api/sample-requests/${sB}`, CA.cookie, { action: 'sent' })).status === 403);
  ok('samples: 0 and 21 are refused; a hidden family is refused', (await call('POST', '/api/portal/sample-requests', CA.cookie, { family_id: F1.id, quantity: 21 })).status === 400 && (await call('POST', '/api/portal/sample-requests', CA.cookie, { family_id: F1.id, quantity: 0 })).status === 400 && (await call('POST', '/api/portal/sample-requests', CA.cookie, { family_id: F3.id, quantity: 1 })).status === 404);
  x = await as('customer', 'POST', '/api/portal/sample-requests', CA.cookie, { family_id: F1.id, quantity: 2, spec: { details: HOSTILE }, note: HOSTILE });
  const sA = x.j.sample?.id;

  // ---- Reps and admins: submitted requests only, never carts --------------------------------------------------------------
  x = await as('rep', 'GET', '/api/rep/sample-requests', R1.cookie);
  ok('rep 1 sees their own customer A\'s sample request, never B\'s (rep 2\'s customer)', x.j.samples?.some((s) => s.id === sA) && !x.j.samples.some((s) => s.id === sB));
  ok('rep 1 marking B\'s sample: 404; rep 2 marking A\'s: 404', (await call('PATCH', `/api/sample-requests/${sB}`, R1.cookie, { action: 'sent' })).status === 404 && (await call('PATCH', `/api/sample-requests/${sA}`, R2.cookie, { action: 'sent' })).status === 404);
  ok('declining needs a reason', (await call('PATCH', `/api/sample-requests/${sB}`, R2.cookie, { action: 'decline' })).status === 400);
  x = await call('PATCH', `/api/sample-requests/${sB}`, R2.cookie, { action: 'decline', reason: 'ZZ out of stock' });
  ok('rep 2 declines B\'s sample with a reason: one sample_request.decide row; B is notified', x.status === 200 && (await auditRows('sample_request.decide', sB)).length === 1 && (await a.from('notifications').select('id').eq('recipient_user_id', cuB.id).eq('kind', 'sample_request_decided')).data.length === 1);
  ok('  a second decision is refused (409)', (await call('PATCH', `/api/sample-requests/${sB}`, ac, { action: 'sent' })).status === 409);
  for (const [who, ck] of [['rep', R1.cookie], ['admin', ac]]) {
    const cartCalls = await Promise.all([call('GET', '/api/portal/quote-cart', ck), call('POST', '/api/portal/quote-cart/lines', ck, line(F1.id, [{ size: 'M', qty: 60 }])), call('POST', '/api/portal/quote-cart/submit', ck), call('GET', '/api/rep/quote-carts', ck), call('GET', '/api/admin/quote-carts', ck)]);
    ok(`${who}: every cart route refuses (403) and no rep/admin cart route exists (404)`, cartCalls.slice(0, 3).every((c) => c.status === 403) && cartCalls.slice(3).every((c) => c.status === 404), cartCalls.map((c) => c.status).join(','));
    const reads = await Promise.all([
      '/api/rep/sample-requests', '/api/admin/sample-requests', '/api/admin/families', `/api/admin/families/${F1.id}`, '/api/catalog/families', `/api/catalog/families/${F1.id}`, '/api/admin/catalog-settings', '/api/portal/order-requests',
      who === 'rep' ? '/rep/requests' : '/admin/requests', who === 'rep' ? '/rep/browse' : '/admin/sourcing/families',
    ].map((u) => call('GET', u, ck)));
    ok(`${who}: no route or page they can open carries unsubmitted cart data (B's line id or its text)`, reads.every((c) => !c.text.includes(lb) && !c.text.includes(UNSUB)), reads.map((c) => c.status).join(','));
  }

  // ---- Submit: hostile text, mapping, one request, one notification -------------------------------------------------------
  await as('customer', 'DELETE', `/api/portal/quote-cart/lines/${la2}`, CA.cookie);
  x = await as('customer', 'PATCH', `/api/portal/quote-cart/lines/${la1}`, CA.cookie, { spec: { options: { Fabric: 'Other: ZZ <b>custom</b>' }, colour: '<i>Navy</i>', branding: HOSTILE, details: HOSTILE }, sizes: [{ size: 'M', qty: 60 }] });
  ok('a line\'s spec and sizes can be changed', x.status === 200, x.j.error ?? '');
  await as('customer', 'PATCH', '/api/portal/quote-cart', CA.cookie, { note: HOSTILE });
  const reqsBefore = (await a.from('order_requests').select('id').eq('customer_id', cA.id)).data.length;
  const notesBefore = (await a.from('notifications').select('id').eq('recipient_user_id', ru1.id).eq('kind', 'order_request')).data.length;
  const linesA = (await as('customer', 'GET', '/api/portal/quote-cart', CA.cookie)).j.lines.length;
  x = await as('customer', 'POST', '/api/portal/quote-cart/submit', CA.cookie);
  if (x.j.handlerEmail === 'sent') { ok('the server is NOT in dry run (EMAIL_DRY_RUN=1): stopping before real emails', false); throw new Error('not dry run'); }
  const req1 = x.j.request?.id;
  const reqRow = req1 ? (await a.from('order_requests').select('kind, items, note, status').eq('id', req1).single()).data : null;
  ok('submit: one quote request to the rep (email dry run), one notification; the cart is empty after', x.status === 201 && x.j.handledBy === 'rep' && x.j.handlerEmail === 'dry_run'
    && (await a.from('order_requests').select('id').eq('customer_id', cA.id)).data.length === reqsBefore + 1
    && (await a.from('notifications').select('id').eq('recipient_user_id', ru1.id).eq('kind', 'order_request')).data.length === notesBefore + 1
    && (await as('customer', 'GET', '/api/portal/quote-cart', CA.cookie)).j.lines.length === 0, `${x.status} ${x.j.error ?? ''}`);
  const it0 = reqRow?.items?.find((i) => i.family_id === F1.id);
  ok('submit: each line maps to one item (family name, family id and code, spec, sizes); the note kept', reqRow?.kind === 'quote' && reqRow.items.length === linesA && it0?.product_name === 'ZZ CAT Nitrile glove' && it0.family_code === F1.code && it0.sizes[0].qty === 60 && reqRow.note === HOSTILE);
  ok('plain text: the hostile spec, branding and note are stored exactly as typed', it0?.spec?.details === HOSTILE && it0?.branding === HOSTILE && it0?.spec?.options?.[0]?.value === 'Other: ZZ <b>custom</b>');
  x = await as('customer', 'POST', '/api/portal/quote-cart/submit', CA.cookie);
  ok('submit again just after: "already submitted" (409), still exactly one request', x.status === 409 && x.j.code === 'already_submitted' && /already submitted/.test(x.j.error) && (await a.from('order_requests').select('id').eq('customer_id', cA.id)).data.length === reqsBefore + 1, `${x.status} ${x.j.error}`);
  // Two submits at the same moment.
  for (let i = 0; i < 2; i++) await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, line(F1.id, [{ size: 'L', qty: 100 + i }]));
  const before2 = (await a.from('order_requests').select('id').eq('customer_id', cA.id)).data.length;
  const n2 = (await a.from('notifications').select('id').eq('recipient_user_id', ru1.id).eq('kind', 'order_request')).data.length;
  const both = await Promise.all([call('POST', '/api/portal/quote-cart/submit', CA.cookie), call('POST', '/api/portal/quote-cart/submit', CA.cookie)]);
  const st2 = both.map((b) => b.status).sort().join(',');
  ok('two submits at the same time: exactly one 201 and one 409 "already submitted"', st2 === '201,409' && both.find((b) => b.status === 409)?.j.code === 'already_submitted', `${st2} ${both.map((b) => b.j.error ?? '').join(' | ')}`);
  ok('  exactly 1 new request and 1 new notification', (await a.from('order_requests').select('id').eq('customer_id', cA.id)).data.length === before2 + 1 && (await a.from('notifications').select('id').eq('recipient_user_id', ru1.id).eq('kind', 'order_request')).data.length === n2 + 1);
  // An unpublished family is refused at submit and named; the cart stays as it was.
  await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, { family_id: F2.id, quantity: 80, spec: {} });
  await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, line(F1.id, [{ size: 'M', qty: 90 }]));
  await call('PATCH', `/api/admin/families/${F2.id}`, ac, { visible_to_customers: false });
  const before3 = (await a.from('order_requests').select('id').eq('customer_id', cA.id)).data.length;
  x = await as('customer', 'POST', '/api/portal/quote-cart/submit', CA.cookie);
  const cartAfter = (await as('customer', 'GET', '/api/portal/quote-cart', CA.cookie)).j;
  ok('submit with a family hidden since it was added: refused, naming it; nothing sent; the cart is kept (and shows it unavailable)', x.status === 400 && x.j.code === 'unavailable' && x.j.error.includes('ZZ CAT Knit toque') && x.j.error.includes(F2.code)
    && (await a.from('order_requests').select('id').eq('customer_id', cA.id)).data.length === before3 && cartAfter.lines.length === 2 && cartAfter.lines.some((l) => l.familyId === F2.id && !l.available), `${x.status} ${x.j.error}`);
  await call('PATCH', `/api/admin/families/${F2.id}`, ac, { visible_to_customers: true });
  // A changed minimum is respected at submit: a line of 20 added while the minimum was 10 is refused once it is 50 again.
  await a.from('catalog_settings').update({ min_order_qty: 10 }).eq('id', 1);
  await as('customer', 'POST', '/api/portal/quote-cart/lines', CA.cookie, line(F1.id, [{ size: 'XL', qty: 20 }]));
  await a.from('catalog_settings').update({ min_order_qty: 50, note_below_qty: 300 }).eq('id', 1);
  x = await as('customer', 'POST', '/api/portal/quote-cart/submit', CA.cookie);
  ok('a line added under a lower minimum (20 when it was 10) is refused at submit once it is 50 again; the cart is kept', x.status === 400 && /minimum per product is 50/.test(x.j.error) && (await as('customer', 'GET', '/api/portal/quote-cart', CA.cookie)).j.lines.length === 3, `${x.status} ${x.j.error}`);

  // Boards and the New Order form show the hostile text escaped.
  const board = await call('GET', '/rep/requests', R1.cookie);
  ok('rep 1\'s Requests board shows A\'s quote with the spec, the hostile text escaped (never as tags)', board.status === 200 && board.text.includes('ZZ CAT Alpha') && board.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !board.text.includes('<script>alert(1)') && !/<img src=x onerror/i.test(board.text) && !board.text.includes('<b>custom</b>'));
  ok('rep 2\'s board does not show A\'s quote', !(await call('GET', '/rep/requests', R2.cookie)).text.includes('ZZ CAT Alpha'));
  const form = await call('GET', `/rep/orders/new?request=${req1}`, R1.cookie);
  ok('"Turn into an order": the New Order form is pre-filled, Fabric from the spec, the rest in the notes, all escaped', form.status === 200 && form.text.includes('Other: ZZ &lt;b&gt;custom&lt;/b&gt;') && form.text.includes('Customer spec, line') && form.text.includes('&lt;script&gt;alert(1)') && !form.text.includes('<script>alert(1)') && !/<img src=x onerror/i.test(form.text));
  const adminBoard = await call('GET', '/admin/requests', ac);
  ok('the admin Requests board shows both customers\' requests (escaped)', adminBoard.status === 200 && adminBoard.text.includes('ZZ CAT Alpha') && !adminBoard.text.includes('<script>alert(1)'));
  await as('customer', 'GET', '/api/portal/order-requests', CA.cookie);

  // ---- No supplier, product, cost or factory data in any customer or rep response -----------------------------------------
  const all = seen.join('\n');
  const leaks = [SECRET.supplier, sup.code, SECRET.sku, SECRET.web, SECRET.note, SECRET.origin, SECRET.pcode, P1.id, P2.id].filter((s) => all.includes(s));
  const badKeys = [...all.matchAll(/"(supplier[a-z_]*|sku|supplier_sku|cost[a-z_]*|price[a-z_]*|margin[a-z_]*|factory[a-z_]*|country_of_origin|website|notes|product_id|unit_weight_g|pieces_per_carton)"\s*:/gi)].map((m) => m[1]);
  ok(`no supplier name/code/SKU/website, product code/id, internal note or origin in ${seen.length} customer and rep responses`, leaks.length === 0, leaks.join(', '));
  ok('no supplier, SKU, cost, price, margin, factory, origin, notes or product-id key in them either', badKeys.length === 0, [...new Set(badKeys)].join(', '));

  // ---- Standards removal is audited ------------------------------------------------------------------------------------------
  x = await call('DELETE', `/api/admin/families/${F1.id}/standards/${st.wrong.id}`, ac);
  ok('admin: removing a standard writes one family_standard.remove row', x.status === 200 && (await auditRows('family_standard.remove', `${F1.id}:${st.wrong.id}`)).length === 1);
  ok('the admin and rep audit rows carry no session token or password', !JSON.stringify((await a.from('audit_log').select('*').gte('at', started).in('actor_user_id', [adm.id, ru1.id, ru2.id])).data).includes(pw));
} catch (e) {
  ok('the customer-catalog test ran to the end', false, e instanceof Error ? e.stack?.split('\n').slice(0, 3).join(' | ') : String(e));
} finally {
  if (restoreSettings) await a.from('catalog_settings').update(restoreSettings).eq('id', 1);
  const cids = ids.customers.filter(Boolean);
  if (cids.length) {
    await a.from('sample_requests').delete().in('customer_id', cids);
    await a.from('quote_drafts').delete().in('customer_id', cids);
    await a.from('saved_families').delete().in('customer_id', cids);
    await a.from('order_requests').delete().in('customer_id', cids);
  }
  const { data: zzFam } = await a.from('product_families').select('id').like('name', 'ZZ CAT%');
  const fids = [...new Set([...ids.families, ...(zzFam ?? []).map((f) => f.id)].filter(Boolean))];
  if (fids.length) {
    const { data: imgs } = await a.from('family_images').select('file_path').in('family_id', fids);
    const real = (imgs ?? []).map((i) => i.file_path).filter((p) => !p.startsWith('zz-cat-'));
    if (real.length) await a.storage.from(IMG_BUCKET).remove(real);
    await a.from('family_images').delete().in('family_id', fids);
    await a.from('family_standards').delete().in('family_id', fids);
    await a.from('quote_draft_lines').delete().in('family_id', fids);
    await a.from('sample_requests').delete().in('family_id', fids);
    await a.from('saved_families').delete().in('family_id', fids);
    await a.from('products').update({ family_id: null }).in('family_id', fids);
  }
  const { data: zzProd } = await a.from('products').select('id').like('name', 'ZZ CAT%');
  const pids = [...new Set([...ids.products, ...(zzProd ?? []).map((p) => p.id)].filter(Boolean))];
  if (pids.length) { await a.from('certificates').delete().in('product_id', pids); await a.from('product_compliance').delete().in('product_id', pids); await a.from('product_suppliers').delete().in('product_id', pids); await a.from('products').delete().in('id', pids); }
  if (fids.length) await a.from('product_families').delete().in('id', fids);
  const { data: zzSup } = await a.from('suppliers').select('id').like('name', 'ZZ CAT%');
  const sids = [...new Set([...ids.suppliers, ...(zzSup ?? []).map((s) => s.id)].filter(Boolean))];
  if (sids.length) await a.from('suppliers').delete().in('id', sids);
  const { data: zzStd } = await a.from('standards').select('id').like('designation', 'ZZ CAT%');
  const stids = [...new Set([...ids.standards, ...(zzStd ?? []).map((s) => s.id)].filter(Boolean))];
  if (stids.length) await a.from('standards').delete().in('id', stids);
  for (const u of users.filter(Boolean)) { const { data: pend } = await a.storage.from(IMG_BUCKET).list(`pending/${u.id}`, { limit: 100 }); if (pend?.length) await a.storage.from(IMG_BUCKET).remove(pend.map((p) => `pending/${u.id}/${p.name}`)); }
  if (cids.length) await a.from('customers').delete().in('id', cids);
  for (const rid of ids.reps) { await a.from('rep_activity').delete().eq('rep_id', rid); await a.from('reps').delete().eq('id', rid); }
  const uids = users.map((u) => u?.id).filter(Boolean);
  if (uids.length) await a.from('notifications').delete().in('recipient_user_id', uids);
  for (const id of uids) await a.auth.admin.deleteUser(id);
  const left = await Promise.all([a.from('product_families').select('id').like('name', 'ZZ CAT%'), a.from('products').select('id').like('name', 'ZZ CAT%'), a.from('standards').select('id').like('designation', 'ZZ CAT%'), a.from('customers').select('id').like('company_name', 'ZZ CAT%')]);
  const n = left.reduce((s, q) => s + (q.data?.length ?? 0), 0);
  const imgLeft = (await a.storage.from(IMG_BUCKET).list('', { limit: 100 })).data?.filter((f) => f.name !== 'pending' && f.name !== '.emptyFolderPlaceholder') ?? [];
  ok('cleaned up: no ZZ CAT family, product, standard or customer left, and no image file left (audit rows stay, by design)', n === 0 && imgLeft.length === 0, `${n} rows, ${imgLeft.length} image folders left`);
}
