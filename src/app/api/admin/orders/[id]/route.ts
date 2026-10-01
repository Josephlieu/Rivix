import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity, requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { isOrderStage } from '@/lib/order-stages';

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// One order with everything admin needs: customer, rep, products and timeline.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from('orders')
    .select('*, customers(id, company_name, customer_code, contact_email, rep:reps(name, rep_code))')
    .eq('id', id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  const [{ data: items }, { data: events }] = await Promise.all([
    admin.from('order_items').select('*').eq('order_id', id).order('position'),
    admin.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
  ]);

  const { customers, ...rest } = order as any;
  return NextResponse.json({ order: rest, customer: customers, items: items || [], events: events || [] });
}

// Admin runs the order: change stage, set carrier + tracking. Every stage
// change lands on the timeline (a database trigger writes it); we then stamp
// who made it, and attach the optional note.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const admin = createAdminClient();
  const { data: current } = await admin.from('orders').select('id, status, carrier, tracking_number').eq('id', id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  const update: Record<string, unknown> = {};
  let newStatus: string | null = null;

  if ('status' in body) {
    if (!isOrderStage(body.status)) return NextResponse.json({ error: 'That is not a valid stage.' }, { status: 400 });
    if (body.status !== current.status) {
      update.status = body.status;
      newStatus = body.status;
    }
  }
  let shippingChanged = false;
  if ('carrier' in body) {
    const carrier = clean(body.carrier, 100) || null;
    if (carrier !== current.carrier) { update.carrier = carrier; shippingChanged = true; }
  }
  if ('tracking_number' in body) {
    const tn = clean(body.tracking_number, 150) || null;
    if (tn !== current.tracking_number) { update.tracking_number = tn; shippingChanged = true; }
  }

  if (!Object.keys(update).length) return NextResponse.json({ ok: true, changed: false });

  const { error } = await admin.from('orders').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const note = clean(body.note, 2000) || null;

  if (newStatus) {
    // The trigger just logged this change; stamp who did it and add the note.
    const { data: ev } = await admin
      .from('order_events')
      .select('id')
      .eq('order_id', id)
      .eq('status', newStatus)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ev) await admin.from('order_events').update({ created_by: who.email, note }).eq('id', ev.id);
  }

  if (shippingChanged) {
    const carrier = (update.carrier ?? current.carrier) || '—';
    const tn = (update.tracking_number ?? current.tracking_number) || '—';
    await admin.from('order_events').insert({
      order_id: id,
      note: `Shipping updated — carrier: ${carrier}, tracking: ${tn}`,
      customer_visible: true,
      created_by: who.email,
    });
  }

  return NextResponse.json({ ok: true, changed: true });
}
