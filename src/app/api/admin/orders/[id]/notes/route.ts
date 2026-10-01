import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';

// Add a note to the order's timeline. `customer_visible: false` keeps it
// internal — the customer's read rule only returns visible events.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const note = String(body?.note ?? '').trim().slice(0, 2000);
  if (!note) return NextResponse.json({ error: 'Write a note first.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id').eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  const { error } = await admin.from('order_events').insert({
    order_id: id,
    note,
    customer_visible: body?.customer_visible !== false, // default visible; only an explicit false is internal
    created_by: who.email,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
