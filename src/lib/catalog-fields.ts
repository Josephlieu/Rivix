// Supplier and product records (2026-11-21): the column lists every route reads (never select('*')) and the field rules
// the forms and the CSV import share. Pure (relative imports only; the tests load this file directly).
// Values arrive as JSON from the admin forms or as CSV text from the import; both go through the same checks. A blank
// value means "not given": on create it is saved as empty, on an update it is left out (the current value is kept).

export const SUPPLIER_COLUMNS = 'id, code, name, country, city, categories, moq, moq_unit, lead_time_days, payment_terms, usual_incoterm, quote_currency, factory_certifications, can_brand, notes, active, created_at, updated_at';
export const CONTACT_COLUMNS = 'id, supplier_id, contact_name, email, whatsapp, is_primary, created_at, updated_at';
export const PRODUCT_COLUMNS = 'id, code, name, sourcing, brand, category, country_of_origin, sizes, colours, unit_weight_g, pieces_per_carton, carton_length_cm, carton_width_cm, carton_height_cm, carton_weight_kg, notes, active, created_at, updated_at';
export const LINK_COLUMNS = 'product_id, supplier_id, supplier_sku, moq, moq_unit, lead_time_days, created_at';
export const STANDARD_COLUMNS = 'id, designation, standard, edition, title, provinces, source_url, checked, checked_on, checked_by_email, notes, created_at, updated_at';
export const CLAIM_COLUMNS = 'id, product_id, standard_id, protection_type, protection_class, created_at, updated_at';
export const CERT_COLUMNS = 'id, product_id, standard_id, issuing_body, issued_on, expires_on, file_name, file_size, mime_type, file_sha256, status, verified_by_email, verified_at, uploaded_by_email, created_at, updated_at';

export const INCOTERM_CODES = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;
export const MOQ_UNITS = ['pieces', 'pairs', 'boxes'] as const;
export const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'] as const;
export const SOURCING = ['made_to_spec', 'resold_brand'] as const;

/** Names compared the way the database does: trimmed, spaces collapsed, any capitals. */
export const nameKey = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
/** A standard's full text compared ignoring case and every space. */
export const designationKey = (v: unknown) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
export type Kind =
  | { t: 'text'; max: number; required?: boolean }
  | { t: 'list'; max: number }
  | { t: 'int'; min: number }
  | { t: 'dec'; places: number }
  | { t: 'bool' }
  | { t: 'enum'; values: readonly string[]; aliases?: Record<string, string> }
  | { t: 'currency' }
  | { t: 'email' }
  | { t: 'url' }
  | { t: 'date' }
  | { t: 'provinces' };

/** One value checked; returns { value } or { error }. Blank → { value: null } (or [] for lists). */
export function checkValue(v: unknown, k: Kind, label: string): { value: unknown } | { error: string } {
  if (isBlank(v)) {
    if (k.t === 'text' && k.required) return { error: `${label} is required.` };
    return { value: k.t === 'list' || k.t === 'provinces' ? [] : null };
  }
  const s = typeof v === 'string' ? v.trim() : v;
  switch (k.t) {
    case 'text': { const x = String(s); return x.length > k.max ? { error: `${label} is longer than ${k.max} characters.` } : { value: x }; }
    case 'list': {
      const parts = (Array.isArray(s) ? s.map(String) : String(s).split(';')).map((x) => x.trim()).filter(Boolean);
      const uniq = [...new Map(parts.map((x) => [x.toLowerCase(), x])).values()];
      if (uniq.length > 50) return { error: `${label} has more than 50 items.` };
      if (uniq.some((x) => x.length > k.max)) return { error: `${label}: an item is longer than ${k.max} characters.` };
      return { value: uniq };
    }
    case 'int': {
      const x = typeof s === 'number' ? String(s) : String(s).replace(/[\s,]/g, '');
      if (!/^\d+$/.test(x) || Number(x) > 2_000_000_000) return { error: `${label} must be a whole number (got "${String(s)}").` };
      return Number(x) < k.min ? { error: `${label} must be at least ${k.min}.` } : { value: Number(x) };
    }
    case 'dec': {
      const x = String(s).replace(/\s/g, '');
      const re = new RegExp(`^\\d+(\\.\\d{1,${k.places}})?$`);
      return re.test(x) ? { value: x } : { error: `${label} must be a number with at most ${k.places} decimals (got "${String(s)}").` };
    }
    case 'bool': {
      if (typeof s === 'boolean') return { value: s };
      const x = String(s).toLowerCase();
      if (['yes', 'y', 'true'].includes(x)) return { value: true };
      if (['no', 'n', 'false'].includes(x)) return { value: false };
      return { error: `${label} must be yes or no (got "${String(s)}").` };
    }
    case 'enum': {
      const x = String(s).trim();
      const hit = k.values.find((e) => e.toLowerCase() === x.toLowerCase()) ?? k.aliases?.[x.toLowerCase().replace(/\s+/g, ' ')];
      return hit ? { value: hit } : { error: `${label} must be one of: ${k.values.join(', ')} (got "${x}").` };
    }
    case 'currency': { const x = String(s).toUpperCase(); return /^[A-Z]{3}$/.test(x) ? { value: x } : { error: `${label} must be a 3-letter currency code such as USD or CAD (got "${String(s)}").` }; }
    case 'email': { const x = String(s); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) && x.length <= 254 ? { value: x } : { error: `${label} is not a valid email address.` }; }
    case 'url': { const x = String(s); return /^https?:\/\/\S+$/.test(x) && x.length <= 500 ? { value: x } : { error: `${label} must be a web address starting with http:// or https://.` }; }
    case 'date': {
      const x = String(s);
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(x) && (() => { const [y, m, d] = x.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; })();
      return ok ? { value: x } : { error: `${label} must be a real date written YYYY-MM-DD (got "${x}").` };
    }
    case 'provinces': {
      const parts = (Array.isArray(s) ? s.map(String) : String(s).split(';')).map((x) => x.trim().toUpperCase()).filter(Boolean);
      const bad = parts.filter((x) => !(PROVINCES as readonly string[]).includes(x));
      return bad.length ? { error: `${label}: unknown province code ${bad.join(', ')} (use ${PROVINCES.join(', ')}).` } : { value: [...new Set(parts)] };
    }
  }
}

