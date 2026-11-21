// Supplier and product import (2026-11-21). Pure: the CSV text of the two tabs and a snapshot of what the database holds go
// in; a plan comes out (per row: create, update, unchanged or error, with every change as old → new), plus the ordered list
// of writes. The dry run shows the plan; confirming re-plans against fresh data and refuses if it differs from the preview.
// Rules (audit-docs decisions, 2026-11-21):
//   - exact headers (any capitals and spaces); "MOQ unit" is optional; an unknown or missing header refuses the file;
//   - lists in a cell are separated by ";"; a blank cell on an update keeps the current value;
//   - suppliers match by name, products by code (or by name when the row has no code); running it twice changes nothing;
//   - Products: one row per standard, repeating the product code; product fields on repeated rows must match or be blank;
//   - an unknown standard is an error (listed, with the option to add them as unchecked standards first);
//   - category: a RIVIX category (key or name); supplier categories are free text;
//   - an imported standard is a claim; a certificate is created only when its file is attached, always as "uploaded".
import Papa from 'papaparse';
import {
  CONTACT_SPEC, PRODUCT_SPEC, SUPPLIER_SPEC, checkCategory, checkFields, checkValue, designationKey, diffRow, nameKey, sameValue,
} from './catalog-fields';

export const SUPPLIER_HEADERS = ['Supplier', 'Country', 'City', 'Categories', 'MOQ', 'MOQ unit', 'Lead time (days)', 'Payment terms', 'Usual shipping terms', 'Quote currency', 'Factory certifications', 'Can do RIVIX branding?', 'Contact name', 'Email', 'WhatsApp', 'Notes'] as const;
export const OPTIONAL_SUPPLIER_HEADERS = ['MOQ unit'];
export const PRODUCT_HEADERS = ['Product code', 'Product name', 'Made to spec or resold brand', 'Brand (if resold)', 'Category', 'Supplier(s)', 'Country of origin', 'Sizes', 'Colours', 'Unit weight (g)', 'Pieces per carton', 'Carton length (cm)', 'Carton width (cm)', 'Carton height (cm)', 'Carton weight (kg)', 'Standard and edition', 'Certificate issued by', 'Certificate expiry', 'Certificate file', 'Notes'] as const;

const SUPPLIER_COLUMN: Record<string, string> = {
  Supplier: 'name', Country: 'country', City: 'city', Categories: 'categories', MOQ: 'moq', 'MOQ unit': 'moq_unit', 'Lead time (days)': 'lead_time_days',
  'Payment terms': 'payment_terms', 'Usual shipping terms': 'usual_incoterm', 'Quote currency': 'quote_currency', 'Factory certifications': 'factory_certifications',
  'Can do RIVIX branding?': 'can_brand', 'Contact name': 'contact_name', Email: 'email', WhatsApp: 'whatsapp', Notes: 'notes',
};
const PRODUCT_COLUMN: Record<string, string> = {
  'Product code': 'code', 'Product name': 'name', 'Made to spec or resold brand': 'sourcing', 'Brand (if resold)': 'brand', Category: 'category',
  'Country of origin': 'country_of_origin', Sizes: 'sizes', Colours: 'colours', 'Unit weight (g)': 'unit_weight_g', 'Pieces per carton': 'pieces_per_carton',
  'Carton length (cm)': 'carton_length_cm', 'Carton width (cm)': 'carton_width_cm', 'Carton height (cm)': 'carton_height_cm', 'Carton weight (kg)': 'carton_weight_kg', Notes: 'notes',
};
const PRODUCT_FIELDS = PRODUCT_SPEC.filter((f) => f.column !== 'active');
const SUPPLIER_FIELDS = SUPPLIER_SPEC.filter((f) => f.column !== 'active');

export interface Snapshot {
  suppliers: Array<Record<string, unknown> & { id: string; name: string }>;
  primaryContacts: Array<{ id: string; supplier_id: string; contact_name: string | null; email: string | null; whatsapp: string | null }>;
  products: Array<Record<string, unknown> & { id: string; code: string | null; name: string; sourcing: string; brand: string | null }>;
  links: Array<{ product_id: string; supplier_id: string }>;
  standards: Array<{ id: string; designation: string; checked: boolean }>;
  claims: Array<{ product_id: string; standard_id: string }>;
  certificates: Array<{ product_id: string; standard_id: string; file_sha256: string }>;
  categories: Array<{ key: string; label: string }>;
  /** The certificate files attached to this import (already checked by the server: type and SHA-256, or why refused). */
  files: Array<{ name: string; size: number; sha256: string | null; type: string | null; error: string | null }>;
}

