// Supplier and product records (2026-11-21, approved). Proves:
//   - offline: the certificate rule (verified vs uploaded vs expired vs wrong edition vs another product vs the expiry day
//     itself vs an unchecked standard), expiry warnings, the business day; the supplier code (pattern, never a number from
//     the name, 3 digits after 70%); the import planner (headers, repeated rows, blank keeps, unknown category and standard);
//   - live on the TEST project: customers, reps and visitors are refused by the database and the routes; every create, edit,
//     delete, upload and verification writes exactly one audit row; the certificate rule through the API; the import dry run
//     writes nothing, "add as unchecked standards", confirm, running it twice changes nothing, one changed cell = one update.
//   - follow-up (2026-11-25): document types (only a third-party certificate or an accredited lab report can make a claim
//     Compliant; a declaration shows "Manufacturer declaration only"; an expired certificate plus a declaration is "Expired"),
//     lab accreditation (lab reports only), the issuer needed to verify, supplier websites (http/https only), the new import
//     columns (optional, but a certificate file needs its type), all through the rule, the fields, the routes and the database.
// Test project only ("ZZ PRD" data, zz-prd logins, deleted at the end; audit rows stay). Needs the server on port 10001.
import { env as E2E_ENV } from './env.mjs'; // the test project only (guarded), never Development
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import { stepUp } from './mfa.mjs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);

const K = await import('../../src/lib/compliance.ts');
const SC = await import('../../src/lib/supplier-code.ts');
const IM = await import('../../src/lib/catalog-import.ts');
const F = await import('../../src/lib/catalog-fields.ts');
const CF = await import('../../src/lib/certificate-files.ts');

// =====================================================================================================================
// Offline: the certificate rule
// =====================================================================================================================
const claim = { product_id: 'P1', standard_id: 'S2016' };
const checked = { checked: true };
const cert = (o) => ({ product_id: 'P1', standard_id: 'S2016', status: 'verified', expires_on: '2027-06-30', document_type: 'third_party_certificate', ...o });
const T = '2026-11-21';
ok('rule: a verified, unexpired certificate for this product and this exact edition → Compliant', K.claimStatus(claim, checked, [cert()], T) === 'compliant');
ok('rule: only "uploaded" (not verified) → Certificate needed', K.claimStatus(claim, checked, [cert({ status: 'uploaded' })], T) === 'certificate_needed');
ok('rule: verified but expired → Expired', K.claimStatus(claim, checked, [cert({ expires_on: '2026-11-20' })], T) === 'expired');
ok('rule: verified for another edition of the standard → Certificate needed', K.claimStatus(claim, checked, [cert({ standard_id: 'S2003' })], T) === 'certificate_needed');
ok('rule: verified for another product → Certificate needed', K.claimStatus(claim, checked, [cert({ product_id: 'P2' })], T) === 'certificate_needed');
ok('rule: valid through the end of its expiry day (expires today → Compliant; expired yesterday → Expired)', K.claimStatus(claim, checked, [cert({ expires_on: T })], T) === 'compliant' && K.claimStatus(claim, checked, [cert({ expires_on: '2026-11-20' })], T) === 'expired');
ok('rule: one expired and one valid verified certificate → Compliant', K.claimStatus(claim, checked, [cert({ expires_on: '2025-01-01' }), cert()], T) === 'compliant');
ok('rule: a verified certificate without an expiry date never counts → Certificate needed', K.claimStatus(claim, checked, [cert({ expires_on: null })], T) === 'certificate_needed');
ok('rule: an unchecked standard → Standard not checked (even with a verified certificate)', K.claimStatus(claim, { checked: false }, [cert()], T) === 'standard_not_checked');
ok('rule: no certificate at all → Certificate needed', K.claimStatus(claim, checked, [], T) === 'certificate_needed');
// Document types (2026-11-25).
const decl = (o) => cert({ document_type: 'manufacturer_declaration', ...o });
const rs = (certs) => K.claimStatus(claim, checked, certs, T);
ok('type: a valid, verified accredited lab report → Compliant', rs([cert({ document_type: 'accredited_lab_report' })]) === 'compliant');
ok('type: a verified manufacturer declaration valid until 2099 → "Manufacturer declaration only", never Compliant', rs([decl({ expires_on: '2099-12-31' })]) === 'declaration_only' && K.CLAIM_LABEL.declaration_only === 'Manufacturer declaration only');
ok('type: a verified declaration with no expiry date → declaration only', rs([decl({ expires_on: null })]) === 'declaration_only');
ok('type: a declaration plus a valid third-party certificate → Compliant', rs([decl(), cert()]) === 'compliant');
ok('type: an expired third-party certificate plus a valid declaration → Expired (our decision, 2026-11-25)', rs([cert({ expires_on: '2026-11-20' }), decl()]) === 'expired');
ok('type: an expired lab report plus a valid declaration → Expired', rs([cert({ document_type: 'accredited_lab_report', expires_on: '2026-11-20' }), decl()]) === 'expired');
ok('type: an uploaded (not verified) declaration → Certificate needed', rs([decl({ status: 'uploaded' })]) === 'certificate_needed');
ok('type: a declaration past its own expiry date → Certificate needed', rs([decl({ expires_on: '2026-11-20' })]) === 'certificate_needed');
ok('type: a declaration for another edition → Certificate needed', rs([decl({ standard_id: 'S2003' })]) === 'certificate_needed');
ok('type: a missing or unknown document type never counts → Certificate needed', rs([cert({ document_type: null })]) === 'certificate_needed' && rs([cert({ document_type: 'supplier_says_so' })]) === 'certificate_needed' && rs([cert({ document_type: undefined })]) === 'certificate_needed');
ok('type: an unchecked standard → Standard not checked, whatever the documents', K.claimStatus(claim, { checked: false }, [decl(), cert({ document_type: 'accredited_lab_report' })], T) === 'standard_not_checked');
ok('type: only the two proof types count', K.countsAsProof('third_party_certificate') && K.countsAsProof('accredited_lab_report') && !K.countsAsProof('manufacturer_declaration') && !K.countsAsProof(null) && K.DOCUMENT_TYPES.length === 3);
let threw = false; try { K.claimStatus(claim, checked, [], '21/11/2026'); } catch { threw = true; }
ok('rule: "today" must be passed in as YYYY-MM-DD (the rule never reads the clock)', threw);
ok('warnings: expired, within 30 days (30 included), within 60 days (31–60), none after 60', K.expiryWarning('2026-11-20', T) === 'expired' && K.expiryWarning('2026-12-21', T) === 'within_30' && K.expiryWarning('2026-12-22', T) === 'within_60' && K.expiryWarning('2027-01-20', T) === 'within_60' && K.expiryWarning('2027-01-21', T) === null && K.expiryWarning(null, T) === null);
ok('business day is Vancouver: 07:59 UTC on Nov 21 is still Nov 20; 08:00 UTC is Nov 21', K.businessToday(new Date('2026-11-21T07:59:00Z')) === '2026-11-20' && K.businessToday(new Date('2026-11-21T08:00:00Z')) === '2026-11-21');

// =====================================================================================================================
// Offline: the supplier code
// =====================================================================================================================
const allCodes = (name, taken = []) => { let n = 0; SC.pickSupplierCode(name, taken, (len) => { n = len; return 0; }); return Array.from({ length: n }, (_, i) => SC.pickSupplierCode(name, taken, () => i)); };
const freeFor07 = allCodes('Factory 07 Ltd');
ok('code: always "Supplier NN"', freeFor07.every((c) => SC.CODE_PATTERN.test(c)) && freeFor07.length > 90);
ok('code: a name with 07 can never get Supplier 07 (or 7)', !freeFor07.includes('Supplier 07') && freeFor07.length === 98, String(freeFor07.length));
const busy = `ZZ ${Array.from({ length: 98 }, (_, i) => String(i + 1).padStart(2, '0')).join(' ')}`;
ok('code: a name holding every number 01–98 gets the only one left, Supplier 99', SC.pickSupplierCode(busy, [], () => 0) === 'Supplier 99');
const taken70 = Array.from({ length: 70 }, (_, i) => `Supplier ${String(i + 1).padStart(2, '0')}`);
ok('code: once 70% of the 2-digit codes are used, new codes have 3 digits', /^Supplier \d{3}$/.test(SC.pickSupplierCode('ZZ', taken70, () => 0)));
ok('code: the random source decides (not the order of creation)', SC.pickSupplierCode('ZZ', [], () => 0) !== SC.pickSupplierCode('ZZ', [], (n) => n - 1));

