// Supplier and product records (2026-11-21): server-only helpers shared by the admin routes. Reads name their columns;
// every write records an audit row (src/lib/audit.ts). Customers and reps have no rights on these tables at all.
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { audit, type AuditActor, type AuditAction } from '@/lib/audit';
import { auditNames, CERT_COLUMNS, CLAIM_COLUMNS, CONTACT_COLUMNS, LINK_COLUMNS, PRODUCT_COLUMNS, PRODUCT_SPEC, STANDARD_COLUMNS, SUPPLIER_COLUMNS, checkCategory, checkFields } from '@/lib/catalog-fields';
import { planImport, planText, type Op, type Plan, type Ref, type Snapshot } from '@/lib/catalog-import';
import { CERT_BUCKET, checkCertificateFile } from '@/lib/certificate-files';
import { pickSupplierCode } from '@/lib/supplier-code';
import { businessToday, claimStatus, expiryWarning, CLAIM_LABEL, type CertFacts } from '@/lib/compliance';

export { SUPPLIER_COLUMNS, CONTACT_COLUMNS, PRODUCT_COLUMNS, LINK_COLUMNS, STANDARD_COLUMNS, CLAIM_COLUMNS, CERT_COLUMNS };
export const today = () => businessToday(new Date());

/** Collects the audit warnings of several writes into one (spread into the JSON response). */
export class AuditWarnings {
  private warning: string | undefined;
  add(r: { auditWarning?: string }) { if (r.auditWarning) this.warning = r.auditWarning; }
  get value(): { auditWarning?: string } { return this.warning ? { auditWarning: this.warning } : {}; }
}

/** A new supplier, with a random code that never hints at the name. Retries if two admins pick the same code at once. */
export async function createSupplier(admin: SupabaseClient, values: Record<string, unknown>): Promise<{ row?: Record<string, unknown>; error?: string; status?: number }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: codes } = await admin.from('suppliers').select('code');
    let code: string;
    try { code = pickSupplierCode(String(values.name ?? ''), (codes ?? []).map((c) => c.code as string), (n) => crypto.randomInt(n)); }
    catch { return { error: 'No supplier code is free.', status: 500 }; }
    const { data, error } = await admin.from('suppliers').insert({ ...values, code }).select(SUPPLIER_COLUMNS).single();
    if (!error) return { row: data };
    if (error.code === '23505' && /name_key/.test(error.message)) return { error: 'There is already a supplier with this name.', status: 409 };
    if (error.code !== '23505') return { error: error.message, status: 400 };
  }
  return { error: 'Could not choose a free supplier code. Try again.', status: 500 };
}

/** The status of each claim of a product (the certificate rule), with its certificates. */
export async function productCompliance(admin: SupabaseClient, productId: string, day = today()) {
  const [claims, certs] = await Promise.all([
    admin.from('product_compliance').select(`${CLAIM_COLUMNS}, standard:standards(id, designation, checked)`).eq('product_id', productId),
    admin.from('certificates').select(CERT_COLUMNS).eq('product_id', productId).order('expires_on', { ascending: false }),
  ]);
  const certificates = (certs.data ?? []) as Array<Record<string, unknown> & CertFacts>;
  return {
    today: day,
    claims: (claims.data ?? []).map((c) => {
      const std = (c as unknown as { standard: { id: string; designation: string; checked: boolean } }).standard;
      const status = claimStatus(c as { product_id: string; standard_id: string }, std, certificates, day);
      return { ...c, status, statusLabel: CLAIM_LABEL[status] };
    }),
    certificates: certificates.map((c) => ({ ...c, warning: expiryWarning(c.expires_on, day) })),
  };
}

// ---- Import --------------------------------------------------------------------------------------------------------

