// Sending an order request (reorder or quote) to whoever handles the customer, shared by POST /api/portal/order-requests
// and the catalogue's quote cart submit (2026-11-26). Moved here unchanged from the route: the open-request limit (also
// enforced by the database trigger), the insert, one in-app notification to the customer's active rep (or every admin),
// and the email (never throws; EMAIL_DRY_RUN in tests). Server only.
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminUsers, notifyUsers } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { orderRequestEmail } from '@/lib/order-request-emails';
import { MAX_OPEN_REQUESTS, OPEN_LIMIT_MESSAGE, type RequestItem } from '@/lib/order-requests-shared';
import type { CurrentCustomer } from '@/lib/session-customer';

export type SubmitResult =
  | { ok: true; request: { id: string; kind: string; status: string; created_at: string }; handledBy: 'rep' | 'admin'; handlerEmail: 'sent' | 'dry_run' | 'failed' }
  | { ok: false; status: number; error: string };

export async function submitOrderRequest(admin: SupabaseClient, c: CurrentCustomer, r: { kind: 'reorder' | 'quote'; items: RequestItem[]; note: string | null; source: { id: string; batch_number: string } | null }): Promise<SubmitResult> {
  const { count } = await admin.from('order_requests').select('id', { count: 'exact', head: true }).eq('customer_id', c.id).eq('status', 'open');
  if ((count ?? 0) >= MAX_OPEN_REQUESTS) return { ok: false, status: 409, error: OPEN_LIMIT_MESSAGE };

  const { data: row, error } = await admin
    .from('order_requests')
    .insert({ customer_id: c.id, kind: r.kind, source_order_id: r.source?.id ?? null, items: r.items, note: r.note, created_by: c.user_id })
    .select('id, kind, status, created_at')
    .single();
  if (error) {
    // The database trigger enforces the same limit when two requests arrive at once.
    if (/open_request_limit/.test(error.message)) return { ok: false, status: 409, error: OPEN_LIMIT_MESSAGE };
    return { ok: false, status: 500, error: error.message };
  }

  // Who handles it: the customer's active rep, otherwise every admin.
  const { data: rep } = c.rep_id ? await admin.from('reps').select('name, email, user_id, active').eq('id', c.rep_id).maybeSingle() : { data: null };
  const toRep = Boolean(rep && rep.active);
  const what = r.kind === 'reorder' ? `Reorder of ${r.source?.batch_number}` : 'Quote request';
  const units = r.items.reduce((n, it) => n + it.sizes.reduce((m, s) => m + s.qty, 0), 0);
  const recipients = toRep ? [{ id: rep!.user_id as string | null, email: rep!.email as string | null }] : await adminUsers(admin);
  await notifyUsers(admin, recipients.map((x) => x.id), {
    kind: 'order_request',
    title: `${what} from ${c.company_name}`,
    body: `${r.items.length} product${r.items.length === 1 ? '' : 's'}, ${units} units${r.note ? `. Note: ${r.note}` : ''}`,
    link: toRep ? '/rep/requests' : '/admin/requests',
  });

  // Emails never throw and never undo the request; a failure is logged (the in-app alert is already there).
  const results = await Promise.all(
    recipients.filter((x) => x.email).map((x) =>
      sendEmail(orderRequestEmail({ to: x.email, handler: toRep ? 'rep' : 'admin', company: c.company_name, kind: r.kind, sourceBatch: r.source?.batch_number, items: r.items, note: r.note }))
    )
  );
  const failed = results.filter((x) => !x.ok);
  if (failed.length) console.error('order request email failed:', failed.map((x) => (x.ok ? '' : x.error)).join(' | '));
  const handlerEmail = !results.length || failed.length ? 'failed' : results.every((x) => x.ok && x.dryRun) ? 'dry_run' : 'sent';
  return { ok: true, request: row as { id: string; kind: string; status: string; created_at: string }, handledBy: toRep ? 'rep' : 'admin', handlerEmail };
}