// =====================================================================================================================
// Offline: the import planner
// =====================================================================================================================
const csv = (headers, rows) => [headers, ...rows].map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n');
const SH = [...IM.SUPPLIER_HEADERS], PH = [...IM.PRODUCT_HEADERS];
const srow = (o) => SH.map((h) => o[h] ?? '');
const prow = (o) => PH.map((h) => o[h] ?? '');
const empty = { suppliers: [], primaryContacts: [], products: [], links: [], standards: [{ id: 'S1', designation: 'EN 388:2016+A1:2018', checked: true }], claims: [], certificates: [], categories: [{ key: 'gloves', label: 'Gloves and Hand Protection' }, { key: 'ppe', label: 'Other PPE and Accessories' }], files: [] };
let pl = IM.planImport({ suppliersCsv: csv(SH.filter((h) => h !== 'City'), []) }, empty);
ok('planner: a missing column refuses the file and names it', pl.fileErrors.some((e) => /"City" is missing/.test(e)) && !pl.canConfirm);
pl = IM.planImport({ suppliersCsv: csv([...SH, 'Price'], []) }, empty);
ok('planner: an unknown column refuses the file', pl.fileErrors.some((e) => /unknown column "Price"/.test(e)));
pl = IM.planImport({ suppliersCsv: csv(SH.filter((h) => h !== 'MOQ unit').map((h) => h.toUpperCase()), [srow({ Supplier: 'A' }).filter((_, i) => SH[i] !== 'MOQ unit')]) }, empty);
ok('planner: "MOQ unit" is optional; headers match in any capitals', pl.fileErrors.length === 0 && pl.rows[0].action === 'create');
pl = IM.planImport({ productsCsv: csv(PH, [prow({ 'Product code': 'X1', 'Product name': 'Glove', 'Made to spec or resold brand': 'Made to spec', Category: 'Footwear' })]) }, empty);
ok('planner: an unknown category is an error that lists the allowed ones', pl.rows[0].action === 'error' && /not a RIVIX category.*Gloves and Hand Protection; Other PPE and Accessories/.test(pl.rows[0].errors.join(' ')));
pl = IM.planImport({ productsCsv: csv(PH, [prow({ 'Product code': 'X1', 'Product name': 'Glove', 'Made to spec or resold brand': 'made to spec', Category: 'gloves and hand protection', 'Standard and edition': 'en 388 : 2016+a1:2018' })]) }, empty);
ok('planner: a standard matches its full text ignoring case and spaces; the category by its name', pl.canConfirm && pl.ops.some((o) => o.kind === 'claim.create' && o.standardId === 'S1') && pl.ops.find((o) => o.kind === 'product.create').values.category === 'gloves');
pl = IM.planImport({ productsCsv: csv(PH, [prow({ 'Product code': 'X1', 'Product name': 'Glove', 'Made to spec or resold brand': 'Made to spec', 'Standard and edition': 'EN 999:2020' }), prow({ 'Product code': 'X1', 'Standard and edition': 'en999:2020' })]) }, empty);
ok('planner: an unknown standard is an error and is listed once for "add as unchecked"', !pl.canConfirm && pl.unknownStandards.length === 1 && pl.unknownStandards[0] === 'EN 999:2020');
pl = IM.planImport({ productsCsv: csv(PH, [prow({ 'Product code': 'X1', 'Product name': 'Glove', 'Made to spec or resold brand': 'Made to spec', 'Country of origin': 'CN' }), prow({ 'Product code': 'X1', 'Country of origin': 'VN' })]) }, empty);
ok('planner: repeated rows with a conflicting product field are an error', pl.rows[1].action === 'error' && /conflicts with row 2/.test(pl.rows[1].errors[0]));
pl = IM.planImport({ productsCsv: csv(PH, [prow({ 'Product code': 'X1', 'Product name': 'Glove', 'Made to spec or resold brand': 'Resold brand' })]) }, empty);
ok('planner: a resold brand needs a brand', pl.rows[0].action === 'error' && /Brand \(if resold\) is required/.test(pl.rows[0].errors.join(' ')));
const existing = { ...empty, products: [{ id: 'PX', code: 'X1', name: 'Glove', sourcing: 'made_to_spec', brand: null, category: 'gloves', country_of_origin: 'CN', sizes: ['M', 'L'], colours: [], unit_weight_g: 50, pieces_per_carton: 100, carton_length_cm: 60, carton_width_cm: '40.00', carton_height_cm: null, carton_weight_kg: '12.500', notes: null, active: true }] };
pl = IM.planImport({ productsCsv: csv(PH, [prow({ 'Product code': 'x1', 'Product name': 'Glove', Sizes: 'L; M', 'Carton width (cm)': '40', 'Carton weight (kg)': '12.5' })]) }, existing);
ok('planner: an existing product (code in any capitals) with the same values (lists in any order, 40 = 40.00) is unchanged; blank cells keep values', pl.rows[0].action === 'unchanged' && pl.ops.length === 0, JSON.stringify(pl.rows[0]));
pl = IM.planImport({ productsCsv: csv(PH, [prow({ 'Product code': 'X1', 'Country of origin': 'VN' })]) }, existing);
ok('planner: one changed cell is one update, shown old → new', pl.rows[0].action === 'update' && pl.ops.length === 1 && pl.rows[0].changes.includes('Country of origin: CN → VN'));
pl = IM.planImport({ productsCsv: csv(PH, [prow({ 'Product code': 'X1', 'Standard and edition': 'EN 388:2016+A1:2018', 'Certificate file': 'missing.pdf', 'Certificate expiry': '2027-01-01' })]) }, existing);
ok('planner: a named certificate file that is not attached: the claim is created, no certificate, a warning', pl.canConfirm && pl.ops.some((o) => o.kind === 'claim.create') && !pl.ops.some((o) => o.kind === 'certificate.create') && /not attached/.test(pl.rows[0].warnings.join(' ')));

