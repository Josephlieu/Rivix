// Customer catalogue built around product FAMILIES (2026-11-26, approved). Pure: relative imports only, no clock, no
// database; the tests load this file directly. Customers browse families, enter their own spec, sizes and quantities, and
// request a quote. Nothing here ever carries supplier, cost, margin or factory information.
//
// Customer-typed text (the spec, notes, branding) is stored exactly as typed and is only ever shown as PLAIN TEXT: React
// text nodes, escaped email HTML (never linkified), textarea values, PDF text. specLines() makes the text lines. If this
// text is ever sent to an AI, it goes as a quoted data field (for example JSON), never as part of the instructions.
import { cleanSizeLabel } from './sizes';
import { claimStatus, type CertFacts } from './compliance';

export const MAX_OPTION_GROUPS = 12;
export const MAX_CHOICES = 20;
export const MAX_LINES = 25;
export const MAX_IMAGES = 10;
export const MAX_OPEN_SAMPLES = 10;
export const MAX_SAMPLE_QTY = 20;
export const ONE_SIZE = 'One size';
export const OTHER_PREFIX = 'Other: ';
export const SPEC_LIMITS = { label: 60, choice: 80, other: 120, colour: 60, branding: 300, details: 2000, note: 2000, reason: 500 } as const;
export const FAMILY_CODE = /^[A-Z0-9][A-Z0-9-]{1,19}$/;
/** The customer wording (Joseph, 2026-11-26): never imply every option is certified. */
export const CERT_NOTE = 'Certification depends on the exact fabric and design; your rep will confirm.';
export const ASK_REP = 'Ask your rep about certification';
export const PRICE_ON_QUOTE = 'Price on quote';

/** The columns of product_families every customer and rep route reads (no supplier, cost, margin or factory field exists). */
export const FAMILY_PUBLIC_COLUMNS = 'id, code, name, category, description, typical_options, typical_sizes, typical_colours, sort';
export const FAMILY_ADMIN_COLUMNS = `${FAMILY_PUBLIC_COLUMNS}, visible_to_customers, active, created_at, updated_at`;
export const IMAGE_COLUMNS = 'id, family_id, file_name, file_size, mime_type, sort, alt_text, created_at';
export const SETTINGS_COLUMNS = 'min_order_qty, note_below_qty, updated_at, updated_by_email';
export const SAMPLE_COLUMNS = 'id, customer_id, family_id, spec, quantity, note, status, decided_by_email, decided_at, decline_reason, created_at';

export type OptionGroup = { label: string; choices: string[] };
export type Spec = { options: Array<{ label: string; value: string }>; colour: string | null; standard: string | null; branding: string | null; details: string | null };
export type SizeQty = { size: string; qty: number };
export type Settings = { min_order_qty: number; note_below_qty: number };

// Text a person typed: trimmed, at most `max` characters; NUL and other control characters (except new line and tab) are
// refused rather than silently removed, so what is stored is exactly what was typed.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
function typed(v: unknown, max: number, label: string): { value: string | null } | { error: string } {
  if (v === undefined || v === null) return { value: null };
  if (typeof v !== 'string') return { error: `${label} must be text.` };
  const x = v.trim();
  if (!x) return { value: null };
  if (CONTROL.test(x)) return { error: `${label} contains characters that cannot be stored.` };
  return x.length > max ? { error: `${label} is longer than ${max} characters.` } : { value: x };
}

