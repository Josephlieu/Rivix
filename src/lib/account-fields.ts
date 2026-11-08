// Which account fields a customer may change, and how. Pure (no database), shared by the API routes and the e2e test.
// Relative imports only, so the e2e test can load this file directly.

// Saved straight away by the customer.
export const DIRECT_FIELDS = ['contact_name', 'contact_phone'] as const;
// Sent to RIVIX as a change request; applied only when an admin approves it.
export const REQUEST_FIELDS = ['company_name', 'login_email', 'billing_address', 'shipping_address'] as const;

export type DirectField = (typeof DIRECT_FIELDS)[number];
export type RequestField = (typeof REQUEST_FIELDS)[number];

export const FIELD_LABELS: Record<DirectField | RequestField, string> = {
  contact_name: 'Contact name',
  contact_phone: 'Phone',
  company_name: 'Company name',
  login_email: 'Login email',
  billing_address: 'Billing address',
  shipping_address: 'Shipping address',
};

export const isRequestField = (v: unknown): v is RequestField => typeof v === 'string' && (REQUEST_FIELDS as readonly string[]).includes(v);

const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;
const PHONE = /^[0-9+().\-\s]*(?:(?:ext\.?|x)\s*\d{1,6})?$/i;

// Checks one value. Returns the clean value to save (null = clear it) or an error message for the customer.
export function checkField(field: DirectField | RequestField, raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw !== null && raw !== undefined && typeof raw !== 'string') return { ok: false, error: `${FIELD_LABELS[field]} must be text.` };
  const multiLine = field === 'billing_address' || field === 'shipping_address';
  const v = String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .join(multiLine ? '\n' : ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  switch (field) {
    case 'contact_name':
      return v.length > 120 ? { ok: false, error: 'Contact name can be at most 120 characters.' } : { ok: true, value: v || null };
    case 'contact_phone':
      if (v.length > 40) return { ok: false, error: 'Phone can be at most 40 characters.' };
      if (!PHONE.test(v) || (v && !/\d/.test(v))) return { ok: false, error: 'Phone can only contain numbers, spaces, + ( ) - and an extension.' };
      return { ok: true, value: v || null };
    case 'company_name':
      if (!v) return { ok: false, error: 'Company name cannot be empty.' };
      return v.length > 200 ? { ok: false, error: 'Company name can be at most 200 characters.' } : { ok: true, value: v };
    case 'login_email': {
      const e = v.toLowerCase();
      if (!e) return { ok: false, error: 'Login email cannot be empty.' };
      return e.length > 254 || !EMAIL.test(e) ? { ok: false, error: 'Enter a valid email address.' } : { ok: true, value: e };
    }
    case 'billing_address':
    case 'shipping_address':
      return v.length > 500 ? { ok: false, error: `${FIELD_LABELS[field]} can be at most 500 characters.` } : { ok: true, value: v || null };
  }
}

// The body of a direct edit: only DIRECT_FIELDS, at least one, all valid. Any other key is refused, so the browser can
// never name a row (customer_id, id) or touch another field (company_name, rep_id, ...).
export function checkDirectEdit(body: unknown): { ok: true; update: Partial<Record<DirectField, string | null>> } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Bad request' };
  const keys = Object.keys(body);
  const other = keys.filter((k) => !(DIRECT_FIELDS as readonly string[]).includes(k));
  if (other.length) return { ok: false, error: `These fields cannot be changed here: ${other.join(', ')}.` };
  if (!keys.length) return { ok: false, error: 'Nothing to update.' };
  const update: Partial<Record<DirectField, string | null>> = {};
  for (const k of keys as DirectField[]) {
    const r = checkField(k, (body as Record<string, unknown>)[k]);
    if (!r.ok) return r;
    update[k] = r.value;
  }
  return { ok: true, update };
}
