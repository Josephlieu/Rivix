import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { BAN_FOREVER, isBanned } from '@/lib/customer-status';
import { notifyUsers } from '@/lib/notify';

// One customer with their orders, for the Client Detail page.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: customer } = await admin
    .from('customers')
    .select('id, user_id, customer_code, company_name, contact_email, contact_phone, rep_id, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  const { data: orders } = await admin
    .from('orders')
    .select('id, batch_number, product_name, quantity, status, order_date, ship_date')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  let disabled = false;
  if (customer.user_id) {
    const { data } = await admin.auth.admin.getUserById(customer.user_id);
    disabled = isBanned(data?.user as any);
  }

  return NextResponse.json({
    customer: { ...customer, user_id: undefined, disabled },
    orders: orders || [],
  });
}

// Edit a customer: company, phone, rep, and Active/Disabled.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const admin = createAdminClient();
  const update: Record<string, unknown> = {};
  const { data: before } = await admin.from('customers').select('rep_id').eq('id', id).maybeSingle();

  if ('company_name' in body) {
    const name = String(body.company_name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Company name cannot be empty.' }, { status: 400 });
    update.company_name = name;
  }
  if ('contact_phone' in body) update.contact_phone = String(body.contact_phone ?? '').trim() || null;

  if ('rep_id' in body) {
    const repId = body.rep_id ? String(body.rep_id) : null;
    if (repId) {
      const { data: rep } = await admin.from('reps').select('id, active').eq('id', repId).maybeSingle();
      if (!rep) return NextResponse.json({ error: 'That rep does not exist.' }, { status: 400 });
      if (!rep.active) return NextResponse.json({ error: 'That rep is disabled.' }, { status: 400 });
    }
    update.rep_id = repId;
  }

  if (!Object.keys(update).length && !('active' in body)) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  let data: any = null;
  if (Object.keys(update).length) {
    const res = await admin
      .from('customers')
      .update(update)
      .eq('id', id)
      .select('id, user_id, company_name, contact_phone, rep_id')
      .single();
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    data = res.data;
  } else {
    const res = await admin.from('customers').select('id, user_id, company_name, contact_phone, rep_id').eq('id', id).single();
    if (res.error) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    data = res.data;
  }

  // Tell the people involved when the assigned rep changes.
  if ('rep_id' in update && before && (update.rep_id ?? null) !== (before.rep_id ?? null)) {
    const ids = [update.rep_id as string | null, before.rep_id as string | null].filter(Boolean) as string[];
    const { data: reps } = ids.length ? await admin.from('reps').select('id, name, user_id').in('id', ids) : { data: [] as any[] };
    const byId = new Map((reps || []).map((r: any) => [r.id, r]));
    const company = data.company_name || 'A customer';
    const newRep = update.rep_id ? byId.get(update.rep_id as string) : null;
    const oldRep = before.rep_id ? byId.get(before.rep_id) : null;
    if (newRep) {
      await notifyUsers(admin, [newRep.user_id], {
        kind: 'customer_assigned',
        title: `New customer assigned: ${company}`,
        body: 'You can now see their orders and create new ones.',
        link: `/rep/customers/${id}`,
      });
    }
    if (oldRep) {
      await notifyUsers(admin, [oldRep.user_id], {
        kind: 'customer_unassigned',
        title: `${company} is no longer assigned to you`,
        body: newRep ? `They were moved to ${newRep.name}.` : 'They have no sales rep at the moment.',
        link: '/rep/customers',
      });
    }
    await notifyUsers(admin, [data.user_id], {
      kind: 'rep_changed',
      title: newRep ? `Your sales rep is now ${newRep.name}` : 'Your sales rep has changed',
      body: newRep ? 'Contact details are in the sidebar.' : null,
      link: '/portal',
    });
  }

  // Disabling bans the login so they genuinely can't sign in; enabling lifts it.
  if ('active' in body && data.user_id) {
    const { error } = await admin.auth.admin.updateUserById(data.user_id, {
      ban_duration: body.active ? 'none' : BAN_FOREVER,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customer: { ...data, user_id: undefined } });
}

// Delete a customer — only if they have no orders. Otherwise disable instead.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: customer } = await admin.from('customers').select('id, user_id').eq('id', id).maybeSingle();
  if (!customer) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  const { count, error: countErr } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `This client has ${count} order(s), so they can't be deleted. Disable them instead.` },
      { status: 409 }
    );
  }

  // Deleting the login cascades to the customer row (customers.user_id ... on delete cascade).
  if (customer.user_id) {
    const { error } = await admin.auth.admin.deleteUser(customer.user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { error } = await admin.from('customers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