/** A reference to a record: an existing id, or one created earlier in this same import. */
export type Ref = { id: string } | { newSupplier: string } | { newProduct: string };
export type Op =
  | { kind: 'supplier.create'; key: string; values: Record<string, unknown> }
  | { kind: 'supplier.update'; id: string; values: Record<string, unknown>; changes: Record<string, [unknown, unknown]> }
  | { kind: 'contact.create'; supplier: Ref; values: Record<string, unknown> }
  | { kind: 'contact.update'; id: string; supplierId: string; values: Record<string, unknown>; changes: Record<string, [unknown, unknown]> }
  | { kind: 'product.create'; key: string; values: Record<string, unknown> }
  | { kind: 'product.update'; id: string; values: Record<string, unknown>; changes: Record<string, [unknown, unknown]> }
  | { kind: 'link.create'; product: Ref; supplier: Ref; productLabel: string; supplierName: string }
  | { kind: 'claim.create'; product: Ref; standardId: string; productLabel: string; designation: string }
  | { kind: 'certificate.create'; product: Ref; standardId: string; productLabel: string; designation: string; file: string; sha256: string; type: string; size: number; issuing_body: string | null; expires_on: string | null };

export interface RowPlan { tab: 'suppliers' | 'products'; row: number; label: string; action: 'create' | 'update' | 'unchanged' | 'error'; errors: string[]; warnings: string[]; changes: string[] }
export interface Plan {
  fileErrors: string[];
  rows: RowPlan[];
  ops: Op[];
  unknownStandards: string[];
  summary: { create: number; update: number; unchanged: number; error: number; writes: number };
  canConfirm: boolean;
}

const norm = (h: string) => h.trim().replace(/\s+/g, ' ').toLowerCase();
const show = (v: unknown) => (v === null || v === undefined || (Array.isArray(v) && !v.length) ? '(empty)' : Array.isArray(v) ? v.join('; ') : String(v));
const changeText = (c: Record<string, [unknown, unknown]>, labels: Record<string, string>) => Object.entries(c).map(([k, [a, b]]) => `${labels[k] ?? k}: ${show(a)} → ${show(b)}`);
const LABELS: Record<string, string> = Object.fromEntries([...SUPPLIER_SPEC, ...CONTACT_SPEC, ...PRODUCT_SPEC].map((f) => [f.column, f.label]));

/** Reads one tab: checks the headers and returns the rows as { header: cell } (sheet row numbers from 2). */
export function readTab(text: string | undefined, headers: readonly string[], optional: string[], tab: string): { rows: Array<{ row: number; cells: Record<string, string> }>; errors: string[] } {
  if (text === undefined || text === null || !String(text).trim()) return { rows: [], errors: [] };
  const parsed = Papa.parse<string[]>(String(text).replace(/^﻿/, ''), { skipEmptyLines: 'greedy' });
  if (parsed.errors.length) return { rows: [], errors: parsed.errors.slice(0, 5).map((e) => `${tab}: CSV problem on row ${(e.row ?? 0) + 1}: ${e.message}`) };
  const [head, ...body] = parsed.data;
  if (!head) return { rows: [], errors: [`${tab}: the file is empty.`] };
  const known = new Map(headers.map((h) => [norm(h), h]));
  const seen = new Map<string, number>(), errors: string[] = [];
  head.forEach((h, i) => {
    const k = norm(String(h ?? ''));
    if (!k) { errors.push(`${tab}: column ${i + 1} has no header.`); return; }
    if (!known.has(k)) { errors.push(`${tab}: unknown column "${String(h).trim()}". The columns are: ${headers.join(', ')}.`); return; }
    if (seen.has(k)) errors.push(`${tab}: the column "${known.get(k)}" appears twice.`);
    seen.set(k, i);
  });
  for (const h of headers) if (!seen.has(norm(h)) && !optional.includes(h)) errors.push(`${tab}: the column "${h}" is missing.`);
  if (errors.length) return { rows: [], errors };
  if (body.length > 5000) return { rows: [], errors: [`${tab}: more than 5000 rows; split the file.`] };
  const rows = body.map((r, i) => ({ row: i + 2, cells: Object.fromEntries(headers.map((h) => [h, seen.has(norm(h)) ? String(r[seen.get(norm(h)) as number] ?? '').trim() : ''])) }));
  return { rows, errors: [] };
}

