import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateTempPassword } from '@/lib/temp-password';
import { loadBannedMap } from '@/lib/customer-status';
import { notifyUsers } from '@/lib/notify';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('customers')
    .select('id, user_id, customer_code, company_name, contact_email, contact_phone, rep_id, created_at, orders(count)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const banned = await loadBannedMap(admin);

  return NextResponse.json({
    customers: (data || []).map((c: any) => ({
      ...c,
      order_count: c.orders?.[0]?.count ?? 0,
      disabled: c.user_id ? banned.get(c.user_id) === true : false,
      orders: undefined,
      user_id: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const company = String(body?.company_name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const phone = String(body?.phone || '').trim() || null;
  const repId = body?.rep_id ? String(body.rep_id) : null;

  if (!company || !email) {
    return NextResponse.json({ error: 'Company name and email are required.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const password = generateTempPassword();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr || !created.user) {
    const msg = createErr?.message || 'Could not create the account.';
    const exists = /already|registered|exists/i.test(msg);
    return NextResponse.json(
      { error: exists ? 'An account with that email already exists.' : msg },
      { status: exists ? 409 : 500 }
    );
  }

  const { data: customer, error: custErr } = await admin
    .from('customers')
    .insert({
      user_id: created.user.id,
      company_name: company,
      contact_email: email,
      contact_phone: phone,
      rep_id: repId,
      customer_code: '', // filled in by the database trigger
    })
    .select()
    .single();

  if (custErr) {
    // Don't leave a login with no customer record behind
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: custErr.message }, { status: 500 });
  }

  if (repId) {
    const { data: rep } = await admin.from('reps').select('user_id').eq('id', repId).maybeSingle();
    await notifyUsers(admin, [rep?.user_id], {
      kind: 'customer_assigned',
      title: `New customer assigned: ${company}`,
      body: 'You can now see their orders and create new ones.',
      link: `/rep/customers/${customer.id}`,
    });
  }

  await notifyUsers(admin, [created.user.id], {
    kind: 'welcome',
    title: 'Welcome to your RIVIX portal',
    body: 'Track your orders, see their progress and download your documents here.',
    link: '/portal/orders',
  });

  return NextResponse.json(
    { customer, credentials: { email, password } },
    { status: 201 }
  );
}