export interface FieldSpec { column: string; label: string; kind: Kind }
export const SUPPLIER_SPEC: FieldSpec[] = [
  { column: 'name', label: 'Supplier', kind: { t: 'text', max: 200, required: true } },
  { column: 'country', label: 'Country', kind: { t: 'text', max: 100 } },
  { column: 'city', label: 'City', kind: { t: 'text', max: 100 } },
  { column: 'categories', label: 'Categories', kind: { t: 'list', max: 100 } },
  { column: 'moq', label: 'MOQ', kind: { t: 'int', min: 0 } },
  { column: 'moq_unit', label: 'MOQ unit', kind: { t: 'enum', values: MOQ_UNITS, aliases: { piece: 'pieces', pcs: 'pieces', pc: 'pieces', pair: 'pairs', box: 'boxes' } } },
  { column: 'lead_time_days', label: 'Lead time (days)', kind: { t: 'int', min: 0 } },
  { column: 'payment_terms', label: 'Payment terms', kind: { t: 'text', max: 300 } },
  { column: 'usual_incoterm', label: 'Usual shipping terms', kind: { t: 'enum', values: INCOTERM_CODES } },
  { column: 'quote_currency', label: 'Quote currency', kind: { t: 'currency' } },
  { column: 'factory_certifications', label: 'Factory certifications', kind: { t: 'list', max: 100 } },
  { column: 'can_brand', label: 'Can do RIVIX branding?', kind: { t: 'bool' } },
  { column: 'notes', label: 'Notes', kind: { t: 'text', max: 4000 } },
  { column: 'active', label: 'Active', kind: { t: 'bool' } },
];
export const CONTACT_SPEC: FieldSpec[] = [
  { column: 'contact_name', label: 'Contact name', kind: { t: 'text', max: 200 } },
  { column: 'email', label: 'Email', kind: { t: 'email' } },
  { column: 'whatsapp', label: 'WhatsApp', kind: { t: 'text', max: 40 } },
];
export const PRODUCT_SPEC: FieldSpec[] = [
  { column: 'code', label: 'Product code', kind: { t: 'text', max: 60 } },
  { column: 'name', label: 'Product name', kind: { t: 'text', max: 200, required: true } },
  { column: 'sourcing', label: 'Made to spec or resold brand', kind: { t: 'enum', values: SOURCING, aliases: { 'made to spec': 'made_to_spec', 'made-to-spec': 'made_to_spec', spec: 'made_to_spec', 'resold brand': 'resold_brand', resold: 'resold_brand', 'resold-brand': 'resold_brand' } } },
  { column: 'brand', label: 'Brand (if resold)', kind: { t: 'text', max: 200 } },
  { column: 'category', label: 'Category', kind: { t: 'text', max: 100 } }, // resolved to a RIVIX category key by checkCategory
  { column: 'country_of_origin', label: 'Country of origin', kind: { t: 'text', max: 100 } },
  { column: 'sizes', label: 'Sizes', kind: { t: 'list', max: 40 } },
  { column: 'colours', label: 'Colours', kind: { t: 'list', max: 60 } },
  { column: 'unit_weight_g', label: 'Unit weight (g)', kind: { t: 'int', min: 0 } },
  { column: 'pieces_per_carton', label: 'Pieces per carton', kind: { t: 'int', min: 1 } },
  { column: 'carton_length_cm', label: 'Carton length (cm)', kind: { t: 'dec', places: 2 } },
  { column: 'carton_width_cm', label: 'Carton width (cm)', kind: { t: 'dec', places: 2 } },
  { column: 'carton_height_cm', label: 'Carton height (cm)', kind: { t: 'dec', places: 2 } },
  { column: 'carton_weight_kg', label: 'Carton weight (kg)', kind: { t: 'dec', places: 3 } },
  { column: 'notes', label: 'Notes', kind: { t: 'text', max: 4000 } },
  { column: 'active', label: 'Active', kind: { t: 'bool' } },
];
export const LINK_SPEC: FieldSpec[] = [
  { column: 'supplier_sku', label: "Supplier's SKU", kind: { t: 'text', max: 100 } },
  { column: 'moq', label: 'MOQ', kind: { t: 'int', min: 0 } },
  { column: 'moq_unit', label: 'MOQ unit', kind: { t: 'enum', values: MOQ_UNITS, aliases: { piece: 'pieces', pcs: 'pieces', pair: 'pairs', box: 'boxes' } } },
  { column: 'lead_time_days', label: 'Lead time (days)', kind: { t: 'int', min: 0 } },
];
export const STANDARD_SPEC: FieldSpec[] = [
  { column: 'designation', label: 'Standard and edition (as written)', kind: { t: 'text', max: 200, required: true } },
  { column: 'standard', label: 'Standard', kind: { t: 'text', max: 150 } },
  { column: 'edition', label: 'Edition', kind: { t: 'text', max: 60 } },
  { column: 'title', label: 'Title', kind: { t: 'text', max: 300 } },
  { column: 'provinces', label: 'Provinces that accept it', kind: { t: 'provinces' } },
  { column: 'source_url', label: 'Source', kind: { t: 'url' } },
  { column: 'checked_on', label: 'Date checked', kind: { t: 'date' } },
  { column: 'notes', label: 'Notes', kind: { t: 'text', max: 2000 } },
];
export const CLAIM_SPEC: FieldSpec[] = [
  { column: 'protection_type', label: 'Protection type', kind: { t: 'text', max: 200 } },
  { column: 'protection_class', label: 'Protection class', kind: { t: 'text', max: 100 } },
];