/** What the import compares against, including the staged certificate files (checked by content, with their SHA-256). */
/** `staging` is the admin's own staging folder from stagingPrefix(userId, batch), or null when no files are attached. */
export async function importSnapshot(admin: SupabaseClient, staging: string | null): Promise<Snapshot> {
  const [s, c, p, l, st, cl, ce, cat] = await Promise.all([
    admin.from('suppliers').select(SUPPLIER_COLUMNS),
    admin.from('supplier_contacts').select(CONTACT_COLUMNS).eq('is_primary', true),
    admin.from('products').select(PRODUCT_COLUMNS),
    admin.from('product_suppliers').select('product_id, supplier_id'),
    admin.from('standards').select('id, designation, checked'),
    admin.from('product_compliance').select('product_id, standard_id'),
    admin.from('certificates').select('product_id, standard_id, file_sha256'),
    admin.from('garment_categories').select('key, label').eq('active', true).order('sort'),
  ]);
  for (const r of [s, c, p, l, st, cl, ce, cat]) if (r.error) throw new Error(`import snapshot: ${r.error.message}`);
  const files: Snapshot['files'] = [];
  if (staging) {
    const { data: list } = await admin.storage.from(CERT_BUCKET).list(staging, { limit: 200 });
    for (const f of list ?? []) {
      const { data: blob } = await admin.storage.from(CERT_BUCKET).download(`${staging}/${f.name}`);
      const bytes = blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array();
      const chk = checkCertificateFile(bytes);
      files.push({ name: f.name, size: bytes.length, sha256: 'error' in chk ? null : crypto.createHash('sha256').update(bytes).digest('hex'), type: 'error' in chk ? null : chk.type, error: 'error' in chk ? chk.error : null });
    }
  }
  return {
    suppliers: (s.data ?? []) as Snapshot['suppliers'], primaryContacts: (c.data ?? []) as Snapshot['primaryContacts'], products: (p.data ?? []) as Snapshot['products'],
    links: l.data ?? [], standards: st.data ?? [], claims: cl.data ?? [], certificates: ce.data ?? [], categories: cat.data ?? [], files,
  } as Snapshot;
}

export function previewOf(plan: Plan) {
  return { ...plan, fingerprint: crypto.createHash('sha256').update(planText(plan)).digest('hex') };
}
export async function preview(admin: SupabaseClient, input: { suppliersCsv?: string; productsCsv?: string }, staging: string | null) {
  return previewOf(planImport(input, await importSnapshot(admin, staging)));
}

const ROUTE = 'POST /api/admin/catalog-import';
/** Runs the writes of a confirmed plan in order, one audit row per record created or changed, then one summary row. Stops at
 *  the first failure and says how far it got (running the import again picks up the rest: nothing is ever duplicated). */