export function planImport(input: { suppliersCsv?: string; productsCsv?: string }, db: Snapshot): Plan {
  const s = readTab(input.suppliersCsv, SUPPLIER_HEADERS, OPTIONAL_SUPPLIER_HEADERS, 'Suppliers');
  const p = readTab(input.productsCsv, PRODUCT_HEADERS, [], 'Products');
  const fileErrors = [...s.errors, ...p.errors];
  if (!fileErrors.length && !s.rows.length && !p.rows.length) fileErrors.push('Nothing to import: attach the Suppliers and/or Products CSV.');
  const rows: RowPlan[] = [], ops: Op[] = [];
  const unknown = new Map<string, string>();
  if (fileErrors.length) return finish();

  // ---- Suppliers ----------------------------------------------------------------------------------------------------
  const supplierByKey = new Map(db.suppliers.map((x) => [nameKey(x.name), x]));
  const contactBySupplier = new Map(db.primaryContacts.map((c) => [c.supplier_id, c]));
  const newSuppliers = new Map<string, string>(); // key -> name as written
  const supplierRows = new Map<string, number>();
  for (const r of s.rows) {
    const plan: RowPlan = { tab: 'suppliers', row: r.row, label: r.cells.Supplier || '(no name)', action: 'unchanged', errors: [], warnings: [], changes: [] };
    rows.push(plan);
    const mapped = Object.fromEntries(Object.entries(r.cells).map(([h, v]) => [SUPPLIER_COLUMN[h], v]));
    const key = nameKey(mapped.name);
    if (!key) { plan.errors.push('Supplier is required.'); continue; }
    if (supplierRows.has(key)) { plan.errors.push(`This supplier is already on row ${supplierRows.get(key)}; use one row per supplier.`); continue; }
    supplierRows.set(key, r.row);
    const f = checkFields(SUPPLIER_FIELDS, mapped, 'import');
    const c = checkFields(CONTACT_SPEC, mapped, 'import');
    plan.errors.push(...f.errors, ...c.errors);
    if (plan.errors.length) continue;
    const existing = supplierByKey.get(key);
    if (!existing) {
      ops.push({ kind: 'supplier.create', key, values: f.values });
      newSuppliers.set(key, String(f.values.name));
      plan.action = 'create'; plan.changes.push(`New supplier: ${String(f.values.name)}`);
      if (Object.keys(c.values).length) { ops.push({ kind: 'contact.create', supplier: { newSupplier: key }, values: c.values }); plan.changes.push('Primary contact added'); }
    } else {
      const { name: _n, ...rest } = f.values; void _n; // the name matched (any capitals and spaces): it is not rewritten
      const changes = diffRow(existing, rest);
      if (Object.keys(changes).length) {
        const values = Object.fromEntries(Object.keys(changes).map((k) => [k, rest[k]]));
        ops.push({ kind: 'supplier.update', id: existing.id, values, changes });
        plan.action = 'update'; plan.changes.push(...changeText(changes, LABELS));
      }
      if (Object.keys(c.values).length) {
        const pc = contactBySupplier.get(existing.id);
        if (!pc) { ops.push({ kind: 'contact.create', supplier: { id: existing.id }, values: c.values }); plan.action = 'update'; plan.changes.push('Primary contact added'); }
        else {
          const cc = diffRow(pc as unknown as Record<string, unknown>, c.values);
          if (Object.keys(cc).length) {
            ops.push({ kind: 'contact.update', id: pc.id, supplierId: existing.id, values: Object.fromEntries(Object.keys(cc).map((k) => [k, c.values[k]])), changes: cc });
            plan.action = 'update'; plan.changes.push(...changeText(cc, LABELS).map((x) => `Primary contact ${x}`));
          }
        }
      }
    }
  }

  // ---- Products -----------------------------------------------------------------------------------------------------
  const productByCode = new Map(db.products.filter((x) => x.code).map((x) => [nameKey(x.code), x]));
  const productsByName = new Map<string, typeof db.products>();
  for (const x of db.products) { const k = nameKey(x.name); productsByName.set(k, [...(productsByName.get(k) ?? []), x]); }
  const standardByKey = new Map(db.standards.map((x) => [designationKey(x.designation), x]));
  const linkSet = new Set(db.links.map((l) => `${l.product_id}|${l.supplier_id}`));
  const claimSet = new Set(db.claims.map((c) => `${c.product_id}|${c.standard_id}`));
  const certSet = new Set(db.certificates.map((c) => `${c.product_id}|${c.standard_id}|${c.file_sha256}`));
  const fileByName = new Map(db.files.map((f) => [f.name.trim().toLowerCase(), f]));

  type Group = { key: string; first: RowPlan; merged: Record<string, unknown>; from: Record<string, number>; rows: Array<{ plan: RowPlan; cells: Record<string, string> }> };
  const groups = new Map<string, Group>();
  for (const r of p.rows) {
    const code = r.cells['Product code'], name = r.cells['Product name'];
    const plan: RowPlan = { tab: 'products', row: r.row, label: [code, name].filter(Boolean).join(' ') || '(no code or name)', action: 'unchanged', errors: [], warnings: [], changes: [] };
    rows.push(plan);
    if (!code && !name) { plan.errors.push('Give a product code or a product name.'); continue; }
    const key = code ? `code:${nameKey(code)}` : `name:${nameKey(name)}`;
    let g = groups.get(key);
    if (!g) { g = { key, first: plan, merged: {}, from: {}, rows: [] }; groups.set(key, g); }
    g.rows.push({ plan, cells: r.cells });
    // Repeated rows: each product field must match the earlier rows or be blank.
    for (const [h, col] of Object.entries(PRODUCT_COLUMN)) {
      const v = r.cells[h];
      if (!v) continue;
      if (col in g.merged && !sameValue(nameKey(g.merged[col]), nameKey(v))) plan.errors.push(`${h} "${v}" conflicts with row ${g.from[col]} ("${String(g.merged[col])}"). Repeated rows must match or be blank.`);
      else if (!(col in g.merged)) { g.merged[col] = v; g.from[col] = r.row; }
    }
  }

  for (const g of groups.values()) {
    if (g.rows.some((x) => x.plan.errors.length)) continue;
    const plan = g.first;
    const f = checkFields(PRODUCT_FIELDS.filter((x) => x.column !== 'category'), g.merged, 'import');
    const cat = checkCategory(g.merged.category, db.categories);
    if ('error' in cat) f.errors.push(cat.error); else if (cat.value) f.values.category = cat.value;
    // Which product: by code, or by name when there is no code.
    let existing: (typeof db.products)[number] | undefined;
    if (g.key.startsWith('code:')) existing = productByCode.get(g.key.slice(5));
    else {
      const same = productsByName.get(g.key.slice(5)) ?? [];
      if (same.length > 1) f.errors.push(`${same.length} products are called "${String(g.merged.name)}"; add the product code to say which one.`);
      existing = same.length === 1 ? same[0] : undefined;
    }
    if (!existing) {
      if (!f.values.name) f.errors.push('Product name is required for a new product.');
      if (!f.values.sourcing) f.errors.push('"Made to spec or resold brand" is required for a new product.');
    }
    const sourcing = f.values.sourcing ?? existing?.sourcing, brand = f.values.brand ?? existing?.brand;
    if (sourcing === 'resold_brand' && !brand) f.errors.push('Brand (if resold) is required for a resold brand.');
    plan.errors.push(...f.errors);
    const productLabel = String(f.values.code ?? existing?.code ?? f.values.name ?? existing?.name ?? '');
    let ref: Ref | null = null;
    if (!plan.errors.length) {
      if (!existing) {
        ops.push({ kind: 'product.create', key: g.key, values: f.values });
        ref = { newProduct: g.key }; plan.action = 'create'; plan.changes.push(`New product: ${productLabel}`);
      } else {
        ref = { id: existing.id };
        // The code matched ignoring capitals: a case-only difference is not an edit.
        if (f.values.code !== undefined && existing.code && nameKey(f.values.code) === nameKey(existing.code)) delete f.values.code;
        const changes = diffRow(existing, f.values);
        if (Object.keys(changes).length) {
          ops.push({ kind: 'product.update', id: existing.id, values: Object.fromEntries(Object.keys(changes).map((k) => [k, f.values[k]])), changes });
          plan.action = 'update'; plan.changes.push(...changeText(changes, LABELS));
        }
      }
    }
    const pid = ref && 'id' in ref ? ref.id : null;

    // Suppliers named on any row of this product.
    const linked = new Set<string>();
    for (const { plan: rp, cells } of g.rows) {
      const names = checkValue(cells['Supplier(s)'], { t: 'list', max: 200 }, 'Supplier(s)');
      if ('error' in names) { rp.errors.push(names.error); continue; }
      for (const n of names.value as string[]) {
        const k = nameKey(n);
        if (linked.has(k)) continue;
        linked.add(k);
        const ex = supplierByKey.get(k);
        if (!ex && !newSuppliers.has(k)) { rp.errors.push(`Supplier "${n}" is not in the database or the Suppliers tab.`); continue; }
        if (!ref) continue;
        if (ex && pid && linkSet.has(`${pid}|${ex.id}`)) continue;
        ops.push({ kind: 'link.create', product: ref, supplier: ex ? { id: ex.id } : { newSupplier: k }, productLabel, supplierName: ex?.name ?? newSuppliers.get(k) ?? n });
        if (rp.action === 'unchanged') rp.action = rp === plan && plan.action === 'create' ? 'create' : 'update';
        rp.changes.push(`Linked to supplier ${ex?.name ?? n}`);
      }
    }
    // Standards, claims and certificates: one standard per row.
    const claimed = new Set<string>();
    for (const { plan: rp, cells } of g.rows) {
      const d = cells['Standard and edition'];
      const file = cells['Certificate file'], issuer = cells['Certificate issued by'], expiry = cells['Certificate expiry'];
      if (!d) { if (file || issuer || expiry) rp.errors.push('Certificate columns need a "Standard and edition" on the same row.'); continue; }
      const st = standardByKey.get(designationKey(d));
      if (!st) { rp.errors.push(`Unknown standard "${d}". Add it to the standards reference (or use "Add these as unchecked standards").`); if (!unknown.has(designationKey(d))) unknown.set(designationKey(d), d); continue; }
      let exp: string | null = null;
      if (expiry) { const e = checkValue(expiry, { t: 'date' }, 'Certificate expiry'); if ('error' in e) { rp.errors.push(e.error); continue; } exp = e.value as string; }
      if (issuer && issuer.length > 200) { rp.errors.push('Certificate issued by is longer than 200 characters.'); continue; }
      if (!ref) continue;
      const ck = `${st.id}`;
      if (!claimed.has(ck) && !(pid && claimSet.has(`${pid}|${st.id}`))) {
        ops.push({ kind: 'claim.create', product: ref, standardId: st.id, productLabel, designation: st.designation });
        if (rp.action === 'unchanged') rp.action = 'update';
        rp.changes.push(`Claims ${st.designation}${st.checked ? '' : ' (standard not checked)'}`);
      }
      claimed.add(ck);
      if (!file) { if (issuer || expiry) rp.warnings.push('No certificate file named: no certificate is created; the claim shows "Certificate needed".'); continue; }
      const attached = fileByName.get(file.trim().toLowerCase());
      if (!attached) { rp.warnings.push(`Certificate file "${file}" was not attached: no certificate is created; the claim shows "Certificate needed".`); continue; }
      if (attached.error || !attached.sha256 || !attached.type) { rp.errors.push(`Certificate file "${file}": ${attached.error ?? 'could not be read'}.`); continue; }
      if (pid && certSet.has(`${pid}|${st.id}|${attached.sha256}`)) continue; // the same file is already this product's certificate
      ops.push({ kind: 'certificate.create', product: ref, standardId: st.id, productLabel, designation: st.designation, file: attached.name, sha256: attached.sha256, type: attached.type, size: attached.size, issuing_body: issuer || null, expires_on: exp });
      if (rp.action === 'unchanged') rp.action = 'update';
      rp.changes.push(`Certificate ${attached.name} for ${st.designation} (uploaded, to be verified by an admin)`);
    }
  }
  return finish();

  function finish(): Plan {
    for (const r of rows) if (r.errors.length) r.action = 'error';
    const order = ['supplier.create', 'supplier.update', 'contact.create', 'contact.update', 'product.create', 'product.update', 'link.create', 'claim.create', 'certificate.create'];
    const sorted = [...ops].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    const count = (a: RowPlan['action']) => rows.filter((r) => r.action === a).length;
    const error = count('error');
    return {
      fileErrors, rows, ops: sorted, unknownStandards: [...unknown.values()],
      summary: { create: count('create'), update: count('update'), unchanged: count('unchanged'), error, writes: sorted.length },
      canConfirm: !fileErrors.length && error === 0,
    };
  }
}

/** A stable text of the writes, so a confirm can prove it does exactly what the preview showed. */
export function planText(plan: Plan): string {
  const stable = (v: unknown): unknown => (Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])])) : v);
  return JSON.stringify(stable(plan.ops));
}
