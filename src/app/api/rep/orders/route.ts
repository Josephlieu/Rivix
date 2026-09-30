import { NextRequest, NextResponse } from 'next/server';
import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import { cleanSizeLabel, sizesToText, totalQty as sumSizes, type SizeQty } from '@/lib/sizes';

const MAX_ITEMS = 50;

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// A sales rep creates an order for one of THEIR customers. Admin does not
// create orders (decided 2026-09-25); the rep is worked out from the session.
export async function POST(req: NextRequest) {
  const rep = await getCurrentRep();
  if (!rep) return NextResponse.json({ error: 'Only sales reps can create orders.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const customerId = String(body.customer_id || '');
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!customerId) return NextResponse.json({ error: 'Choose a customer.' }, { status: 400 });
  if (rawItems.length === 0) return NextResponse.json({ error: 'Add at least one product.' }, { status: 400 });
  if (rawItems.length > MAX_ITEMS) return NextResponse.json({ error: `An order can have at most ${MAX_ITEMS} products.` }, { status: 400 });

  const items: { product_name: string; quantity: number; sizing: string; size_breakdown: SizeQty[]; branding: string | null; position: number }[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i];
    const name = clean(it?.product_name, 200);
    if (!name) return NextResponse.json({ error: `Product ${i + 1}: enter a product name.` }, { status: 400 });

    const rawSizes = Array.isArray(it?.sizes) ? it.sizes : [];
    if (rawSizes.length < 1 || rawSizes.length > 40) {
      return NextResponse.json({ error: `Product ${i + 1}: enter a quantity for at least one size.` }, { status: 400 });
    }
    const sizes: SizeQty[] = [];
    const seen = new Set<string>();
    for (const rs of rawSizes) {
      const size = cleanSizeLabel(rs?.size);
      const qty = Number(rs?.qty);
      if (!size) return NextResponse.json({ error: `Product ${i + 1}: a size is missing its name.` }, { status: 400 });
      if (!Number.isInteger(qty) || qty < 1 || qty > 1_000_000) {
        return NextResponse.json({ error: `Product ${i + 1}: size ${size} needs a whole number of at least 1.` }, { status: 400 });
      }
      if (seen.has(size.toLowerCase())) {
        return NextResponse.json({ error: `Product ${i + 1}: size ${size} is listed twice.` }, { status: 400 });
      }
      seen.add(size.toLowerCase());
      sizes.push({ size, qty });
    }

    items.push({
      product_name: name,
      quantity: sumSizes(sizes),
      sizing: sizesToText(sizes).slice(0, 500),
      size_breakdown: sizes,
      branding: clean(it?.branding, 1000) || null,
      position: i,
    });
  }

  const admin = createAdminClient();

  // The customer must be assigned to THIS rep.
  const { data: customer } = await admin
    .from('customers')
    .select('id, rep_id')
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
      order_date: new Date().toISOString().slice(0, 10),
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
  if (itemsErr) {
    // Never leave an order with no products behind
    await admin.from('orders').delete().eq('id', order.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ order }, { status: 201 });
}
