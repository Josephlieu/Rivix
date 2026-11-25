// The customer's quote cart (2026-11-26), server side. Every function takes the customer from the SESSION (catalogViewer
// / getSessionCustomer); nothing here accepts a customer id or a cart id from the browser. Unsubmitted carts are private
// to the customer: no rep or admin route reads them.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentCustomer } from '@/lib/session-customer';
import { publishedFamilies, publishedFamily, loadSettings, type FamilyView } from '@/lib/catalog-public';
import { MAX_LINES, ONE_SIZE, checkSizes, checkSpec, lineTotal, minimumCheck, toRequestItem, type Settings, type SizeQty, type Spec } from '@/lib/catalog-families';
import { submitOrderRequest } from '@/lib/order-request-submit';
import type { RequestItem } from '@/lib/order-requests-shared';

export const LINE_COLUMNS = 'id, draft_id, family_id, spec, sizes, sort, created_at, updated_at';
const DRAFT_COLUMNS = 'id, note, submitting_at, last_submitted_at';
type Draft = { id: string; note: string | null; submitting_at: string | null; last_submitted_at: string | null };
type LineRow = { id: string; draft_id: string; family_id: string; spec: Spec; sizes: SizeQty[]; sort: number; created_at: string; updated_at: string };
/** A claim older than this is treated as abandoned (a crashed submit); a submit within it counts as "already submitted". */
const CLAIM_MS = 2 * 60 * 1000;
export const ALREADY_SUBMITTED = 'This quote cart was already submitted. You can see it on your Requests page.';
export const CART_EMPTY = 'Your quote cart is empty.';
export const LINE_LIMIT = `Your quote cart can hold at most ${MAX_LINES} lines. Submit it, or remove a line first.`;

export async function getDraft(admin: SupabaseClient, customerId: string, create: boolean): Promise<Draft | null> {
  const { data } = await admin.from('quote_drafts').select(DRAFT_COLUMNS).eq('customer_id', customerId).maybeSingle();
  if (data || !create) return (data as Draft) ?? null;
  const ins = await admin.from('quote_drafts').insert({ customer_id: customerId }).select(DRAFT_COLUMNS).single();
  if (!ins.error) return ins.data as Draft;
  const again = await admin.from('quote_drafts').select(DRAFT_COLUMNS).eq('customer_id', customerId).maybeSingle(); // a second tab made it first
  return (again.data as Draft) ?? null;
}
const recent = (t: string | null) => Boolean(t && Date.now() - Date.parse(t) < CLAIM_MS);
export const isSubmitting = (d: Draft | null) => Boolean(d && recent(d.submitting_at));

/** The cart as the customer sees it: lines with the family's name and code, totals and the minimum note (one round of reads). */
export async function cartView(admin: SupabaseClient, customerId: string) {
  const [settings, { data }] = await Promise.all([
    loadSettings(admin),
    admin.from('quote_drafts').select(`note, lines:quote_draft_lines(${LINE_COLUMNS}, family:product_families(code, name, visible_to_customers, active))`).eq('customer_id', customerId).maybeSingle(),
  ]);
  type Joined = LineRow & { family: { code: string; name: string; visible_to_customers: boolean; active: boolean } | null };
  const d = data as unknown as { note: string | null; lines: Joined[] } | null;
  const lines = [...(d?.lines ?? [])].sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
  return {
    note: d?.note ?? null,
    settings: { min_order_qty: settings.min_order_qty, note_below_qty: settings.note_below_qty },
    lines: lines.map((l) => {
      const f = l.family, total = lineTotal(l.sizes), m = minimumCheck(total, settings);
      return {
        id: l.id, familyId: l.family_id, familyCode: f?.code ?? '', familyName: f?.name ?? '', available: Boolean(f?.visible_to_customers && f?.active),
        spec: l.spec, sizes: l.sizes, total, minimumNote: m.ok ? m.note : null, minimumError: m.ok ? null : m.error,
      };
    }),
  };
}

/** A line's spec and sizes, checked against the published family and the minimum. */
export async function checkLine(admin: SupabaseClient, family: FamilyView, body: Record<string, unknown>, settings?: Settings) {
  const spec = checkSpec(body.spec, { typical_options: family.typicalOptions }, family.standards);
  if ('error' in spec) return { error: spec.error };
  const rawSizes = family.typicalSizes.length ? body.sizes : [{ size: ONE_SIZE, qty: Array.isArray(body.sizes) ? (body.sizes as SizeQty[])[0]?.qty : body.quantity }];
  const sizes = checkSizes(rawSizes);
  if ('error' in sizes) return { error: sizes.error };
  const m = minimumCheck(lineTotal(sizes.value), settings ?? await loadSettings(admin));
  if (!m.ok) return { error: m.error };
  return { spec: spec.value, sizes: sizes.value, note: m.note };
}

