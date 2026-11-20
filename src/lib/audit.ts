// Server only (audit log, 2026-11-21): one append-only record per important action: who (user id, role, email at the
// time), what (action), which record (table + id), when (set by the database), the changed fields before and after, and the
// route PATTERN that did it (never the real address: /api/rep-invites/<token> carries a secret).
// Rows are never edited or deleted: the database refuses UPDATE, DELETE and TRUNCATE (trigger), and the service role has only
// SELECT and INSERT. Secret fields are hidden here by name and again by the database's insert trigger (same list).
// A failed write never undoes the action: the route returns AUDIT_NOT_RECORDED as `auditWarning`, and the server logs one
// line (action, record, actor id, route; no values) so the missing row can be added later.
import type { SupabaseClient } from '@supabase/supabase-js';

export const AUDIT_ACTIONS = {
  'tech_file.approve': 'Tech file approved',
  'tech_file.confirm': 'Tech file items confirmed',
  'tech_file.customer_approval_added': "Customer's approval attached",
  'order.stage_change': 'Order stage changed',
  'account_request.approve': 'Account change approved',
  'account_request.reject': 'Account change rejected',
  'order_request.decline': 'Order request declined',
  'order_request.convert': 'Order request turned into an order',
  'rep_invite.create': 'Rep invite created',
  'rep_invite.cancel': 'Rep invite cancelled',
  'rep_invite.accept': 'Rep invite accepted (account created)',
  'rep_invite.approve': 'Rep approved after an invite',
  'rep.status_change': 'Rep set active or inactive',
  'role.grant': 'Role given',
  'role.revoke': 'Role removed',
  'admin_2fa.enrolled': 'Admin two-step sign-in set up',
  'admin_2fa.reset': 'Admin two-step sign-in reset',
  'catalog.upload': 'Catalogue uploaded',
  'catalog.replace_file': 'Catalogue file replaced',
  'catalog.delete': 'Catalogue deleted',
  'document.upload': 'Document uploaded',
  'document.delete': 'Document deleted',
  'product_spec.upload': 'Product spec uploaded',
  'product_spec.replace_file': 'Product spec file replaced',
  'product_spec.remove_file': 'Product spec file removed',
  'product_spec.delete': 'Product spec deleted',
  'template.create': 'Template created',
  'template.edit': 'Template edited',
  'template.version': 'Template version saved',
  'category.create': 'Category created',
  'category.edit': 'Category edited',
  'type.create': 'Product type created',
  'type.edit': 'Product type edited',
} as const;
export type AuditAction = keyof typeof AUDIT_ACTIONS;
export const isAuditAction = (v: unknown): v is AuditAction => typeof v === 'string' && Object.prototype.hasOwnProperty.call(AUDIT_ACTIONS, v);

export type AuditRole = 'admin' | 'rep' | 'customer' | 'system';
export interface AuditActor { userId: string | null; role: AuditRole; email: string | null }
export interface AuditEntry {
  action: AuditAction;
  table: string;
  id: string | number;
  route: string; // the route pattern, e.g. 'PATCH /api/admin/orders/[id]'
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  note?: string | null;
}

export const AUDIT_NOT_RECORDED = 'The change was saved, but it could not be written to the audit log. Tell the developer.';
export const HIDDEN = '[hidden]';

export const adminActor = (who: { userId: string; email: string }): AuditActor => ({ userId: who.userId, role: 'admin', email: who.email });

// ---- Hidden fields (keep in step with public.audit_hidden_name / audit_hidden_value in 92-audit-log.sql) ----------------
// Names are compared after camelCase becomes snake_case (apiKey -> api_key, QRCode -> qr_code) and other separators become _.
/** Hidden wherever the word appears in the name. */
export const HIDDEN_SUBSTRINGS = ['password', 'passwd', 'secret', 'token', 'api_key', 'apikey', 'private_key', 'service_role_key', 'publishable_key', 'anon_key'] as const;
/** Hidden when the name ends with it. */
export const HIDDEN_SUFFIXES = ['_hash'] as const;
/** Hidden only when the name is exactly this (short words: customer_code, rep_code, key stay visible). */
export const HIDDEN_EXACT = ['code', 'otp', 'totp', 'mfa_code', 'recovery_code', 'qr_code', 'link', 'signed_url', 'upload_url', 'session', 'jwt', 'cookie', 'set_cookie', 'authorization'] as const;