/**
 * Checks the fields of `input` (keys = column names) against a spec. Keys not in the spec are ignored.
 *   'create': every spec field is set (blank → empty); required fields must be given.
 *   'update': only the keys present are checked; a blank one clears the value (required fields cannot be cleared).
 *   'import': only the keys present AND not blank are checked; a blank cell keeps the current value (decision 3).
 */
export type FieldMode = 'create' | 'update' | 'import';
export function checkFields(spec: FieldSpec[], input: Record<string, unknown>, mode: FieldMode): { values: Record<string, unknown>; errors: string[] } {
  const values: Record<string, unknown> = {}, errors: string[] = [];
  for (const f of spec) {
    const present = Object.prototype.hasOwnProperty.call(input, f.column);
    if (mode !== 'create' && !present) continue;
    if (mode === 'import' && isBlank(input[f.column])) continue;
    if (mode === 'create' && !present && (f.column === 'active' || f.column === 'moq_unit')) continue; // the database defaults
    if (mode === 'update' && isBlank(input[f.column]) && (f.column === 'moq_unit' || f.column === 'active')) continue; // never cleared
    const r = checkValue(input[f.column], f.kind, f.label);
    if ('error' in r) errors.push(r.error); else values[f.column] = r.value;
  }
  return { values, errors };
}

/** The RIVIX category key for a category given as its key or its name (any capitals and spaces). */
export function checkCategory(v: unknown, categories: Array<{ key: string; label: string }>): { value: string | null } | { error: string } {
  if (isBlank(v)) return { value: null };
  const k = nameKey(v);
  const hit = categories.find((c) => nameKey(c.key) === k || nameKey(c.label) === k);
  return hit ? { value: hit.key } : { error: `Category "${String(v).trim()}" is not a RIVIX category. Use one of: ${categories.map((c) => c.label).join('; ')}.` };
}

/** Field-by-field difference (only columns in `next`), for previews and the audit log. */
export function diffRow(before: Record<string, unknown> | null, next: Record<string, unknown>): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const [k, v] of Object.entries(next)) {
    const old = before ? before[k] ?? null : null;
    if (!sameValue(old, v)) out[k] = [old, v ?? null];
  }
  return out;
}
/** Equal as stored: numbers and decimal text compared as numbers ("12.50" = 12.5), lists ignoring order. */
export function sameValue(a: unknown, b: unknown): boolean {
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = (Array.isArray(a) ? a : []).map(String).sort(), y = (Array.isArray(b) ? b : []).map(String).sort();
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  const num = (v: unknown) => (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) ? String(v).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : null);
  const na = num(a), nb = num(b);
  if (na !== null && nb !== null) return na === nb;
  return String(a) === String(b);
}

/** The audit log hides any field named exactly "code" (a sign-in code). Supplier and product codes are not secrets, so audit
 *  rows name them supplier_code / product_code. */
export function auditNames(values: Record<string, unknown> | null, codeKey: 'supplier_code' | 'product_code'): Record<string, unknown> | null {
  if (!values) return values;
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k === 'code' ? codeKey : k, v]));
}
