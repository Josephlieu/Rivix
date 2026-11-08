import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { parseOrderItems, clean } from '@/lib/order-input';
import { adminUsers, notifyUsers } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { orderRequestEmail } from '@/lib/order-request-emails';
import { MAX_OPEN_REQUESTS, OPEN_LIMIT_MESSAGE, type RequestItem } from '@/lib/order-requests';

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

  const { count } = await admin.from('order_requests').select('id', { count: 'exact', head: true }).eq('customer_id', c.id).eq('status', 'open');
  if ((count ?? 0) >= MAX_OPEN_REQUESTS) return NextResponse.json({ error: OPEN_LIMIT_MESSAGE }, { status: 409 });

  const { data: row, error } = await admin
    .from('order_requests')
    .insert({ customer_id: c.id, kind, source_order_id: source?.id ?? null, items, note, created_by: c.user_id })
    .select('id, kind, status, created_at')
    .single();
  if (error) {
    // The database trigger enforces the same limit when two requests arrive at once.
    if (/open_request_limit/.test(error.message)) return NextResponse.json({ error: OPEN_LIMIT_MESSAGE }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Who handles it: the customer's active rep, otherwise every admin.
  const { data: rep } = c.rep_id ? await admin.from('reps').select('name, email, user_id, active').eq('id', c.rep_id).maybeSingle() : { data: null };
  const toRep = Boolean(rep && rep.active);
  const what = kind === 'reorder' ? `Reorder of ${source?.batch_number}` : 'Quote request';
  const units = items.reduce((n, it) => n + it.sizes.reduce((m, s) => m + s.qty, 0), 0);
  const recipients = toRep ? [{ id: rep!.user_id as string | null, email: rep!.email as string | null }] : await adminUsers(admin);
  await notifyUsers(admin, recipients.map((r) => r.id), {
    kind: 'order_request',
    title: `${what} from ${c.company_name}`,
    body: `${items.length} product${items.length === 1 ? '' : 's'}, ${units} units${note ? `. Note: ${note}` : ''}`,
    link: toRep ? '/rep/requests' : '/admin/requests',
  });

  // Emails never throw and never undo the request; a failure is logged (the in-app alert is already there).
  const results = await Promise.all(
    recipients.filter((r) => r.email).map((r) =>
      sendEmail(orderRequestEmail({ to: r.email, handler: toRep ? 'rep' : 'admin', company: c.company_name, kind, sourceBatch: source?.batch_number, items, note }))
    )
  );
  const failed = results.filter((r) => !r.ok);
  if (failed.length) console.error('order request email failed:', failed.map((r) => (r.ok ? '' : r.error)).join(' | '));
  const handlerEmail = !results.length || failed.length ? 'failed' : results.every((r) => r.ok && r.dryRun) ? 'dry_run' : 'sent';

  return NextResponse.json({ request: row, handledBy: toRep ? 'rep' : 'admin', handlerEmail }, { status: 201 });
}