/** A family's typical options, as an admin enters them: at most 12 groups of at most 20 choices; labels unique. */
export function checkOptions(v: unknown): { value: OptionGroup[] } | { error: string } {
  if (v === undefined || v === null || v === '') return { value: [] };
  if (!Array.isArray(v)) return { error: 'Typical options must be a list of groups.' };
  if (v.length > MAX_OPTION_GROUPS) return { error: `At most ${MAX_OPTION_GROUPS} option groups.` };
  const out: OptionGroup[] = [], seen = new Set<string>();
  for (const [i, g] of v.entries()) {
    const label = typed((g as OptionGroup)?.label, SPEC_LIMITS.label, `Option group ${i + 1}`);
    if ('error' in label) return label;
    if (!label.value) return { error: `Option group ${i + 1} needs a name.` };
    if (seen.has(label.value.toLowerCase())) return { error: `The option group "${label.value}" appears twice.` };
    seen.add(label.value.toLowerCase());
    const raw = (g as OptionGroup)?.choices;
    if (!Array.isArray(raw) || !raw.length) return { error: `"${label.value}" needs at least one choice.` };
    if (raw.length > MAX_CHOICES) return { error: `"${label.value}" has more than ${MAX_CHOICES} choices.` };
    const choices: string[] = [], cs = new Set<string>();
    for (const c of raw) {
      const t = typed(c, SPEC_LIMITS.choice, `A choice in "${label.value}"`);
      if ('error' in t) return t;
      if (!t.value || cs.has(t.value.toLowerCase())) continue;
      cs.add(t.value.toLowerCase()); choices.push(t.value);
    }
    if (!choices.length) return { error: `"${label.value}" needs at least one choice.` };
    out.push({ label: label.value, choices });
  }
  return { value: out };
}

/** A list of short labels (sizes or colours) from "a; b" text or an array: cleaned, no duplicates, at most 40. */
export function checkLabelList(v: unknown, label: string, max = 40): { value: string[] } | { error: string } {
  if (v === undefined || v === null || v === '') return { value: [] };
  const parts = (Array.isArray(v) ? v.map(String) : String(v).split(';')).map((x) => cleanSizeLabel(x)).filter(Boolean);
  const uniq = [...new Map(parts.map((x) => [x.toLowerCase(), x])).values()];
  if (uniq.length > max) return { error: `${label}: at most ${max}.` };
  if (uniq.some((x) => CONTROL.test(x))) return { error: `${label} contains characters that cannot be stored.` };
  return { value: uniq };
}

/** The fields an admin edits on a family. mode 'create' needs code, name and category. Keys not listed are ignored. */
export function checkFamily(input: Record<string, unknown>, mode: 'create' | 'update', categories: string[]): { values: Record<string, unknown>; errors: string[] } {
  const values: Record<string, unknown> = {}, errors: string[] = [];
  const has = (k: string) => mode === 'create' || Object.prototype.hasOwnProperty.call(input, k);
  if (has('code')) {
    const c = String(input.code ?? '').trim().toUpperCase();
    if (!FAMILY_CODE.test(c)) errors.push('Family code: 2 to 20 capital letters, digits or dashes (for example FR-COV).'); else values.code = c;
  }
  if (has('name')) { const n = typed(input.name, 120, 'Name'); if ('error' in n) errors.push(n.error); else if (!n.value) errors.push('Name is required.'); else values.name = n.value; }
  if (has('category')) { const c = String(input.category ?? ''); if (!categories.includes(c)) errors.push('Choose a RIVIX category.'); else values.category = c; }
  if (has('description')) { const d = typed(input.description, 4000, 'Description'); if ('error' in d) errors.push(d.error); else values.description = d.value; }
  if (has('typical_options')) { const o = checkOptions(input.typical_options); if ('error' in o) errors.push(o.error); else values.typical_options = o.value; }
  if (has('typical_sizes')) { const s = checkLabelList(input.typical_sizes, 'Typical sizes'); if ('error' in s) errors.push(s.error); else values.typical_sizes = s.value; }
  if (has('typical_colours')) { const s = checkLabelList(input.typical_colours, 'Typical colours'); if ('error' in s) errors.push(s.error); else values.typical_colours = s.value; }
  if (has('sort')) { const n = Number(input.sort ?? 0); if (!Number.isInteger(n) || Math.abs(n) > 100000) errors.push('Sort must be a whole number.'); else values.sort = n; }
  for (const k of ['visible_to_customers', 'active'] as const) {
    if (!Object.prototype.hasOwnProperty.call(input, k)) continue;
    if (typeof input[k] !== 'boolean') errors.push(`${k === 'active' ? 'Active' : 'Published'} must be true or false.`); else values[k] = input[k];
  }
  return { values, errors };
}