// Fields (2026-11-25): supplier website, document type, accreditation.
const web = (v) => F.checkFields(F.SUPPLIER_SPEC, { website: v }, 'update');
ok('website: https and http addresses are accepted', web('https://example.org/factory').values.website === 'https://example.org/factory' && web('http://example.org').errors.length === 0);
ok('website: javascript:, data:, a bare domain and over 300 characters are refused', ['javascript:alert(1)', 'data:text/html,x', 'www.example.org', 'https://example.org/has space', `https://example.org/${'a'.repeat(290)}`].every((v) => web(v).errors.length === 1));
ok('website: checked with new URL(): http/https only, a host, "//" and no spaces', F.isWebAddress('https://example.org/x?y=1') && !F.isWebAddress('https:example.org') && !F.isWebAddress('http:/example.org') && !F.isWebAddress('https://') && !F.isWebAddress('ftp://example.org') && !F.isWebAddress('JAVASCRIPT:alert(1)') && !F.isWebAddress(' https://example.org') && !F.isWebAddress(null));
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222', FU = '33333333-3333-4333-8333-333333333333';
ok('pending path: only pending/<this admin>/<uuid> is accepted', CF.isOwnPendingPath(CF.newPendingPath(U1, FU), U1) && !CF.isOwnPendingPath(CF.newPendingPath(U2, FU), U1) && !CF.isOwnPendingPath(`pending/${FU}`, U1) && !CF.isOwnPendingPath(`pending/${U1}/../${U2}/${FU}`, U1) && !CF.isOwnPendingPath(`pending/${U1}/${FU}/x`, U1) && !CF.isOwnPendingPath(`${U1}/${FU}`, U1) && !CF.isOwnPendingPath(42, U1));
ok('website: blank clears it on an edit', web('').values.website === null && web('').errors.length === 0);
const dt = (v) => F.checkValue(v, F.DOCUMENT_TYPE_KIND, 'Document type');
ok('document type: labels and short names in any capitals ("Lab report", "Third-party certificate", "declaration")', dt('Lab report').value === 'accredited_lab_report' && dt('THIRD-PARTY CERTIFICATE').value === 'third_party_certificate' && dt('declaration').value === 'manufacturer_declaration' && dt('accredited_lab_report').value === 'accredited_lab_report');
ok('document type: anything else is refused', 'error' in dt('supplier says so') && 'error' in dt('self-certified'));
ok('accreditation: allowed on a lab report only', F.accreditationProblem('accredited_lab_report', 'ISO/IEC 17025') === null && F.accreditationProblem('manufacturer_declaration', 'ISO/IEC 17025') !== null && F.accreditationProblem('third_party_certificate', 'x') !== null && F.accreditationProblem('manufacturer_declaration', null) === null);
// Planner (2026-11-25): the new columns.
const OLD_SH = SH.filter((h) => h !== 'Website'), OLD_PH = PH.filter((h) => h !== 'Certificate type' && h !== 'Lab accreditation');
pl = IM.planImport({ suppliersCsv: csv(OLD_SH, [OLD_SH.map((h) => (h === 'Supplier' ? 'Old A' : ''))]), productsCsv: csv(OLD_PH, [OLD_PH.map((h) => ({ 'Product code': 'X9', 'Product name': 'Old glove', 'Made to spec or resold brand': 'Made to spec' })[h] ?? '')]) }, empty);
ok('planner: a CSV from the older templates (no Website, Certificate type or Lab accreditation) still reads', pl.fileErrors.length === 0 && pl.canConfirm && pl.summary.create === 2, JSON.stringify(pl.fileErrors));
pl = IM.planImport({ suppliersCsv: csv(SH, [srow({ Supplier: 'Web A', Website: 'https://web-a.example.org' }), srow({ Supplier: 'Web B', Website: 'javascript:alert(1)' })]) }, empty);
ok('planner: Website is imported; a non-http(s) one is an error', pl.ops.find((o) => o.kind === 'supplier.create')?.values.website === 'https://web-a.example.org' && pl.rows[1].action === 'error' && /Website/.test(pl.rows[1].errors.join(' ')));
const withFile = { ...existing, files: [{ name: 'c.pdf', size: 10, sha256: 'a'.repeat(64), type: 'application/pdf', error: null }] };
const certRow = (o) => prow({ 'Product code': 'X1', 'Standard and edition': 'EN 388:2016+A1:2018', 'Certificate file': 'c.pdf', 'Certificate expiry': '2027-01-01', 'Certificate issued by': 'ZZ Lab', ...o });
pl = IM.planImport({ productsCsv: csv(PH, [certRow({})]) }, withFile);
ok('planner: an attached certificate file without a "Certificate type" is an error', pl.rows[0].action === 'error' && /Certificate type" is required/.test(pl.rows[0].errors.join(' ')) && !pl.ops.some((o) => o.kind === 'certificate.create'));
pl = IM.planImport({ productsCsv: csv(PH, [certRow({ 'Certificate type': 'Lab report', 'Lab accreditation': 'ISO/IEC 17025, SCC #1' })]) }, withFile);
const cop = pl.ops.find((o) => o.kind === 'certificate.create');
ok('planner: a lab report with its accreditation is planned with both, shown in the changes', pl.canConfirm && cop?.document_type === 'accredited_lab_report' && cop?.accreditation === 'ISO/IEC 17025, SCC #1' && /Accredited lab report/.test(pl.rows[0].changes.join(' ')));
pl = IM.planImport({ productsCsv: csv(PH, [certRow({ 'Certificate type': 'Manufacturer declaration', 'Lab accreditation': 'ISO/IEC 17025' })]) }, withFile);
ok('planner: accreditation on a declaration is an error', pl.rows[0].action === 'error' && /only for an accredited lab report/.test(pl.rows[0].errors.join(' ')));
pl = IM.planImport({ productsCsv: csv(PH, [certRow({ 'Certificate type': 'Self-certified' })]) }, withFile);
ok('planner: an unknown certificate type is an error', pl.rows[0].action === 'error' && /Certificate type must be one of/.test(pl.rows[0].errors.join(' ')));

// =====================================================================================================================
// Live, on the test project
// =====================================================================================================================
const env = E2E_ENV;
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const a = createClient(U, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(U, AK, { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now(), started = new Date(Date.now() - 5000).toISOString();
const users = [];
const mk = async (tag, meta) => { const u = (await a.auth.admin.createUser({ email: `zz-prd-${tag}-${t}@yopmail.com`, password: pw, email_confirm: true, ...(meta ? { app_metadata: meta } : {}) })).data.user; users.push(u); return u; };
const signIn = async (email, two = true) => { const j = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } }); const x = await sb.auth.signInWithPassword({ email, password: pw }); if (x.error) throw x.error; if (two) await stepUp(sb); return { sb, cookie: [...j].map(([k, v]) => `${k}=${v}`).join('; ') }; };
const call = async (m, url, ck, body) => { const r = await fetch('http://localhost:10001' + url, { method: m, headers: { 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }); let j = {}; try { j = await r.json(); } catch { /* page */ } return { status: r.status, j }; };
const auditRows = async (action, id) => (await a.from('audit_log').select('id, action, record_id, before, after, actor_user_id').eq('action', action).eq('record_id', String(id)).gte('at', started)).data ?? [];
const auditCount = async () => (await a.from('audit_log').select('id', { count: 'exact', head: true })).count;
const counts = async () => Object.fromEntries(await Promise.all(['suppliers', 'supplier_contacts', 'products', 'product_suppliers', 'product_compliance', 'certificates', 'standards'].map(async (tb) => [tb, (await a.from(tb).select('*', { count: 'exact', head: true })).count])));
const PDF = Buffer.from(`%PDF-1.4\n% zz-prd certificate ${t}\n%%EOF\n`, 'binary');
const BUCKET = 'product-certificates';
const ids = { suppliers: [], products: [], standards: [] };
let rep = null, cust = null;

try {
  const adm2 = await mk('a2', { role: 'admin' });
  const adm = await mk('a', { role: 'admin' }), ru = await mk('r', { role: 'rep' }), cu = await mk('c');
  rep = (await a.from('reps').insert({ name: 'ZZ PRD Rep', email: ru.email, user_id: ru.id, active: true }).select('id').single()).data;
  cust = (await a.from('customers').insert({ user_id: cu.id, company_name: 'ZZ PRD Co', contact_email: cu.email, customer_code: '', rep_id: rep.id }).select('id').single()).data;
  const A = await signIn(adm.email), R = await signIn(ru.email), C = await signIn(cu.email), Apw = await signIn(adm.email, false);
  const ac = A.cookie;

  // ---- Rights: customers, reps and visitors get nothing ---------------------------------------------------------------
  const TABLES = { suppliers: 'id', supplier_contacts: 'id', products: 'id', product_suppliers: 'product_id', standards: 'id', product_compliance: 'id', certificates: 'id' };
  for (const [n, s] of [['customer', C.sb], ['rep', R.sb], ['visitor (anon)', anon]]) {
    const open = [];
    for (const [tb, col] of Object.entries(TABLES)) {
      for (const [k, q] of [['select', () => s.from(tb).select(col).limit(1)], ['insert', () => s.from(tb).insert({ [col]: null })], ['update', () => s.from(tb).update({ [col]: null }).is(col, null)], ['delete', () => s.from(tb).delete().is(col, null)]]) {
        const r = await q(); if (!r.error || r.error.code !== '42501') open.push(`${k} ${tb} (${r.error?.code ?? 'allowed'})`);
      }
    }
    ok(`${n}: select, insert, update and delete are refused (permission denied) on all 7 tables`, open.length === 0, open.slice(0, 4).join('; '));
  }
  const routes = ['/api/admin/suppliers', '/api/admin/products-catalog', '/api/admin/standards', '/api/admin/certificates'];
  for (const [n, ck] of [['customer', C.cookie], ['rep', R.cookie], ['password-only admin', Apw.cookie], ['signed-out', null]]) {
    const st = await Promise.all([...routes.map((u) => call('GET', u, ck)), call('POST', '/api/admin/catalog-import', ck, { action: 'preview' }), call('POST', '/api/admin/suppliers', ck, { name: 'ZZ PRD nope' })]);
    ok(`${n}: every sourcing route answers 401`, st.every((x) => x.status === 401), st.map((x) => x.status).join(','));
    const pg = await call('GET', '/admin/sourcing/suppliers', ck);
    ok(`${n}: the Sourcing pages send them away`, pg.status >= 300 && pg.status < 400, String(pg.status));
  }
  ok('a two-step admin opens the Sourcing pages', (await Promise.all(['suppliers', 'products', 'certificates', 'standards', 'import'].map((p) => call('GET', `/admin/sourcing/${p}`, ac)))).every((x) => x.status === 200));

  // ---- Suppliers and contacts -------------------------------------------------------------------------------------------
  let r = await call('POST', '/api/admin/suppliers', ac, { name: `ZZ PRD Factory 07 ${t}`, country: 'CN', categories: 'Gloves; Safety glasses', moq: '500', moq_unit: 'pairs', usual_incoterm: 'fob', quote_currency: 'usd', can_brand: 'yes' });
  const s1 = r.j.supplier; if (s1) ids.suppliers.push(s1.id);
  ok('supplier created: code "Supplier NN", never 07 (the name holds 07); values cleaned (FOB, USD, pairs, list)', r.status === 201 && /^Supplier \d{2,4}$/.test(s1.code) && !SC.codeHintsAtName(s1.code, s1.name) && s1.usual_incoterm === 'FOB' && s1.quote_currency === 'USD' && s1.moq_unit === 'pairs' && s1.categories.length === 2, JSON.stringify(r.j).slice(0, 200));
  let rows = await auditRows('supplier.create', s1?.id);
  ok('  one supplier.create audit row, with the code (as supplier_code: a field named "code" is hidden by the audit rules)', rows.length === 1 && rows[0].after.supplier_code === s1.code && rows[0].actor_user_id === adm.id);
  r = await call('POST', '/api/admin/suppliers', ac, { name: `  zz prd factory 07 ${t} ` });
  ok('  the same name again (any capitals and spaces) is refused', r.status === 409);
  r = await call('PATCH', `/api/admin/suppliers/${s1.id}`, ac, { code: 'Supplier 01' });
  ok('  the code never changes (refused)', r.status === 400);
  r = await call('PATCH', `/api/admin/suppliers/${s1.id}`, ac, { city: 'Ningbo', country: 'CN' });
  rows = await auditRows('supplier.edit', s1.id);
  ok('  an edit: one supplier.edit row with only the changed field (city)', r.status === 200 && rows.length === 1 && JSON.stringify(rows[0].after) === '{"city":"Ningbo"}');
  r = await call('POST', `/api/admin/suppliers/${s1.id}/contacts`, ac, { contact_name: 'ZZ Wei', email: `zz-prd-wei-${t}@yopmail.com`, whatsapp: '+86 555 0101' });
  const c1 = r.j.contact;
  r = await call('POST', `/api/admin/suppliers/${s1.id}/contacts`, ac, { contact_name: 'ZZ Li', is_primary: true });
  const c2 = r.j.contact;
  const cts = (await a.from('supplier_contacts').select('id, is_primary').eq('supplier_id', s1.id)).data ?? [];
  ok('contacts: the first is primary; a second marked primary takes over (one primary only)', c1?.is_primary === true && c2?.is_primary === true && cts.filter((x) => x.is_primary).length === 1 && cts.find((x) => x.id === c1.id)?.is_primary === false);
  ok('  each contact added writes one supplier_contact.create row', (await auditRows('supplier_contact.create', c1?.id)).length === 1 && (await auditRows('supplier_contact.create', c2?.id)).length === 1);
  r = await call('GET', '/api/admin/suppliers', ac);
  ok('  the supplier list never carries contact details', r.status === 200 && !JSON.stringify(r.j).includes('zz-prd-wei') && !JSON.stringify(r.j).includes('555 0101'));

  // ---- Standards ------------------------------------------------------------------------------------------------------
  const mkStd = async (designation, extra = {}) => { const x = await call('POST', '/api/admin/standards', ac, { designation, ...extra }); if (x.j.standard) ids.standards.push(x.j.standard.id); return x; };
  r = await mkStd(`ZZ PRD EN 388:2016+A1:2018 ${t}`, { standard: 'EN 388', edition: '2016+A1:2018', checked: true });
  ok('standards: marking checked without the date checked is refused', r.status === 400);
  r = await mkStd(`ZZ PRD EN 388:2016+A1:2018 ${t}`, { standard: 'EN 388', edition: '2016+A1:2018', provinces: 'BC; ab', source_url: 'https://example.org/en388', checked_on: '2026-11-20', checked: true });
  const sNew = r.j.standard;
  ok('standards: a checked edition records who checked it; provinces cleaned', r.status === 201 && sNew.checked && sNew.checked_by_email === adm.email && sNew.provinces.join() === 'BC,AB' && (await auditRows('standard.create', sNew.id)).length === 1);
  const sOld = (await mkStd(`ZZ PRD EN 388:2003 ${t}`, { standard: 'EN 388', edition: '2003', checked_on: '2026-11-20', checked: true })).j.standard;
  const sUnchecked = (await mkStd(`ZZ PRD ANSI/ISEA 105-2016 ${t}`)).j.standard;
  r = await mkStd(`zz prd en388:2003 ${t}`.replace(/ /g, '  '));
  ok('standards: the same text ignoring case and spaces is refused', r.status === 409);

  // ---- Products, links, claims -----------------------------------------------------------------------------------------
  r = await call('POST', '/api/admin/products-catalog', ac, { code: `ZZ-PRD-${t}`, name: 'ZZ PRD Cut glove', sourcing: 'made_to_spec', category: 'Footwear and boots' });
  ok('products: an unknown category is refused, listing the RIVIX ones', r.status === 400 && /Gloves and Hand Protection/.test(r.j.error));
  r = await call('POST', '/api/admin/products-catalog', ac, { code: `ZZ-PRD-${t}`, name: 'ZZ PRD Cut glove', sourcing: 'resold_brand' });
  ok('products: a resold brand without a brand is refused', r.status === 400);
  r = await call('POST', '/api/admin/products-catalog', ac, { code: `ZZ-PRD-${t}`, name: 'ZZ PRD Cut glove', sourcing: 'made_to_spec', category: 'gloves', sizes: 'S; M; L', carton_length_cm: '60.5', pieces_per_carton: '120' });
  const p1 = r.j.product; if (p1) ids.products.push(p1.id);
  ok('products: created (category by key; sizes as a list); one product.create row', r.status === 201 && p1.category === 'gloves' && p1.sizes.length === 3 && (await auditRows('product.create', p1.id)).length === 1, JSON.stringify(r.j).slice(0, 200));
  const p2 = (await call('POST', '/api/admin/products-catalog', ac, { code: `ZZ-PRD2-${t}`, name: 'ZZ PRD Second glove', sourcing: 'made_to_spec', category: 'Gloves and Hand Protection' })).j.product; ids.products.push(p2.id);
  r = await call('POST', `/api/admin/products-catalog/${p1.id}/suppliers`, ac, { supplier_id: s1.id, supplier_sku: 'ZZ-SKU-1', moq: '600', moq_unit: 'pairs', lead_time_days: '30' });
  ok('links: product linked to the supplier (SKU, MOQ + unit, lead time); one product_supplier.link row', r.status === 201 && (await auditRows('product_supplier.link', `${p1.id}:${s1.id}`)).length === 1);
  r = await call('DELETE', `/api/admin/suppliers/${s1.id}`, ac);
  ok('delete: a supplier with product links is refused (switch it off instead)', r.status === 409 && /Switch it off/.test(r.j.error));
  const claimA = (await call('POST', `/api/admin/products-catalog/${p1.id}/compliance`, ac, { standard_id: sNew.id, protection_type: 'Cut', protection_class: 'Level C' })).j.claim;
  const claimU = (await call('POST', `/api/admin/products-catalog/${p1.id}/compliance`, ac, { standard_id: sUnchecked.id, protection_class: 'A4' })).j.claim;
  const claimP2 = (await call('POST', `/api/admin/products-catalog/${p2.id}/compliance`, ac, { standard_id: sNew.id })).j.claim;
  ok('claims: protection type and class per claimed standard; one compliance.add row each', claimA?.protection_class === 'Level C' && (await auditRows('compliance.add', claimA.id)).length === 1 && (await auditRows('compliance.add', claimU.id)).length === 1);
  const status = async (pid, cid) => (await call('GET', `/api/admin/products-catalog/${pid}`, ac)).j.claims?.find((x) => x.id === cid)?.status;
  ok('rule (live): a claim with no certificate shows "Certificate needed"; against an unchecked standard "Standard not checked"', (await status(p1.id, claimA.id)) === 'certificate_needed' && (await status(p1.id, claimU.id)) === 'standard_not_checked');

  // ---- Certificates ---------------------------------------------------------------------------------------------------
  const upload = async (pid, sid, extra = {}, bytes = PDF, name = 'zz-prd-cert.pdf') => {
    const u = await call('POST', '/api/admin/certificates/upload-url', ac, { file_name: name, size: bytes.length });
    if (u.status !== 200) return u;
    const up = await anon.storage.from(BUCKET).uploadToSignedUrl(u.j.path, u.j.token, bytes, { contentType: 'application/pdf' });
    if (up.error) return { status: 0, j: { error: up.error.message } };
    return call('POST', '/api/admin/certificates', ac, { path: u.j.path, product_id: pid, standard_id: sid, file_name: name, document_type: 'third_party_certificate', ...extra });
  };
  r = await upload(p1.id, sNew.id, { issuing_body: 'ZZ Lab', issued_on: '2026-01-10' });
  const cA = r.j.certificate;
  ok('certificate uploaded: status "uploaded", file checked by content, SHA-256 kept; one certificate.upload row', r.status === 201 && cA.status === 'uploaded' && /^[0-9a-f]{64}$/.test(cA.file_sha256) && (await auditRows('certificate.upload', cA.id)).length === 1, JSON.stringify(r.j).slice(0, 200));
  ok('rule (live): uploaded but not verified → still "Certificate needed"', (await status(p1.id, claimA.id)) === 'certificate_needed');
  r = await upload(p1.id, sNew.id, {}, Buffer.from('<html><script>alert(1)</script></html>'), 'evil.pdf');
  ok('a file that is not really a PDF/JPEG/PNG is refused (checked by content, not by name)', r.status === 400 && /only PDF, JPEG or PNG/.test(r.j.error));
  const pendingIn = async (uid) => ((await a.storage.from(BUCKET).list(`pending/${uid}`, { limit: 100 })).data ?? []).map((x) => x.name);
  const pendingNow = async () => (await pendingIn(adm.id)).length;
  // Pending uploads belong to the admin who started them (2026-11-26).
  const A2 = await signIn(adm2.email);
  const u2 = await call('POST', '/api/admin/certificates/upload-url', A2.cookie, { file_name: 'zz-prd-other.pdf', size: PDF.length });
  const up2 = await anon.storage.from(BUCKET).uploadToSignedUrl(u2.j.path, u2.j.token, PDF, { contentType: 'application/pdf' });
  const other = String(u2.j.path ?? '').split('/').pop();
  ok('upload-url: the path is in this admin\'s own pending folder', !up2.error && u2.j.path === `pending/${adm2.id}/${other}`, String(u2.j.path));
  for (const [what, path] of [['another admin\'s pending file', u2.j.path], ['the old shape pending/<uuid>', `pending/${other}`], ['a ../ path', `pending/${adm.id}/../${adm2.id}/${other}`]]) {
    r = await call('POST', '/api/admin/certificates', ac, { path, product_id: p1.id, standard_id: sNew.id, file_name: 'x.pdf' }); // no type: the refusal path that cleans up
    ok(`  ${what} is refused before anything else, and that file is left untouched`, r.status === 400 && r.j.error === 'Upload the file first.' && (await pendingIn(adm2.id)).includes(other), `${r.status} ${r.j.error}`);
  }
  await a.storage.from(BUCKET).remove([u2.j.path]);
  const pendingBefore = await pendingNow();
  r = await upload(p1.id, sNew.id, { document_type: undefined, issuing_body: 'ZZ Lab' });
  ok('type: an upload without a document type is refused; its pending file is removed', r.status === 400 && /document type/.test(r.j.error) && (await pendingNow()) === pendingBefore, `${r.status} ${r.j.error}`);
  r = await upload(p1.id, sNew.id, { document_type: 'supplier_says_so' });
  ok('type: an unknown document type is refused', r.status === 400 && /Document type must be one of/.test(r.j.error));
  r = await upload(p1.id, sNew.id, { document_type: 'manufacturer_declaration', accreditation: 'ISO/IEC 17025' });
  ok('accreditation on a manufacturer declaration is refused', r.status === 400 && /only for an accredited lab report/.test(r.j.error));
  const direct = await a.from('certificates').insert({ product_id: p1.id, standard_id: sNew.id, file_path: `zz-prd-direct-${t}`, file_name: 'x', file_size: 1, mime_type: 'application/pdf', file_sha256: 'a'.repeat(64), document_type: 'supplier_says_so' }).select('id');
  const direct2 = await a.from('certificates').insert({ product_id: p1.id, standard_id: sNew.id, file_path: `zz-prd-direct2-${t}`, file_name: 'x', file_size: 1, mime_type: 'application/pdf', file_sha256: 'a'.repeat(64) }).select('id');
  const direct3 = await a.from('certificates').insert({ product_id: p1.id, standard_id: sNew.id, file_path: `zz-prd-direct3-${t}`, file_name: 'x', file_size: 1, mime_type: 'application/pdf', file_sha256: 'a'.repeat(64), document_type: 'third_party_certificate', expires_on: '2030-01-01', status: 'verified', verified_by: adm.id, verified_by_email: 'zz', verified_at: new Date().toISOString() }).select('id');
  ok('the database itself refuses an unknown type, a missing type and a verified document with no issuer (even with the server key)', direct.error?.code === '23514' && direct2.error?.code === '23502' && direct3.error?.code === '23514', [direct.error?.code, direct2.error?.code, direct3.error?.code].join(','));
  r = await call('POST', `/api/admin/certificates/${cA.id}/verify`, ac);
  ok('verify without an expiry date is refused', r.status === 400 && /expiry date/.test(r.j.error));
  await call('PATCH', `/api/admin/certificates/${cA.id}`, ac, { expires_on: '2030-12-31' });
  r = await call('POST', `/api/admin/certificates/${cA.id}/verify`, ac);
  ok('verified: who and when recorded; one certificate.verify row', r.status === 200 && r.j.certificate.status === 'verified' && r.j.certificate.verified_by_email === adm.email && (await auditRows('certificate.verify', cA.id)).length === 1);
  ok('rule (live): verified and unexpired, this product, this edition → "Compliant"', (await status(p1.id, claimA.id)) === 'compliant');
  ok('rule (live): the other product claiming the same edition stays "Certificate needed" (certificates are per product)', (await status(p2.id, claimP2.id)) === 'certificate_needed');
  const cOld = (await upload(p2.id, sOld.id, { expires_on: '2030-12-31', issuing_body: 'ZZ Lab' })).j.certificate;
  await call('POST', `/api/admin/certificates/${cOld.id}/verify`, ac);
  ok('rule (live): a verified certificate for ANOTHER edition (EN 388:2003) does not cover the 2016 claim', (await status(p2.id, claimP2.id)) === 'certificate_needed');
  const cU = (await upload(p1.id, sUnchecked.id, { expires_on: '2030-12-31', issuing_body: 'ZZ Lab' })).j.certificate;
  await call('POST', `/api/admin/certificates/${cU.id}/verify`, ac);
  ok('rule (live): a verified certificate against an unchecked standard → "Standard not checked"', (await status(p1.id, claimU.id)) === 'standard_not_checked');
  r = await call('PATCH', `/api/admin/certificates/${cA.id}`, ac, { expires_on: '2026-01-31' });
  ok('editing a verified certificate (expiry) removes the verification; one certificate.edit row', r.status === 200 && r.j.verificationRemoved === true && r.j.certificate.status === 'uploaded' && (await auditRows('certificate.edit', cA.id)).length === 2);
  await call('POST', `/api/admin/certificates/${cA.id}/verify`, ac);
  ok('rule (live): verified again but expired → "Expired"', (await status(p1.id, claimA.id)) === 'expired');
  r = await call('GET', '/api/admin/certificates?warning=expired', ac);
  ok('certificates page: the expired one is listed under "expired"', r.status === 200 && r.j.certificates.some((x) => x.id === cA.id && x.warning === 'expired'));
  r = await call('GET', `/api/admin/certificates/${cA.id}`, ac);
  ok('download: a short-lived link to the private file', r.status === 200 && /token=/.test(r.j.url));
  r = await call('DELETE', `/api/admin/certificates/${cA.id}`, ac);
  ok('a verified certificate cannot be deleted in one click', r.status === 409);
  await call('POST', `/api/admin/certificates/${cA.id}/unverify`, ac);
  ok('  unverify writes one certificate.unverify row', (await auditRows('certificate.unverify', cA.id)).length === 1);
  r = await call('DELETE', `/api/admin/products-catalog/${p1.id}`, ac);
  ok('delete: a product with supplier links or certificates is refused (switch it off)', r.status === 409);
  r = await call('DELETE', `/api/admin/certificates/${cA.id}`, ac);
  ok('  an unverified certificate can be deleted (file removed); one certificate.delete row', r.status === 200 && (await auditRows('certificate.delete', cA.id)).length === 1);
  r = await call('DELETE', `/api/admin/standards/${sUnchecked.id}`, ac);
  ok('delete: a standard with claims or certificates is refused', r.status === 409);

  // ---- Document types (2026-11-25) --------------------------------------------------------------------------------------
  const p3 = (await call('POST', '/api/admin/products-catalog', ac, { code: `ZZ-PRD3-${t}`, name: 'ZZ PRD Declared glove', sourcing: 'made_to_spec', category: 'gloves' })).j.product; ids.products.push(p3.id);
  const claim3 = (await call('POST', `/api/admin/products-catalog/${p3.id}/compliance`, ac, { standard_id: sNew.id })).j.claim;
  const cD = (await upload(p3.id, sNew.id, { document_type: 'manufacturer_declaration' })).j.certificate;
  r = await call('POST', `/api/admin/certificates/${cD.id}/verify`, ac);
  ok('verify without "Issued by" is refused (every type; for a declaration, the manufacturer)', r.status === 400 && /Issued by/.test(r.j.error));
  await call('PATCH', `/api/admin/certificates/${cD.id}`, ac, { issuing_body: 'ZZ PRD Manufacturer' });
  r = await call('POST', `/api/admin/certificates/${cD.id}/verify`, ac);
  rows = await auditRows('certificate.verify', cD.id);
  ok('a declaration can be verified without an expiry date; the verify audit row names its type', r.status === 200 && rows.length === 1 && rows[0].after.document_type === 'manufacturer_declaration', `${r.status} ${r.j.error ?? ''}`);
  ok('rule (live): a verified declaration only → "Manufacturer declaration only", not Compliant', (await status(p3.id, claim3.id)) === 'declaration_only');
  r = await call('GET', '/api/admin/products-catalog', ac);
  ok('  the product list counts it as "declaration only" (the list reads the type too)', r.j.products?.find((x) => x.id === p3.id)?.claims?.declaration_only === 1 && r.j.products.find((x) => x.id === p3.id).claims.compliant === 0);
  r = await call('GET', `/api/admin/certificates?product=${p3.id}`, ac);
  ok('  the certificates list shows its type and "Manufacturer declaration only"', r.j.certificates?.[0]?.document_type === 'manufacturer_declaration' && r.j.certificates[0].ruleStatus === 'Manufacturer declaration only');
  const cE = (await upload(p3.id, sNew.id, { issuing_body: 'ZZ Lab', expires_on: '2026-01-31' })).j.certificate;
  await call('POST', `/api/admin/certificates/${cE.id}/verify`, ac);
  ok('rule (live): an expired third-party certificate plus a valid declaration → "Expired"', (await status(p3.id, claim3.id)) === 'expired');
  r = await upload(p3.id, sNew.id, { document_type: 'accredited_lab_report', issuing_body: 'ZZ PRD Accredited Lab', accreditation: 'ISO/IEC 17025, SCC #ZZ', expires_on: '2030-12-31' });
  const cL = r.j.certificate;
  rows = await auditRows('certificate.upload', cL?.id);
  ok('a lab report keeps its accreditation; the upload audit row has the type and accreditation', r.status === 201 && cL.accreditation === 'ISO/IEC 17025, SCC #ZZ' && cL.document_type === 'accredited_lab_report' && rows[0]?.after.document_type === 'accredited_lab_report' && rows[0]?.after.accreditation === 'ISO/IEC 17025, SCC #ZZ');
  await call('POST', `/api/admin/certificates/${cL.id}/verify`, ac);
  ok('rule (live): a verified, unexpired accredited lab report → "Compliant"', (await status(p3.id, claim3.id)) === 'compliant');
  r = await call('PATCH', `/api/admin/certificates/${cL.id}`, ac, { document_type: 'manufacturer_declaration' });
  ok('edit: changing a lab report with an accreditation into a declaration is refused (clear the accreditation first)', r.status === 400 && /only for an accredited lab report/.test(r.j.error));
  r = await call('PATCH', `/api/admin/certificates/${cL.id}`, ac, { document_type: '' });
  ok('edit: the document type cannot be cleared', r.status === 400 && /cannot be cleared/.test(r.j.error));
  r = await call('PATCH', `/api/admin/certificates/${cL.id}`, ac, { document_type: 'manufacturer_declaration', accreditation: '' });
  rows = await auditRows('certificate.edit', cL.id);
  ok('edit: lab report → declaration removes the verification; one certificate.edit row with the type change', r.status === 200 && r.j.verificationRemoved === true && r.j.certificate.document_type === 'manufacturer_declaration' && r.j.certificate.accreditation === null && rows.length === 1 && rows[0].after.document_type === 'manufacturer_declaration' && rows[0].before.document_type === 'accredited_lab_report');
  ok('rule (live): with the lab report gone, it is "Expired" again', (await status(p3.id, claim3.id)) === 'expired');

  // ---- Supplier website (2026-11-25) -------------------------------------------------------------------------------------
  r = await call('POST', '/api/admin/suppliers', ac, { name: `ZZ PRD Bad Web ${t}`, website: 'javascript:alert(1)' });
  ok('website: a supplier with a javascript: website is refused', r.status === 400 && /web address/.test(r.j.error));
  r = await call('PATCH', `/api/admin/suppliers/${s1.id}`, ac, { website: 'https://zz-prd.example.org/factory' });
  rows = await auditRows('supplier.edit', s1.id);
  ok('website: saved on an edit; the supplier.edit row records it', r.status === 200 && r.j.supplier?.website === 'https://zz-prd.example.org/factory' && rows.some((x) => x.after?.website === 'https://zz-prd.example.org/factory'), JSON.stringify(r.j).slice(0, 200));
  r = await call('GET', `/api/admin/suppliers/${s1.id}`, ac);
  ok('website: returned on the supplier page', r.j.supplier?.website === 'https://zz-prd.example.org/factory');
  const badWeb = await a.from('suppliers').update({ website: 'javascript:alert(1)' }).eq('id', s1.id);
  ok('website: the database itself refuses a non-http(s) address', badWeb.error?.code === '23514');

  // ---- Import -------------------------------------------------------------------------------------------------------------
  const supA = `ZZ PRD Imp Supplier A ${t}`, supB = `ZZ PRD Imp Supplier B ${t}`, code1 = `ZZ-PRD-IMP-${t}`, nameOnly = `ZZ PRD Imp Name Only ${t}`, unknownStd = `ZZ PRD Unknown Std ${t}`;
  const supCsv = (city = 'Shenzhen') => csv(SH, [srow({ Supplier: supA, Country: 'CN', City: city, Categories: 'Gloves; Sleeves', MOQ: '1000', 'Lead time (days)': '45', 'Usual shipping terms': 'EXW', 'Quote currency': 'USD', 'Can do RIVIX branding?': 'Yes', 'Contact name': 'ZZ Chen', Email: `zz-prd-chen-${t}@yopmail.com`, WhatsApp: '+86 555 0199', Website: 'https://zz-prd-a.example.org' }),
    srow({ Supplier: supB, Country: 'VN', MOQ: '500', 'MOQ unit': 'pairs' })]);
  const prodCsv = csv(PH, [
    prow({ 'Product code': code1, 'Product name': 'ZZ PRD Imported glove', 'Made to spec or resold brand': 'Made to spec', Category: 'Gloves and Hand Protection', 'Supplier(s)': `${supA}; ${supB}`, 'Country of origin': 'CN', Sizes: 'M; L', 'Standard and edition': sNew.designation, 'Certificate type': 'Third-party certificate', 'Certificate issued by': 'ZZ Lab', 'Certificate expiry': '2030-06-30', 'Certificate file': 'zz-prd-import.pdf' }),
    prow({ 'Product code': code1, 'Standard and edition': unknownStd }),
    prow({ 'Product name': nameOnly, 'Made to spec or resold brand': 'Resold brand', 'Brand (if resold)': 'ZZ Brand', Category: 'ppe', 'Supplier(s)': supB }),
  ]);
  const before = await counts(), auditBefore = await auditCount();
  r = await call('POST', '/api/admin/catalog-import', ac, { action: 'preview', suppliersCsv: supCsv(), productsCsv: prodCsv });
  let plan = r.j.plan;
  ok('import dry run: per-row results; the unknown standard is an error and listed; confirm not allowed', r.status === 200 && plan.canConfirm === false && plan.unknownStandards.includes(unknownStd) && plan.rows.find((x) => x.tab === 'products' && x.row === 3)?.action === 'error', JSON.stringify(plan?.summary));
  ok('  the dry run wrote nothing (row counts and audit rows unchanged)', JSON.stringify(await counts()) === JSON.stringify(before) && (await auditCount()) === auditBefore);
  r = await call('POST', '/api/admin/catalog-import', ac, { action: 'add_standards', suppliersCsv: supCsv(), productsCsv: prodCsv, designations: plan.unknownStandards });
  const added = (await a.from('standards').select('id, checked').eq('designation', unknownStd).maybeSingle()).data; if (added) ids.standards.push(added.id);
  ok('"Add these as unchecked standards": added unchecked, one standard.create row; the preview is now clean', r.status === 200 && added && added.checked === false && (await auditRows('standard.create', added.id)).length === 1 && r.j.plan.canConfirm === true, JSON.stringify(r.j).slice(0, 300));
  // The certificate file, staged for this import.
  const batch = crypto.randomUUID();
  const st = await call('POST', '/api/admin/catalog-import/upload-url', ac, { batch, file_name: 'zz-prd-import.pdf', size: PDF.length });
  const up = st.status === 200 ? await anon.storage.from(BUCKET).uploadToSignedUrl(st.j.path, st.j.token, Buffer.concat([PDF, Buffer.from('import')]), { contentType: 'application/pdf', upsert: true }) : { error: { message: String(st.status) } };
  ok('import: certificate file staged for the batch', !up.error, up.error?.message);
  r = await call('POST', '/api/admin/catalog-import', ac, { action: 'preview', suppliersCsv: supCsv(), productsCsv: prodCsv, batch });
  plan = r.j.plan;
  ok('import preview: creates 2 suppliers, 2 products, links, 2 claims and 1 certificate ("uploaded")', plan.canConfirm && plan.ops.filter((o) => o.kind === 'supplier.create').length === 2 && plan.ops.filter((o) => o.kind === 'product.create').length === 2 && plan.ops.filter((o) => o.kind === 'claim.create').length === 2 && plan.ops.filter((o) => o.kind === 'certificate.create').length === 1, JSON.stringify(plan.summary));
  r = await call('POST', '/api/admin/catalog-import', ac, { action: 'confirm', suppliersCsv: supCsv(), productsCsv: prodCsv, batch, fingerprint: 'x'.repeat(64) });
  ok('confirm with a fingerprint that does not match the preview is refused, nothing written', r.status === 409 && (await a.from('suppliers').select('id').eq('name', supA)).data.length === 0);
  const auditMid = await auditCount();
  r = await call('POST', '/api/admin/catalog-import', ac, { action: 'confirm', suppliersCsv: supCsv(), productsCsv: prodCsv, batch, fingerprint: plan.fingerprint });
  const sA = (await a.from('suppliers').select('id, code, name, city, moq_unit, website').eq('name', supA).maybeSingle()).data, sB = (await a.from('suppliers').select('id, code, moq, moq_unit').eq('name', supB).maybeSingle()).data;
  if (sA) ids.suppliers.push(sA.id); if (sB) ids.suppliers.push(sB.id);
  const ip1 = (await a.from('products').select('id').eq('code', code1).maybeSingle()).data, ip2 = (await a.from('products').select('id, brand, category').eq('name', nameOnly).maybeSingle()).data;
  if (ip1) ids.products.push(ip1.id); if (ip2) ids.products.push(ip2.id);
  ok('import confirmed: suppliers with random codes, MOQ unit pairs for B (default pieces for A)', r.status === 200 && sA && sB && /^Supplier \d+$/.test(sA.code) && sB.moq === 500 && sB.moq_unit === 'pairs' && sA.moq_unit === 'pieces', JSON.stringify(r.j).slice(0, 300));
  const pc = (await a.from('supplier_contacts').select('contact_name, is_primary').eq('supplier_id', sA?.id ?? '00000000-0000-0000-0000-000000000000')).data ?? [];
  ok('  the primary contact was written', pc.length === 1 && pc[0].is_primary && pc[0].contact_name === 'ZZ Chen');
  ok('  the supplier website was imported', sA?.website === 'https://zz-prd-a.example.org');
  const icerts = (await a.from('certificates').select('id, status, standard_id, expires_on, issuing_body, document_type').eq('product_id', ip1?.id ?? '00000000-0000-0000-0000-000000000000')).data ?? [];
  ok('  the imported certificate is "uploaded", never "verified" (issuer and expiry kept)', icerts.length === 1 && icerts[0].status === 'uploaded' && icerts[0].expires_on === '2030-06-30' && icerts[0].issuing_body === 'ZZ Lab');
  ok('  the imported certificate keeps its type (third-party certificate)', icerts[0]?.document_type === 'third_party_certificate');
  ok('  products linked to their suppliers (glove → A and B; name-only product → B, resold, brand kept, category ppe)', (await a.from('product_suppliers').select('supplier_id').eq('product_id', ip1?.id)).data.length === 2 && ip2?.brand === 'ZZ Brand' && ip2?.category === 'ppe');
  const istat = (await call('GET', `/api/admin/products-catalog/${ip1?.id}`, ac)).j.claims ?? [];
  ok('  the imported claims: "Certificate needed" (certificate only uploaded) and "Standard not checked"', istat.length === 2 && istat.some((x) => x.status === 'certificate_needed') && istat.some((x) => x.status === 'standard_not_checked'));
  const added2 = (await a.from('audit_log').select('action').gte('id', 0).gt('at', started).in('record_id', [sA?.id, sB?.id, ip1?.id, ip2?.id, icerts[0]?.id].filter(Boolean))).data ?? [];
  ok('  audit: one row per record created (2 suppliers, 2 products, 1 certificate), plus the contact, links, claims and a summary row', r.j.writes === plan.ops.length && added2.filter((x) => x.action === 'supplier.create').length === 2 && added2.filter((x) => x.action === 'product.create').length === 2 && added2.filter((x) => x.action === 'certificate.upload').length === 1
    && (await auditCount()) - auditMid === plan.ops.length + 1, `${(await auditCount()) - auditMid} rows for ${plan.ops.length} writes`);
  // Twice: nothing changes.
  const batch2 = crypto.randomUUID();
  const st2 = await call('POST', '/api/admin/catalog-import/upload-url', ac, { batch: batch2, file_name: 'zz-prd-import.pdf', size: PDF.length });
  await anon.storage.from(BUCKET).uploadToSignedUrl(st2.j.path, st2.j.token, Buffer.concat([PDF, Buffer.from('import')]), { contentType: 'application/pdf', upsert: true });
  const c2before = await counts(), a2before = await auditCount();
  r = await call('POST', '/api/admin/catalog-import', ac, { action: 'preview', suppliersCsv: supCsv(), productsCsv: prodCsv, batch: batch2 });
  plan = r.j.plan;
  ok('running the same import again: every row "unchanged", 0 writes (the same certificate file is recognised)', plan.canConfirm && plan.summary.writes === 0 && plan.rows.every((x) => x.action === 'unchanged'), JSON.stringify(plan.rows.filter((x) => x.action !== 'unchanged')).slice(0, 300));
  r = await call('POST', '/api/admin/catalog-import', ac, { action: 'confirm', suppliersCsv: supCsv(), productsCsv: prodCsv, batch: batch2, fingerprint: plan.fingerprint });
  ok('  confirming it creates nothing and writes no audit row', r.status === 200 && r.j.writes === 0 && JSON.stringify(await counts()) === JSON.stringify(c2before) && (await auditCount()) === a2before);
  r = await call('POST', '/api/admin/catalog-import', ac, { action: 'preview', suppliersCsv: supCsv('Dongguan') });
  plan = r.j.plan;
  ok('one changed cell: one update, shown "City: Shenzhen → Dongguan"', plan.summary.update === 1 && plan.summary.writes === 1 && plan.rows[0].changes.includes('City: Shenzhen → Dongguan'));
  r = await call('POST', '/api/admin/catalog-import', ac, { action: 'confirm', suppliersCsv: supCsv('Dongguan'), fingerprint: plan.fingerprint });
  ok('  confirmed: one supplier.edit audit row for that change', r.status === 200 && r.j.writes === 1 && (await auditRows('supplier.edit', sA?.id)).length === 1 && (await a.from('suppliers').select('city').eq('id', sA.id).single()).data.city === 'Dongguan');

  // ---- No secret in this run's audit rows ------------------------------------------------------------------------------
  const mine = (await a.from('audit_log').select('*').eq('actor_user_id', adm.id).gte('at', started)).data ?? [];
  const sess = [(await A.sb.auth.getSession()).data.session?.access_token, env.SUPABASE_SECRET_KEY, AK, pw].filter(Boolean);
  ok(`no session token, key or password in this run's ${mine.length} audit rows`, mine.length > 30 && !mine.some((x) => sess.some((s) => JSON.stringify(x).includes(s))));
} catch (e) {
  ok('the product-records test ran to the end', false, e instanceof Error ? e.stack?.split('\n').slice(0, 3).join(' | ') : String(e));
} finally {
  // Certificates (rows and files), claims, links, products, contacts, suppliers, standards; staged import files; logins.
  const pids = [...new Set(ids.products.filter(Boolean))];
  const { data: zzProducts } = await a.from('products').select('id').like('name', 'ZZ PRD%'); for (const p of zzProducts ?? []) if (!pids.includes(p.id)) pids.push(p.id);
  if (pids.length) {
    const { data: cs } = await a.from('certificates').select('file_path').in('product_id', pids);
    if (cs?.length) await a.storage.from(BUCKET).remove(cs.map((c) => c.file_path));
    await a.from('certificates').delete().in('product_id', pids);
    await a.from('product_compliance').delete().in('product_id', pids);
    await a.from('product_suppliers').delete().in('product_id', pids);
    await a.from('products').delete().in('id', pids);
  }
  const { data: zzSup } = await a.from('suppliers').select('id').like('name', 'ZZ PRD%');
  const sids = [...new Set([...ids.suppliers, ...(zzSup ?? []).map((s) => s.id)].filter(Boolean))];
  if (sids.length) { await a.from('product_suppliers').delete().in('supplier_id', sids); await a.from('suppliers').delete().in('id', sids); }
  const { data: zzStd } = await a.from('standards').select('id').like('designation', 'ZZ PRD%');
  const stids = [...new Set([...ids.standards, ...(zzStd ?? []).map((s) => s.id)].filter(Boolean))];
  if (stids.length) await a.from('standards').delete().in('id', stids);
  const { data: staged } = await a.storage.from(BUCKET).list('import', { limit: 100 });
  for (const f of staged ?? []) { const { data: inner } = await a.storage.from(BUCKET).list(`import/${f.name}`, { limit: 100 }); if (inner?.length) await a.storage.from(BUCKET).remove(inner.map((x) => `import/${f.name}/${x.name}`)); }
  const { data: pending } = await a.storage.from(BUCKET).list('pending', { limit: 100 });
  for (const f of pending ?? []) { const { data: inner } = await a.storage.from(BUCKET).list(`pending/${f.name}`, { limit: 100 }); await a.storage.from(BUCKET).remove([`pending/${f.name}`, ...(inner ?? []).map((x) => `pending/${f.name}/${x.name}`)]); }
  if (cust) await a.from('customers').delete().eq('id', cust.id);
  if (rep) { await a.from('rep_activity').delete().eq('rep_id', rep.id); await a.from('reps').delete().eq('id', rep.id); }
  const uids = users.map((u) => u?.id).filter(Boolean);
  if (uids.length) await a.from('notifications').delete().in('recipient_user_id', uids);
  for (const id of uids) await a.auth.admin.deleteUser(id);
  const left = await Promise.all([a.from('suppliers').select('id').like('name', 'ZZ PRD%'), a.from('products').select('id').like('name', 'ZZ PRD%'), a.from('standards').select('id').like('designation', 'ZZ PRD%')]);
  const n = left.reduce((s, x) => s + (x.data?.length ?? 0), 0);
  ok('cleaned up: no ZZ PRD supplier, product or standard left (the audit rows stay, by design)', n === 0, `${n} left`);
}