export async function addLine(admin: SupabaseClient, customerId: string, body: Record<string, unknown>) {
  const fid = typeof body.family_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.family_id) ? body.family_id : null;
  if (!fid) return { status: 404, error: 'Product not found.' };
  const [family, settings, draft] = await Promise.all([publishedFamily(admin, fid), loadSettings(admin), getDraft(admin, customerId, true)]);
  if (!family) return { status: 404, error: 'Product not found.' };
  const chk = await checkLine(admin, family, body, settings);
  if ('error' in chk) return { status: 400, error: chk.error as string };
  if (!draft) return { status: 500, error: 'Could not open your quote cart.' };
  if (isSubmitting(draft)) return { status: 409, error: 'Your quote cart is being submitted. Wait a moment, then try again.' };
  // At most 25 lines: the database trigger counts them (with the cart locked), so two tabs cannot both add the 26th.
  const { data, error } = await admin.from('quote_draft_lines').insert({ draft_id: draft.id, family_id: family.id, spec: chk.spec, sizes: chk.sizes, sort: Math.floor(Date.now() / 1000) }).select('id').single();
  if (error) return /quote_line_limit/.test(error.message) ? { status: 409, error: LINE_LIMIT } : { status: 500, error: 'Could not add it to your quote cart.' };
  return { status: 201, line: { id: data.id as string }, note: chk.note };
}

/** One of THIS customer's cart lines, or null (the same answer for another customer's line and a line that does not exist). */
export async function ownLine(admin: SupabaseClient, customerId: string, lineId: string): Promise<{ draft: Draft; line: LineRow } | null> {
  const draft = await getDraft(admin, customerId, false);
  if (!draft) return null;
  const { data } = await admin.from('quote_draft_lines').select(LINE_COLUMNS).eq('id', lineId).eq('draft_id', draft.id).maybeSingle();
  return data ? { draft, line: data as LineRow } : null;
}

/**
 * Submit, atomically (2026-11-26):
 *   1. claim the cart with ONE conditional update (submitting_at is set only if it is not already being submitted);
 *   2. take its lines with ONE DELETE ... RETURNING (two submits can never both get them);
 *   3. check them (still published, minimum) and insert exactly one order request (kind 'quote');
 *   4. on any failure the lines are put back and the claim released; on success the note is cleared.
 * A second submit, at the same time or just after, gets ALREADY_SUBMITTED.
 */
export async function submitCart(admin: SupabaseClient, c: CurrentCustomer) {
  const draft = await getDraft(admin, c.id, false);
  if (!draft) return { status: 400, error: CART_EMPTY };
  const now = new Date(), stale = new Date(now.getTime() - CLAIM_MS).toISOString();
  const claim = await admin.from('quote_drafts').update({ submitting_at: now.toISOString() })
    .eq('id', draft.id).or(`submitting_at.is.null,submitting_at.lt."${stale}"`).select('id, note, last_submitted_at');
  if (claim.error) return { status: 500, error: 'Could not submit your quote cart.' };
  if (!claim.data?.length) return { status: 409, error: ALREADY_SUBMITTED, code: 'already_submitted' };
  const release = (extra: Record<string, unknown> = {}) => admin.from('quote_drafts').update({ submitting_at: null, ...extra }).eq('id', draft.id);

  const taken = await admin.from('quote_draft_lines').delete().eq('draft_id', draft.id).select(LINE_COLUMNS);
  const lines = ((taken.data ?? []) as LineRow[]).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
  if (taken.error) { await release(); return { status: 500, error: 'Could not submit your quote cart.' }; }
  if (!lines.length) {
    await release();
    const last = (claim.data[0] as { last_submitted_at: string | null }).last_submitted_at;
    return recent(last) ? { status: 409, error: ALREADY_SUBMITTED, code: 'already_submitted' } : { status: 400, error: CART_EMPTY };
  }
  const putBack = async () => { await admin.from('quote_draft_lines').insert(lines.map(({ id, draft_id, family_id, spec, sizes, sort }) => ({ id, draft_id, family_id, spec, sizes, sort }))); await release(); };

  // Still published, and still above the minimum (the setting may have changed since the line was added).
  const famIds = [...new Set(lines.map((l) => l.family_id))];
  const [settings, published, names] = await Promise.all([
    loadSettings(admin), publishedFamilies(admin, { ids: famIds }),
    admin.from('product_families').select('id, code, name').in('id', famIds),
  ]);
  const byId = new Map(published.map((f) => [f.id, f]));
  const nameOf = new Map(((names.data ?? []) as Array<{ id: string; code: string; name: string }>).map((f) => [f.id, `${f.name} (${f.code})`]));
  const items: RequestItem[] = [];
  const gone: string[] = [];
  for (const l of lines) {
    const fam = byId.get(l.family_id);
    if (!fam) { const n = nameOf.get(l.family_id) ?? 'a product'; if (!gone.includes(n)) gone.push(n); continue; }
    const m = minimumCheck(lineTotal(l.sizes), settings);
    if (!m.ok) { await putBack(); return { status: 400, error: `${fam.name}: ${m.error}` }; }
    items.push(toRequestItem(l, fam) as RequestItem);
  }
  if (gone.length) { await putBack(); return { status: 400, error: `No longer available: ${gone.join(', ')}. Remove ${gone.length === 1 ? 'it' : 'them'} from your quote cart, then submit again.`, code: 'unavailable' }; }

  const note = (claim.data[0] as { note: string | null }).note;
  const sent = await submitOrderRequest(admin, c, { kind: 'quote', items, note, source: null });
  if (!sent.ok) { await putBack(); return { status: sent.status, error: sent.error }; }
  await release({ note: null, last_submitted_at: new Date().toISOString() });
  return { status: 201, request: sent.request, handledBy: sent.handledBy, handlerEmail: sent.handlerEmail };
}