/**
 * The customer's spec for one family. `options` is { [group label]: chosen value }: a listed choice, or "Other: <text>".
 * `shownStandards` are the designations the family page shows (backed); the customer may pick one of them, or none.
 */
export function checkSpec(input: unknown, family: { typical_options: OptionGroup[] }, shownStandards: string[]): { value: Spec } | { error: string } {
  const s = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const rawOpts = s.options && typeof s.options === 'object' && !Array.isArray(s.options) ? (s.options as Record<string, unknown>) : {};
  const options: Spec['options'] = [];
  for (const [label, raw] of Object.entries(rawOpts)) {
    const g = family.typical_options.find((x) => x.label === label);
    if (!g) return { error: `"${label}" is not an option of this product.` };
    const v = typed(raw, SPEC_LIMITS.other + OTHER_PREFIX.length, label);
    if ('error' in v) return v;
    if (!v.value) continue;
    if (v.value.startsWith(OTHER_PREFIX)) {
      const own = typed(v.value.slice(OTHER_PREFIX.length), SPEC_LIMITS.other, `${label} (other)`);
      if ('error' in own) return own;
      if (!own.value) return { error: `${label}: describe your own choice.` };
      options.push({ label: g.label, value: `${OTHER_PREFIX}${own.value}` });
    } else if (g.choices.includes(v.value)) options.push({ label: g.label, value: v.value });
    else return { error: `${label}: choose one of the listed options, or "Other" and describe it.` };
  }
  options.sort((a, b) => family.typical_options.findIndex((g) => g.label === a.label) - family.typical_options.findIndex((g) => g.label === b.label));
  const colour = typed(s.colour, SPEC_LIMITS.colour, 'Colour'); if ('error' in colour) return colour;
  const branding = typed(s.branding, SPEC_LIMITS.branding, 'Branding'); if ('error' in branding) return branding;
  const details = typed(s.details, SPEC_LIMITS.details, 'Your spec'); if ('error' in details) return details;
  const std = typed(s.standard, 200, 'Standard'); if ('error' in std) return std;
  if (std.value && !shownStandards.includes(std.value)) return { error: 'Choose a standard shown for this product, or none (ask your rep).' };
  return { value: { options, colour: colour.value, standard: std.value, branding: branding.value, details: details.value } };
}

/** Sizes and quantities. A family without typical sizes takes one quantity as "One size". */
export function checkSizes(v: unknown): { value: SizeQty[] } | { error: string } {
  const raw = Array.isArray(v) ? v : [];
  const out: SizeQty[] = [], seen = new Set<string>();
  for (const r of raw) {
    const qtyRaw = (r as SizeQty)?.qty;
    if (qtyRaw === undefined || qtyRaw === null || (qtyRaw as unknown) === '' || Number(qtyRaw) === 0) continue; // an empty box
    const size = cleanSizeLabel((r as SizeQty)?.size);
    const qty = Number(qtyRaw);
    if (!size) return { error: 'A size is missing its name.' };
    if (CONTROL.test(size)) return { error: 'A size contains characters that cannot be stored.' };
    if (!Number.isInteger(qty) || qty < 1 || qty > 1_000_000) return { error: `Size ${size} needs a whole number from 1 to 1,000,000.` };
    if (seen.has(size.toLowerCase())) return { error: `Size ${size} is listed twice.` };
    seen.add(size.toLowerCase()); out.push({ size, qty });
  }
  if (!out.length) return { error: 'Enter how many you need.' };
  if (out.length > 40) return { error: 'At most 40 sizes.' };
  return { value: out };
}
export const lineTotal = (sizes: SizeQty[]) => sizes.reduce((n, s) => n + s.qty, 0);

