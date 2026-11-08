import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { checkField, isRequestField, FIELD_LABELS, type RequestField } from '@/lib/account-fields';
import { adminUsers, notifyUsers } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { changeRequestAdminEmail, loginEmailChangeEmail } from '@/lib/account-emails';

// A customer asks RIVIX to change their company name, login email or addresses. Nothing changes until an admin
// approves it. Body: { changes: { company_name?: string, login_email?: string, billing_address?: string, shipping_address?: string } }
// Admins are told in the app and by email; the customer's rep in the app. A login email change also emails the OLD
// address, so the real owner notices if it was not them.
export async function POST(req: NextRequest) {
  const me = await getSessionCustomer();
  if ('denied' in me) return me.denied;
  const { customer: c, loginEmail, admin } = me;

  const body = await req.json().catch(() => null);
  const changes = body?.changes;
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const keys = Object.keys(changes);
  const bad = keys.filter((k) => !isRequestField(k));
  if (bad.length) return NextResponse.json({ error: `These fields cannot be requested: ${bad.join(', ')}.` }, { status: 400 });

  const current: Record<RequestField, string | null> = {
    company_name: c.company_name, login_email: loginEmail, billing_address: c.billing_address, shipping_address: c.shipping_address,
  };
  const wanted: { field: RequestField; oldValue: string | null; newValue: string }[] = [];
  for (const field of keys as RequestField[]) {
    const r = checkField(field, changes[field]);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    if ((r.value ?? '') === (current[field] ?? '')) continue; // unchanged: nothing to ask for
    // A request needs a new value; clearing an address is asked for as an empty line, which RIVIX can see.
    wanted.push({ field, oldValue: current[field], newValue: r.value ?? '' });
  }
  if (!wanted.length) return NextResponse.json({ error: 'Nothing changed.' }, { status: 400 });

  const { data: pending } = await admin.from('account_change_requests').select('field').eq('customer_id', c.id).eq('status', 'pending').in('field', wanted.map((w) => w.field));
  if (pending?.length) {
    const names = pending.map((p) => FIELD_LABELS[p.field as RequestField] || p.field).join(', ');
    return NextResponse.json({ error: `You already asked to change: ${names}. Please wait for RIVIX to review it.` }, { status: 409 });
  }

  const { data: rows, error } = await admin
    .from('account_change_requests')
    .insert(wanted.map((w) => ({ customer_id: c.id, field: w.field, old_value: w.oldValue, new_value: w.newValue, requested_by: c.user_id })))
    .select('id, field, old_value, new_value, status, created_at');
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'You already asked to change this. Please wait for RIVIX to review it.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // In-app: every admin and the customer's rep (with no rep, the admins handle it).
  const summary = wanted.map((w) => `${FIELD_LABELS[w.field]}: ${w.newValue || '(empty)'}`).join('; ');
  const admins = await adminUsers(admin);
  await notifyUsers(admin, admins.map((a) => a.id), {
    kind: 'account_change_request',
    title: `${c.company_name} asked to change their account details`,
    body: summary,
    link: `/admin/clients/${c.id}`,
  });
  if (c.rep_id) {
    const { data: rep } = await admin.from('reps').select('user_id').eq('id', c.rep_id).maybeSingle();
    await notifyUsers(admin, [rep?.user_id], {
      kind: 'account_change_request',
      title: `${c.company_name} asked RIVIX to change their account details`,
      body: summary,
      link: `/rep/customers/${c.id}`,
    });
  }

  // Emails never throw and never undo the request.
  const adminMails = await Promise.all(
    admins.filter((a) => a.email).map((a) => sendEmail(changeRequestAdminEmail({ to: a.email, company: c.company_name, customerId: c.id, changes: wanted })))
  );
  const failedAdmin = adminMails.filter((r) => !r.ok);
  if (failedAdmin.length) console.error('change request admin email failed:', failedAdmin.map((r) => (r.ok ? '' : r.error)).join(' | '));

  let emailWarning: string | undefined;
  let oldAddressNotice: 'sent' | 'dry_run' | 'failed' | undefined;
  const loginChange = wanted.find((w) => w.field === 'login_email');
  if (loginChange) {
    const r = await sendEmail(loginEmailChangeEmail({ oldEmail: loginEmail, newEmail: loginChange.newValue, company: c.company_name, stage: 'requested' }));
    oldAddressNotice = r.ok ? (r.dryRun ? 'dry_run' : 'sent') : 'failed';
    if (!r.ok) {
      console.error('login email change notice failed:', r.error);
      emailWarning = `Your request was sent, but we could not email ${loginEmail} about the login email change: ${r.error}.`;
    }
  }

  return NextResponse.json({ ok: true, requests: rows, emailWarning, oldAddressNotice }, { status: 201 });
}
