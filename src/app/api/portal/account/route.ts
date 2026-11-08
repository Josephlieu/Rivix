import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { checkDirectEdit } from '@/lib/account-fields';

// The signed-in customer's own account details and their recent change requests.
export async function GET() {
  const me = await getSessionCustomer();
  if ('denied' in me) return me.denied;
  const { customer: c, loginEmail, admin } = me;
  const { data: requests } = await admin
    .from('account_change_requests')
    .select('id, field, old_value, new_value, status, created_at, decided_at, decision_note')
    .eq('customer_id', c.id)
    .order('created_at', { ascending: false })
    .limit(20);
  return NextResponse.json({
    profile: {
      company_name: c.company_name, customer_code: c.customer_code, contact_name: c.contact_name, contact_phone: c.contact_phone,
      contact_email: c.contact_email, billing_address: c.billing_address, shipping_address: c.shipping_address, login_email: loginEmail,
    },
    requests: requests || [],
  });
}

// Direct edits: contact name and phone only, on the caller's own row only. Any other key in the body is refused
// (src/lib/account-fields.ts), and the row is found from the session, never from the body.
export async function PATCH(req: NextRequest) {
  const me = await getSessionCustomer();
  if ('denied' in me) return me.denied;
  const body = await req.json().catch(() => null);
  const checked = checkDirectEdit(body);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  const { data, error } = await me.admin
    .from('customers')
    .update(checked.update)
    .eq('id', me.customer.id)
    .eq('user_id', me.customer.user_id)
    .select('contact_name, contact_phone')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profile: data });
}
