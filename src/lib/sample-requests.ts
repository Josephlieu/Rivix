// Sample requests (2026-11-26), server side. A customer asks for 1 to 20 samples of a published family, with their spec and
// a note; at most 10 open per customer (also enforced by the database). The customer's active rep (or every admin) is
// notified and emailed; the rep (own customers only) or an admin marks it sent, or declined with a reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentCustomer } from '@/lib/session-customer';
import { publishedFamily } from '@/lib/catalog-public';
import { MAX_OPEN_SAMPLES, MAX_SAMPLE_QTY, SAMPLE_COLUMNS, SPEC_LIMITS, checkSpec, type Spec } from '@/lib/catalog-families';
import { adminUsers, notifyUsers } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { sampleRequestEmail } from '@/lib/order-request-emails';

export const OPEN_SAMPLE_LIMIT = `You already have ${MAX_OPEN_SAMPLES} open sample requests. Please wait for RIVIX to answer some of them before asking for more.`;
type Row = { id: string; customer_id: string; family_id: string; spec: Spec; quantity: number; note: string | null; status: string; decided_by_email: string | null; decided_at: string | null; decline_reason: string | null; created_at: string };

export async function createSample(admin: SupabaseClient, c: CurrentCustomer, body: Record<string, unknown>) {
  const fid = typeof body.family_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.family_id) ? body.family_id : null;
  if (!fid) return { status: 404, error: 'Product not found.' };
  const [family, open, repRow] = await Promise.all([
    publishedFamily(admin, fid),
    admin.from('sample_requests').select('id', { count: 'exact', head: true }).eq('customer_id', c.id).eq('status', 'open'),
    c.rep_id ? admin.from('reps').select('email, user_id, active').eq('id', c.rep_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!family) return { status: 404, error: 'Product not found.' };
  const spec = checkSpec(body.spec, { typical_options: family.typicalOptions }, family.standards);
  if ('error' in spec) return { status: 400, error: spec.error };
  const qty = Number(body.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_SAMPLE_QTY) return { status: 400, error: `Samples: a whole number from 1 to ${MAX_SAMPLE_QTY}.` };
  const rawNote = typeof body.note === 'string' ? body.note.trim() : '';
  if (rawNote.length > SPEC_LIMITS.note) return { status: 400, error: `The note is longer than ${SPEC_LIMITS.note} characters.` };
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(rawNote)) return { status: 400, error: 'The note contains characters that cannot be stored.' };
  if ((open.count ?? 0) >= MAX_OPEN_SAMPLES) return { status: 409, error: OPEN_SAMPLE_LIMIT };
  const { data, error } = await admin.from('sample_requests')
    .insert({ customer_id: c.id, family_id: family.id, spec: spec.value, quantity: qty, note: rawNote || null, created_by: c.user_id })
    .select(SAMPLE_COLUMNS).single();
  if (error) return /open_sample_limit/.test(error.message) ? { status: 409, error: OPEN_SAMPLE_LIMIT } : { status: 500, error: 'Could not send the sample request.' };

  const rep = repRow.data as { email: string | null; user_id: string | null; active: boolean } | null;
  const toRep = Boolean(rep && rep.active);
  const recipients = toRep ? [{ id: rep!.user_id as string | null, email: rep!.email as string | null }] : await adminUsers(admin);
  await notifyUsers(admin, recipients.map((r) => r.id), {
    kind: 'sample_request', title: `Sample request from ${c.company_name}`,
    body: `${family.name}: ${qty} sample${qty === 1 ? '' : 's'}${rawNote ? `. Note: ${rawNote}` : ''}`,
    link: toRep ? '/rep/requests' : '/admin/requests',
  });
  const results = await Promise.all(recipients.filter((r) => r.email).map((r) => sendEmail(sampleRequestEmail({ to: r.email, handler: toRep ? 'rep' : 'admin', company: c.company_name, family: family.name, quantity: qty, spec: spec.value, note: rawNote || null }))));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) console.error('sample request email failed:', failed.map((r) => (r.ok ? '' : r.error)).join(' | '));
  return { status: 201, sample: data as Row, handledBy: toRep ? 'rep' : 'admin' };
}

/** Sample requests with the customer's company and the family's name and code. repId: only that rep's customers. */
export async function listSamples(admin: SupabaseClient, filter: { customerId?: string; repId?: string }) {
  let q = admin.from('sample_requests')
    .select(`${SAMPLE_COLUMNS}, family:product_families(code, name), customer:customers!inner(company_name, customer_code, rep_id)`)
    .order('created_at', { ascending: false }).limit(200);
  if (filter.customerId) q = q.eq('customer_id', filter.customerId);
  if (filter.repId) q = q.eq('customer.rep_id', filter.repId);
  const { data } = await q;
  return ((data ?? []) as unknown as Array<Row & { family: { code: string; name: string } | null; customer: { company_name: string; customer_code: string } | null }>).map((r) => ({
    id: r.id, familyCode: r.family?.code ?? '', familyName: r.family?.name ?? '', spec: r.spec, quantity: r.quantity, note: r.note,
    status: r.status, decidedBy: r.decided_by_email, decidedAt: r.decided_at, declineReason: r.decline_reason, createdAt: r.created_at,
    ...(filter.customerId ? {} : { company: r.customer?.company_name ?? '', customerCode: r.customer?.customer_code ?? '' }),
  }));
}
