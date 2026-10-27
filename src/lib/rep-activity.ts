import type { SupabaseClient } from '@supabase/supabase-js';

// The kinds written to the rep activity log (see audit-docs/deliverables/dev-patch-rep-activity*.sql).
// The Rep Detail page reads ONLY this table, so every action that belongs in a rep's history calls logRepActivity
// (or logForOrder) at the moment it happens. 'quote_created' is ready for the quote builder.
export type RepActivityKind =
  | 'joined' | 'status' | 'profile'
  | 'customer_assigned' | 'customer_removed'
  | 'order_created' | 'order_status' | 'order_note' | 'document'
  | 'request_created' | 'request_done'
  | 'replication' | 'quote_created';

type Entry = {
  repId: string | null | undefined;
  kind: RepActivityKind;
  summary: string;
  customerId?: string | null;
  orderId?: string | null;
  link?: string | null;
  by?: string | null; // who did it: an admin's email, a rep's name, or a customer's company
  approx?: boolean;   // the date is a best guess (used when old events are filled in)
  at?: string;        // only for filling in old events; normally the database stamps the time
};

// Writes one line to a rep's history. Never throws: a missing table (patch not run yet) or a failed write
// must not undo or block the action the person just did.
export async function logRepActivity(admin: SupabaseClient, e: Entry): Promise<void> {
  if (!e.repId) return;
  try {
    const row: Record<string, unknown> = {
      rep_id: e.repId, kind: e.kind, summary: e.summary,
      customer_id: e.customerId ?? null, order_id: e.orderId ?? null, created_by: e.by ?? null,
      link: e.link ?? null, approx: e.approx ?? false,
    };
    if (e.at) row.created_at = e.at;
    let { error } = await admin.from('rep_activity').insert(row);
    if (error && /link|approx/.test(error.message)) {
      // The second patch (extra columns) has not been run yet: keep the older shape working.
      delete row.link; delete row.approx;
      ({ error } = await admin.from('rep_activity').insert(row));
    }
    if (error) console.error('rep activity not logged:', error.message);
  } catch (err) {
    console.error('rep activity not logged:', err);
  }
}

// Logs an order-related action on the rep who owns the order (orders.rep_id). `text` builds the sentence from the order number and customer.
export async function logForOrder(
  admin: SupabaseClient,
  orderId: string,
  e: { kind: RepActivityKind; text: (o: { batch: string; company: string }) => string; by?: string | null }
): Promise<void> {
  try {
    const { data } = await admin.from('orders').select('rep_id, batch_number, customer_id, customers(company_name)').eq('id', orderId).maybeSingle();
    if (!data?.rep_id) return;
    const o = { batch: (data.batch_number as string) || 'order', company: ((data as any).customers?.company_name as string) || 'a customer' };
    await logRepActivity(admin, { repId: data.rep_id as string, kind: e.kind, summary: e.text(o), orderId, customerId: data.customer_id as string, link: `/admin/orders/${orderId}`, by: e.by });
  } catch (err) {
    console.error('rep activity not logged:', err);
  }
}
