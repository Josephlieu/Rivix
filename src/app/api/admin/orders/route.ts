import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity, requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { clean, parseOrderBody } from '@/lib/order-input';
import { isBanned } from '@/lib/customer-status';
import { customerParties, notifyUsers } from '@/lib/notify';
import { announceRepChange } from '@/lib/rep-assignment';
import { localDateKey } from '@/lib/format';
import { invalidateDashboard } from '@/lib/dashboard-data';

// Every order from every rep, for the admin Orders list.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { data, error } = await createAdminClient()
    .from('orders')
    .select('id, batch_number, product_name, quantity, status, created_at, customers(id, company_name, customer_code, rep:reps(name))')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    orders: (data || []).map((o: any) => ({
      id: o.id,
      batch_number: o.batch_number,
      product_name: o.product_name,
      quantity: o.quantity,
      status: o.status,
      created_at: o.created_at,
      customer_id: o.customers?.id ?? null,
      customer: o.customers?.company_name ?? '',
      customer_code: o.customers?.customer_code ?? '',
      rep: o.customers?.rep?.name ?? null,
    })),
  });
}

// An admin creates an order for ANY customer (the sales rep stays whoever the customer is assigned to, if anyone).
// Same rules as a rep entering one; see src/lib/order-input.ts.
export async function POST(req: NextRequest) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const parsed = parseOrderBody(body);
  if ('error' in parsed) return parsed.error;
  const { customerId, items } = parsed;

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select('id, rep_id, company_name, user_id')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: 'That customer does not exist.' }, { status: 404 });

  // Optional: pick a sales rep for this order. Empty = keep the customer's current rep. Every rep access rule in the
  // portal follows the CUSTOMER's rep (one rep per customer), so choosing a different rep reassigns the customer,
  // exactly as on the Clients page: that rep sees all of the customer's orders, the previous rep no longer does.
  // rep_id: '' / missing = keep the customer's rep; 'none' = the admin handles it directly (the customer loses their rep).
  const toAdmin = body.rep_id === 'none';
  const wantedRepId = body.rep_id && !toAdmin ? String(body.rep_id) : null;
  let chosenRep: { id: string; name: string; user_id: string | null } | null = null;
  if (wantedRepId) {
    const { data: rep } = await admin.from('reps').select('id, name, user_id, active').eq('id', wantedRepId).maybeSingle();
    if (!rep) return NextResponse.json({ error: 'That sales rep does not exist.' }, { status: 400 });
    if (!rep.active) return NextResponse.json({ error: 'That sales rep is disabled.' }, { status: 400 });
    chosenRep = rep;
  }
  let emailWarning: string | undefined;
  const repChanges = toAdmin ? customer.rep_id != null : !!chosenRep && chosenRep.id !== (customer.rep_id ?? null);
  const orderRepId = toAdmin ? null : chosenRep ? chosenRep.id : (customer.rep_id ?? null);

  // A disabled customer cannot sign in, so an order for them would never be seen: refuse it.
  if (customer.user_id) {
    const { data } = await admin.auth.admin.getUserById(customer.user_id);
    if (isBanned(data?.user as { banned_until?: string | null } | undefined)) {
      return NextResponse.json({ error: 'This customer is disabled. Enable them first to create an order.' }, { status: 409 });
    }
  }

  const totalQty = items.reduce((n, it) => n + it.quantity, 0);
  const summary = items.length === 1 ? items[0].product_name : `${items[0].product_name} + ${items.length - 1} more`;

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      customer_id: customer.id,
      rep_id: orderRepId,
      batch_number: '', // filled in by the database (ORD-0001, ...)
      product_name: summary.slice(0, 200),
      quantity: totalQty,
      order_date: localDateKey(),
      delivery_location: clean(body.delivery_location, 500) || null,
      po_number: clean(body.po_number, 100) || null,
      pricing: clean(body.pricing, 500) || null,
      special_requirements: clean(body.special_requirements, 2000) || null,
    })
    .select('id, batch_number')
    .single();
  if (orderErr || !order) return NextResponse.json({ error: orderErr?.message || 'Could not create the order.' }, { status: 500 });

  const { error: itemsErr } = await admin.from('order_items').insert(items.map((it) => ({ ...it, order_id: order.id })));
  invalidateDashboard();
  if (itemsErr) {
    await admin.from('orders').delete().eq('id', order.id); // never leave an order with no products behind
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  // Reassign the customer only once the order exists, so a failed order never changes who owns the customer.
  if (repChanges) {
    const { error: assignErr } = await admin.from('customers').update({ rep_id: toAdmin ? null : chosenRep!.id }).eq('id', customer.id);
    if (assignErr) {
      await admin.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: `Could not assign the sales rep: ${assignErr.message}` }, { status: 500 });
    }
    ({ emailWarning } = await announceRepChange(admin, {
      customerId: customer.id,
      companyName: customer.company_name,
      customerUserId: customer.user_id,
      beforeRepId: customer.rep_id ?? null,
      afterRepId: toAdmin ? null : chosenRep!.id,
    }));
  }

  // An internal note on the timeline so everyone can see this order was entered by an admin, and who.
  await admin.from('order_events').insert({
    order_id: order.id,
    note: `Order entered by admin (${who.email}).${repChanges ? (toAdmin ? ' Sales rep removed; the customer is now handled directly by admin.' : ` Sales rep set to ${chosenRep!.name}; the customer was assigned to them.`) : ''}`,
    customer_visible: false,
    created_by: who.email,
  });

  // Tell the customer, and the customer's rep (if there is one) so they are not surprised by an order they did not enter.
  const parties = await customerParties(admin, customer.id);
  await notifyUsers(admin, [parties.customerUserId], {
    kind: 'order_created',
    title: `Order ${order.batch_number} was created for you`,
    body: `RIVIX entered your order (${totalQty} units). You can follow its progress here.`,
    link: `/portal/orders/${order.batch_number}`,
    order_id: order.id,
  });
  await notifyUsers(admin, [parties.repUserId], {
    kind: 'new_order',
    title: `Admin created order ${order.batch_number}`,
    body: `An order for ${customer.company_name || 'your customer'} (${totalQty} units) was entered by admin.`,
    link: `/rep/orders/${order.id}`,
    order_id: order.id,
  });

  return NextResponse.json({ order, emailWarning }, { status: 201 });
}