export async function applyPlan(admin: SupabaseClient, actor: AuditActor, plan: Plan & { fingerprint: string }, staging: string | null) {
  const warn = new AuditWarnings();
  const newSupplier = new Map<string, string>(), newProduct = new Map<string, string>();
  const idOf = (r: Ref) => ('id' in r ? r.id : 'newSupplier' in r ? newSupplier.get(r.newSupplier) : newProduct.get(r.newProduct)) as string;
  const log = async (action: AuditAction, table: string, id: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null) =>
    warn.add(await audit(admin, actor, { action, table, id, route: ROUTE, before, after }));
  let done = 0;
  const fail = (op: Op, message: string) => ({ ok: false as const, done, error: `Stopped at write ${done + 1} of ${plan.ops.length} (${op.kind}): ${message}. ${done} writes were made; run the import again to finish (nothing is duplicated).`, ...warn.value });
  for (const op of plan.ops) {
    if (op.kind === 'supplier.create') {
      const r = await createSupplier(admin, op.values);
      if (!r.row) return fail(op, r.error ?? 'could not create the supplier');
      newSupplier.set(op.key, r.row.id as string);
      await log('supplier.create', 'suppliers', r.row.id as string, null, auditNames({ ...op.values, code: r.row.code }, 'supplier_code'));
    } else if (op.kind === 'supplier.update') {
      const { error } = await admin.from('suppliers').update(op.values).eq('id', op.id);
      if (error) return fail(op, error.message);
      await log('supplier.edit', 'suppliers', op.id, Object.fromEntries(Object.entries(op.changes).map(([k, v]) => [k, v[0]])), op.values);
    } else if (op.kind === 'contact.create') {
      const sid = idOf(op.supplier);
      const { data, error } = await admin.from('supplier_contacts').insert({ ...op.values, supplier_id: sid, is_primary: true }).select('id').single();
      if (error) return fail(op, error.message);
      await log('supplier_contact.create', 'supplier_contacts', data.id, null, { supplier_id: sid, is_primary: true, ...op.values });
    } else if (op.kind === 'contact.update') {
      const { error } = await admin.from('supplier_contacts').update(op.values).eq('id', op.id);
      if (error) return fail(op, error.message);
      await log('supplier_contact.edit', 'supplier_contacts', op.id, Object.fromEntries(Object.entries(op.changes).map(([k, v]) => [k, v[0]])), op.values);
    } else if (op.kind === 'product.create') {
      const { data, error } = await admin.from('products').insert(op.values).select('id').single();
      if (error) return fail(op, error.message);
      newProduct.set(op.key, data.id);
      await log('product.create', 'products', data.id, null, auditNames(op.values, 'product_code'));
    } else if (op.kind === 'product.update') {
      const { error } = await admin.from('products').update(op.values).eq('id', op.id);
      if (error) return fail(op, error.message);
      await log('product.edit', 'products', op.id, auditNames(Object.fromEntries(Object.entries(op.changes).map(([k, v]) => [k, v[0]])), 'product_code'), auditNames(op.values, 'product_code'));
    } else if (op.kind === 'link.create') {
      const pid = idOf(op.product), sid = idOf(op.supplier);
      const { error } = await admin.from('product_suppliers').insert({ product_id: pid, supplier_id: sid });
      if (error && error.code !== '23505') return fail(op, error.message);
      if (!error) await log('product_supplier.link', 'product_suppliers', `${pid}:${sid}`, null, { product: op.productLabel, supplier: op.supplierName });
    } else if (op.kind === 'claim.create') {
      const pid = idOf(op.product);
      const { data, error } = await admin.from('product_compliance').insert({ product_id: pid, standard_id: op.standardId }).select('id').single();
      if (error && error.code !== '23505') return fail(op, error.message);
      if (data) await log('compliance.add', 'product_compliance', data.id, null, { product: op.productLabel, standard: op.designation });
    } else if (op.kind === 'certificate.create') {
      const pid = idOf(op.product);
      const ext = op.type === 'application/pdf' ? 'pdf' : op.type === 'image/png' ? 'png' : 'jpg';
      const path = `${pid}/${crypto.randomUUID()}.${ext}`;
      const cp = await admin.storage.from(CERT_BUCKET).copy(`${staging as string}/${op.file}`, path);
      if (cp.error) return fail(op, `the file ${op.file} could not be stored: ${cp.error.message}`);
      const { data, error } = await admin.from('certificates').insert({
        product_id: pid, standard_id: op.standardId, document_type: op.document_type, issuing_body: op.issuing_body, accreditation: op.accreditation, expires_on: op.expires_on, file_path: path, file_name: op.file, file_size: op.size,
        mime_type: op.type, file_sha256: op.sha256, status: 'uploaded', uploaded_by: actor.userId, uploaded_by_email: actor.email,
      }).select('id').single();
      if (error) { await admin.storage.from(CERT_BUCKET).remove([path]); return fail(op, error.message); }
      await log('certificate.upload', 'certificates', data.id, null, { product: op.productLabel, standard: op.designation, file_name: op.file, file_sha256: op.sha256, document_type: op.document_type, issuing_body: op.issuing_body, accreditation: op.accreditation, expires_on: op.expires_on, status: 'uploaded' });
    }
    done++;
  }
  // A run with nothing to write (the same file again) leaves no trace: no summary row either.
  if (done) await log('catalog_import.run', 'catalog_import', plan.fingerprint.slice(0, 16), null, { ...plan.summary, writes: done });
  if (staging) await clearStaging(admin, staging);
  return { ok: true as const, done, ...warn.value };
}

export async function clearStaging(admin: SupabaseClient, staging: string) {
  const { data } = await admin.storage.from(CERT_BUCKET).list(staging, { limit: 200 });
  const paths = (data ?? []).map((f) => `${staging}/${f.name}`);
  if (paths.length) await admin.storage.from(CERT_BUCKET).remove(paths);
}

/** Product fields from a form, with the category checked against the RIVIX categories and the brand rule. */
export async function productValues(admin: SupabaseClient, body: Record<string, unknown>, partial: boolean, existing?: { sourcing: string; brand: string | null }) {
  const f = checkFields(PRODUCT_SPEC.filter((x) => x.column !== 'category'), body, partial ? 'update' : 'create');
  if ('category' in body) {
    const { data: cats } = await admin.from('garment_categories').select('key, label').eq('active', true).order('sort');
    const cat = checkCategory(body.category, cats ?? []);
    if ('error' in cat) f.errors.push(cat.error); else f.values.category = cat.value;
  }
  if (!partial && !f.values.sourcing) f.errors.push('"Made to spec or resold brand" is required.');
  const sourcing = f.values.sourcing ?? existing?.sourcing, brand = 'brand' in f.values ? f.values.brand : existing?.brand;
  if (sourcing === 'resold_brand' && !brand) f.errors.push('Brand (if resold) is required for a resold brand.');
  return f;
}