/** The minimum rule, per line: refused below the minimum; a gentle note below the note level; never blocked above 50. */
export function minimumCheck(total: number, s: Settings): { ok: true; note: string | null } | { ok: false; error: string } {
  if (total < s.min_order_qty) return { ok: false, error: `The minimum per product is ${s.min_order_qty} pieces (this line has ${total}).` };
  if (total < s.note_below_qty) return { ok: true, note: `Small runs (under ${s.note_below_qty}) can cost more per piece; your rep will confirm.` };
  return { ok: true, note: null };
}
/** Settings an admin may save: minimum 1 to 50 (never block above 50), note level at or above the minimum. */
export function checkSettings(input: Record<string, unknown>, current: Settings): { value: Settings } | { error: string } {
  const min = input.min_order_qty === undefined ? current.min_order_qty : Number(input.min_order_qty);
  const note = input.note_below_qty === undefined ? current.note_below_qty : Number(input.note_below_qty);
  if (!Number.isInteger(min) || min < 1 || min > 50) return { error: 'The customer minimum must be a whole number from 1 to 50.' };
  if (!Number.isInteger(note) || note < min || note > 1_000_000) return { error: 'The note level must be a whole number at or above the minimum.' };
  return { value: { min_order_qty: min, note_below_qty: note } };
}

/** Plain text lines for a line's spec (boards, emails, order notes). Customer text is kept exactly; it is never markup. */
export function specLines(spec: Partial<Spec> | null | undefined): string[] {
  if (!spec || typeof spec !== 'object') return [];
  const out: string[] = [];
  for (const o of Array.isArray(spec.options) ? spec.options : []) if (o && typeof o.label === 'string') out.push(`${o.label}: ${String(o.value ?? '')}`);
  if (spec.colour) out.push(`Colour: ${spec.colour}`);
  if (spec.standard) out.push(`Standard requested: ${spec.standard}`);
  if (spec.branding) out.push(`Branding: ${spec.branding}`);
  if (spec.details) out.push(`Customer spec: ${spec.details}`);
  return out;
}

/** The order_requests item for one cart line (kind 'quote'). Extra keys stay in the JSON column; no schema change. */
export function toRequestItem(line: { spec: Spec; sizes: SizeQty[] }, family: { id: string; code: string; name: string }) {
  return { product_name: family.name, family_id: family.id, family_code: family.code, spec: line.spec, sizes: line.sizes, branding: line.spec.branding };
}

/** For the New Order form: Fabric from a "Fabric" option, Safety standard from the chosen standard, the rest as note text. */
export function orderFormFromSpec(spec: Partial<Spec> | null | undefined): { fabric: string; safety_standard: string; rest: string[] } {
  if (!spec) return { fabric: '', safety_standard: '', rest: [] };
  const opts = Array.isArray(spec.options) ? spec.options : [];
  const fabric = opts.find((o) => /^fabric$/i.test(o.label))?.value ?? '';
  const rest = specLines({ ...spec, options: opts.filter((o) => !/^fabric$/i.test(o.label)), standard: null, branding: null });
  return { fabric: String(fabric).slice(0, 300), safety_standard: String(spec.standard ?? ''), rest };
}

/**
 * Which of a family's standards customers may see: only those with at least one ACTIVE product linked to the family
 * holding a Compliant claim (a verified, unexpired third-party certificate or accredited lab report) for that exact edition.
 */
export function backedStandards(
  familyStandards: Array<{ standard_id: string; designation: string; checked: boolean }>,
  products: Array<{ id: string; active: boolean }>,
  claims: Array<{ product_id: string; standard_id: string }>,
  certificates: CertFacts[],
  today: string,
): string[] {
  const active = new Set(products.filter((p) => p.active).map((p) => p.id));
  return familyStandards
    .filter((fs) => claims.some((c) => c.standard_id === fs.standard_id && active.has(c.product_id) && claimStatus(c, { checked: fs.checked }, certificates, today) === 'compliant'))
    .map((fs) => fs.designation);
}
