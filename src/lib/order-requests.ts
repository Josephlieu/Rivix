import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Customer order requests (reorders and quote requests). They are not tied to a rep: whoever is the customer's rep
// NOW handles them (one rep per customer), or the admins when there is none.
import type { RequestItem } from './order-requests-shared';
export { MAX_OPEN_REQUESTS, OPEN_LIMIT_MESSAGE, type RequestItem } from './order-requests-shared';
export interface OrderRequestRow {
  id: string;
  customer_id: string;
  kind: 'reorder' | 'quote';
  source_order_id: string | null;
  items: RequestItem[];
  note: string | null;
  status: 'open' | 'converted' | 'declined';
  order_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decline_reason: string | null;
  created_at: string;
}

// Before an order is created from a request: the request must exist, still be open, and be for this same customer.
export async function checkRequestForOrder(admin: SupabaseClient, requestId: unknown, customerId: string): Promise<NextResponse | null> {
  const id = String(requestId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'That request does not exist.' }, { status: 400 });
  const { data } = await admin.from('order_requests').select('id, customer_id, status').eq('id', id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'That request does not exist.' }, { status: 404 });
  if (data.customer_id !== customerId) return NextResponse.json({ error: 'That request is from a different customer.' }, { status: 400 });
  if (data.status !== 'open') return NextResponse.json({ error: 'That request has already been handled.' }, { status: 409 });
  return null;
}

// After the order exists: mark the request converted ONLY if it is still open (a conditional update). Two people
// converting at once: exactly one wins. The loser must delete the order it just created (see the order routes).
export async function claimRequestForOrder(admin: SupabaseClient, c: { requestId: string; customerId: string; orderId: string; by: string }): Promise<boolean> {
  const { data, error } = await admin
    .from('order_requests')
    .update({ status: 'converted', order_id: c.orderId, decided_by: c.by, decided_at: new Date().toISOString() })
    .eq('id', c.requestId)
    .eq('customer_id', c.customerId)
    .eq('status', 'open')
    .select('id');
  if (error) console.error('claim order request failed:', error.message);
  return !error && (data?.length ?? 0) === 1;
}

export const CONVERT_RACE_MESSAGE = 'Someone else already turned this request into an order (or declined it), so this order was not created.';

// An OPEN request, shaped for the pre-filled New Order form. Null when it does not exist or is already handled.
// The caller still checks that the viewer may see this customer (a rep: only their own customers).
export async function requestForOrderForm(admin: SupabaseClient, requestId: string | undefined) {
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) return null;
  const { data } = await admin
    .from('order_requests')
    .select('id, customer_id, kind, items, note, status, source:orders!order_requests_source_order_id_fkey(batch_number), customers(rep_id)')
    .eq('id', requestId)
    .maybeSingle();
  if (!data || data.status !== 'open') return null;
  const d = data as unknown as { id: string; customer_id: string; kind: 'reorder' | 'quote'; items: RequestItem[]; note: string | null; source: { batch_number: string } | null; customers: { rep_id: string | null } | null };
  return {
    customerId: d.customer_id,
    customerRepId: d.customers?.rep_id ?? null,
    form: { id: d.id, label: d.kind === 'reorder' ? `reorder request${d.source ? ` (of ${d.source.batch_number})` : ''}` : 'quote request', items: d.items || [], note: d.note },
  };
}
