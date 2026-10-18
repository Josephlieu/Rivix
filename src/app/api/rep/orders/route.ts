import { NextRequest, NextResponse } from 'next/server';
import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import { adminUserIds, customerParties, notifyUsers } from '@/lib/notify';
import { clean, parseOrderBody } from '@/lib/order-input';
import { localDateKey } from '@/lib/format';
import { invalidateDashboard } from '@/lib/dashboard-data';

// A sales rep creates an order for one of THEIR customers; the rep is worked out from the session.
// (Admins can create orders too, for any customer: see POST /api/admin/orders. Changed 2026-10-16 at the client's request.)
export async function POST(req: NextRequest) {
  const rep = await getCurrentRep();
  if (!rep) return NextResponse.json({ error: 'Only sales reps can create orders.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const parsed = parseOrderBody(body);
  if ('error' in parsed) return parsed.error;
  const { customerId, items } = parsed;

  const admin = createAdminClient();

  // The customer must be assigned to THIS rep.
  const { data: customer } = await admin
    .from('customers')
    .select('id, rep_id, company_name')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer || customer.rep_id !== rep.id) {
    return NextResponse.json({ error: 'That customer is not assigned to you.' }, { status: 403 });
  }

  const totalQty = items.reduce((n, it) => n + it.quantity, 0);
  const summary = items.length === 1 ? items[0].product_name : `${items[0].product_name} + ${items.length - 1} more`;

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      customer_id: customer.id,
      rep_id: rep.id,
      batch_number: '', // filled in by the database (ORD-0001, ...)
      product_name: summary.slice(0, 200),
      quantity: totalQty,
      order_date: localDateKey(), // today in the default time zone (not UTC)
      delivery_location: clean(body.delivery_location, 500) || null,
      po_number: clean(body.po_number, 100) || null,
      pricing: clean(body.pricing, 500) || null,
      special_requirements: clean(body.special_requirements, 2000) || null,
    })
    .select('id, batch_number')
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: orderErr?.message || 'Could not create the order.' }, { status: 500 });
  }

  const { error: itemsErr } = await admin.from('order_items').insert(items.map((it) => ({ ...it, order_id: order.id })));
  invalidateDashboard(); // a new order (or its clean-up below) changes the dashboard numbers
  if (itemsErr) {
    // Never leave an order with no products behind
    await admin.from('orders').delete().eq('id', order.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  await notifyUsers(admin, await adminUserIds(admin), {
    kind: 'new_order',
    title: `New order ${order.batch_number}`,
    body: `${rep.name} entered an order for ${(customer as any).company_name || 'a customer'} (${totalQty} units)`,
    link: `/admin/orders/${order.id}`,
    order_id: order.id,
  });

  // Confirm to the customer that the order they asked their rep for is now in the portal.
  const parties = await customerParties(admin, customer.id);
  await notifyUsers(admin, [parties.customerUserId], {
    kind: 'order_created',
    title: `Order ${order.batch_number} was created for you`,
    body: `${rep.name} entered your order (${totalQty} units). You can follow its progress here.`,
    link: `/portal/orders/${order.batch_number}`,
    order_id: order.id,
  });

  return NextResponse.json({ order }, { status: 201 });
}
