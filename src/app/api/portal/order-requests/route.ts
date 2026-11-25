import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { parseOrderItems, clean } from '@/lib/order-input';
import { submitOrderRequest } from '@/lib/order-request-submit';
import type { RequestItem } from '@/lib/order-requests';

// The signed-in customer's own requests, newest first, with the order each became.
export async function GET() {
  const me = await getSessionCustomer();
  if ('denied' in me) return me.denied;
  const { data, error } = await me.admin
    .from('order_requests')
    .select('id, kind, items, note, status, decline_reason, decided_at, created_at, source:orders!order_requests_source_order_id_fkey(batch_number), order:orders!order_requests_order_id_fkey(batch_number)')
    .eq('customer_id', me.customer.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

// A customer sends a reorder (of one of their own past orders) or a quote request. It is NOT an order: it goes to the
// customer's rep, or to every admin when they have no (active) rep, in the app and by email. The rep or admin turns it
// into an order with the pre-filled New Order form.
export async function POST(req: NextRequest) {
  const me = await getSessionCustomer();
  if ('denied' in me) return me.denied;
  const { customer: c, admin } = me;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const kind = body.kind === 'reorder' ? 'reorder' : body.kind === 'quote' ? 'quote' : null;
  if (!kind) return NextResponse.json({ error: 'Choose a reorder or a quote request.' }, { status: 400 });
  const parsed = parseOrderItems(body.items);
  if ('message' in parsed) return NextResponse.json({ error: parsed.message }, { status: 400 });
  const items: RequestItem[] = parsed.items.map((it) => ({ product_name: it.product_name, sizes: it.size_breakdown, branding: it.branding }));
  const note = clean(body.note, 1000) || null;

  // A reorder must be of one of THIS customer's orders (same answer whether it does not exist or is someone else's).
  let source: { id: string; batch_number: string } | null = null;
  if (kind === 'reorder') {
    const { data } = await admin.from('orders').select('id, batch_number, customer_id').eq('id', String(body.source_order_id ?? '')).maybeSingle();
    if (!data || data.customer_id !== c.id) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    source = { id: data.id, batch_number: data.batch_number };
  }

  const sent = await submitOrderRequest(admin, c, { kind, items, note, source });
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });
  return NextResponse.json({ request: sent.request, handledBy: sent.handledBy, handlerEmail: sent.handlerEmail }, { status: 201 });
}