export function normalizeName(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toLowerCase();
}
export function isHiddenName(name: string): boolean {
  const n = normalizeName(name);
  return HIDDEN_SUBSTRINGS.some((s) => n.includes(s)) || HIDDEN_SUFFIXES.some((s) => n.endsWith(s)) || (HIDDEN_EXACT as readonly string[]).includes(n);
}
/** A value that is a secret whatever its field is called: a JWT, a Supabase key, an authenticator link, a URL carrying a token, a bearer header. */
export function isHiddenValue(v: string): boolean {
  return /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\./.test(v)
    || /sb_(secret|publishable)_/.test(v)
    || /otpauth:\/\//i.test(v)
    || /[?&](token|access_token|refresh_token|code)=/i.test(v)
    || /\bbearer\s+[A-Za-z0-9._-]{10,}/i.test(v);
}

const MAX_TEXT = 500, MAX_ITEMS = 200, MAX_DEPTH = 6;
/** Hides secret fields (by name, at any depth) and secret-looking values; cuts long text and long lists. */
export function redact(v: unknown, depth = 0): unknown {
  if (v === null || v === undefined) return v ?? null;
  if (typeof v === 'string') return isHiddenValue(v) ? HIDDEN : v.length > MAX_TEXT ? v.slice(0, MAX_TEXT) : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (depth >= MAX_DEPTH) return '[too deep]';
  if (Array.isArray(v)) return v.slice(0, MAX_ITEMS).map((x) => redact(x, depth + 1));
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = isHiddenName(k) ? HIDDEN : redact(x, depth + 1);
    return out;
  }
  return String(v);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** Only the fields that changed (of `fields`, or of every field in either object), as { before, after }; null when none changed. */
export function changedFields(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined, fields?: readonly string[]) {
  const keys = fields ?? [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  const b: Record<string, unknown> = {}, a: Record<string, unknown> = {};
  for (const k of keys) {
    const x = before?.[k] ?? null, y = after?.[k] ?? null;
    if (!same(x, y)) { b[k] = x; a[k] = y; }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}

/** The server log line for a row that could not be written: enough to add it later, and no values or secrets. */
export function notRecordedLine(actor: AuditActor, e: AuditEntry, code?: string): string {
  return `audit_log not written: ${JSON.stringify({ at: new Date().toISOString(), action: e.action, record_table: e.table, record_id: String(e.id), actor_user_id: actor.userId, route: e.route, error_code: code ?? null })}`;
}

/**
 * Writes one audit row. Never throws. Returns {} when written, or { auditWarning } (spread it into the JSON response) when
 * not. `once`: a second row for the same action and record is not an error (the database allows only one; admin_2fa.enrolled).
 */
export async function audit(admin: SupabaseClient, actor: AuditActor, e: AuditEntry, opts: { once?: boolean } = {}): Promise<{ auditWarning?: string }> {
  try {
    const { error } = await admin.from('audit_log').insert({
      actor_user_id: actor.userId, actor_role: actor.role, actor_email: actor.email ? actor.email.slice(0, 254) : null,
      action: e.action, record_table: e.table.slice(0, 80), record_id: String(e.id).slice(0, 200),
      before: e.before ? redact(e.before) : null, after: e.after ? redact(e.after) : null,
      route: e.route.slice(0, 200), note: e.note ? (redact(e.note.slice(0, 2000)) as string) : null,
    });
    if (!error) return {};
    if (opts.once && error.code === '23505') return {};
    console.error(notRecordedLine(actor, e, error.code));
  } catch {
    console.error(notRecordedLine(actor, e, 'exception'));
  }
  return { auditWarning: AUDIT_NOT_RECORDED };
}
