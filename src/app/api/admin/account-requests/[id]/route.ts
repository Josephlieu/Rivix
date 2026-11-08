import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { checkField, isRequestField, FIELD_LABELS, type RequestField } from '@/lib/account-fields';
import { notifyUsers } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { loginEmailChangeEmail } from '@/lib/account-emails';
import { invalidateDashboard } from '@/lib/dashboard-data';

// An admin approves or rejects a customer's account change request. Body: { decision: 'approve' | 'reject', note? }
// Approving applies the value. A login email change updates the sign-in email (Supabase Auth) and contact_email
// together, then emails the OLD address. The customer is told in the app either way.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== 'approve' && decision !== 'reject') return NextResponse.json({ error: 'Choose approve or reject.' }, { status: 400 });
  const note = String(body?.note ?? '').trim().slice(0, 500) || null;

  const admin = createAdminClient();
  const { data: reqRow } = await admin.from('account_change_requests').select('*').eq('id', id).maybeSingle();
  if (!reqRow) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  if (reqRow.status !== 'pending') return NextResponse.json({ error: 'This request has already been decided.' }, { status: 409 });
  if (!isRequestField(reqRow.field)) return NextResponse.json({ error: 'Unknown field on this request.' }, { status: 400 });
  const field: RequestField = reqRow.field;

  const { data: customer } = await admin.from('customers').select('id, user_id, company_name, contact_email').eq('id', reqRow.customer_id).maybeSingle();
  if (!customer) return NextResponse.json({ error: 'The customer no longer exists.' }, { status: 404 });

  // Claim the request first (only while still pending), so two admins cannot both decide it.
  const decided = { status: decision === 'approve' ? 'approved' : 'rejected', decided_at: new Date().toISOString(), decided_by: who.email, decision_note: note };
  const { data: claimed } = await admin.from('account_change_requests').update(decided).eq('id', id).eq('status', 'pending').select('id').maybeSingle();
  if (!claimed) return NextResponse.json({ error: 'This request has already been decided.' }, { status: 409 });
  const release = async (error: string, status = 400) => {
    await admin.from('account_change_requests').update({ status: 'pending', decided_at: null, decided_by: null, decision_note: null }).eq('id', id);
    return NextResponse.json({ error }, { status });
  };

  let emailWarning: string | undefined;
  let oldAddressNotice: 'sent' | 'dry_run' | 'failed' | undefined;
  if (decision === 'approve') {
    const checked = checkField(field, reqRow.new_value);
    if (!checked.ok) return release(`The requested value is not valid any more: ${checked.error}`);

    if (field === 'login_email') {
      const newEmail = checked.value as string;
      let oldEmail: string | null = customer.contact_email;
      if (customer.user_id) {
        const { data: u } = await admin.auth.admin.getUserById(customer.user_id);
        oldEmail = u?.user?.email ?? oldEmail;
        const { error } = await admin.auth.admin.updateUserById(customer.user_id, { email: newEmail, email_confirm: true });
        if (error) return release(`Could not change the login email: ${error.message}. The request is still pending.`);
      }
      const { error: cErr } = await admin.from('customers').update({ contact_email: newEmail }).eq('id', customer.id);
      if (cErr) console.error('contact_email update after login change failed:', cErr.message);
      const r = await sendEmail(loginEmailChangeEmail({ oldEmail, newEmail, company: customer.company_name, stage: 'approved' }));
      oldAddressNotice = r.ok ? (r.dryRun ? 'dry_run' : 'sent') : 'failed';
      if (!r.ok) {
        console.error('login email change notice failed:', r.error);
        emailWarning = `The login email was changed, but the notice to the old address (${oldEmail || 'none on file'}) was not sent: ${r.error}.`;
      }
    } else {
      const { error } = await admin.from('customers').update({ [field]: checked.value }).eq('id', customer.id);
      if (error) return release(error.message, 500);
      if (field === 'company_name') invalidateDashboard(); // the dashboard shows company names
    }
  }

  const label = FIELD_LABELS[field];
  await notifyUsers(admin, [customer.user_id], {
    kind: 'account_change_decided',
    title: decision === 'approve' ? `Your ${label.toLowerCase()} change was approved` : `Your ${label.toLowerCase()} change was not approved`,
    body: decision === 'approve' ? null : note,
    link: '/portal/account',
  });

  return NextResponse.json({ ok: true, status: decided.status, emailWarning, oldAddressNotice });
}
