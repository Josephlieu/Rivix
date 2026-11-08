import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardRow } from '@/components/RequestsBoard';

const SELECT =
  'id, kind, status, created_at, items, note, decline_reason, decided_by, decided_at, order_id, source:orders!order_requests_source_order_id_fkey(batch_number), order:orders!order_requests_order_id_fkey(batch_number), customers!inner(company_name, customer_code, rep_id, rep:reps(name))';

// Requests for the board. repId given: only that rep's customers (the request follows the customer's CURRENT rep).
export async function loadBoardRows(admin: SupabaseClient, repId?: string): Promise<BoardRow[]> {
  let q = admin.from('order_requests').select(SELECT).order('created_at', { ascending: false }).limit(200);
  if (repId) q = q.eq('customers.rep_id', repId);
  const { data } = await q;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data || []) as any[]).map((r) => ({
    id: r.id, kind: r.kind, status: r.status, created_at: r.created_at, items: r.items || [], note: r.note,
    decline_reason: r.decline_reason, decided_by: r.decided_by, decided_at: r.decided_at,
    company: r.customers?.company_name || '', code: r.customers?.customer_code || '',
    handler: repId ? undefined : r.customers?.rep?.name || 'Admin (handled directly)',
    source_batch: r.source?.batch_number ?? null, order_id: r.order_id, order_batch: r.order?.batch_number ?? null,
  }));
}
