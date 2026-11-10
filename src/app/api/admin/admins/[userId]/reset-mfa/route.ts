import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAdminUser } from '@/lib/admin-auth';
import { adminUserIds, notifyUsers } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { mfaResetEmail } from '@/lib/admin-mfa-emails';

// Recovery for a locked-out admin (task 8): ANOTHER admin (signed in with two-step) removes their authenticator. The
// admin is then signed out everywhere (revoke_user_sessions) and sets up a new authenticator at their next sign-in. There is no bypass link
// and no email-only reset. Safety: the affected admin gets an email, and every admin gets an in-app alert naming who
// did it. A failed email never undoes the reset; the admin sees a warning instead.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const { userId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });
  if (userId === who.userId) return NextResponse.json({ error: 'You cannot reset your own two-step sign-in. Ask another admin.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: target } = await admin.auth.admin.getUserById(userId);
  const user = target?.user;
  if (!user || !isAdminUser(user)) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 }); // only admin accounts

  // 1) Remove every authenticator (verified or half set up).
  const { data: list, error: listErr } = await admin.auth.admin.mfa.listFactors({ userId });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  for (const f of list?.factors || []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (error) return NextResponse.json({ error: `Could not remove the authenticator: ${error.message}` }, { status: 500 });
  }
  const removed = (list?.factors || []).length;

  // 2) Sign them out of every session: revoke_user_sessions() (audit-docs/deliverables/task-08-revoke-user-sessions.sql)
  //    deletes their rows from auth.sessions, which ends their refresh tokens and makes the server refuse their tokens.
  //    Only the service role may call it. If it fails, the reset still stands and the admin is warned.
  let signedOut = false;
  const { error: revokeErr } = await admin.rpc('revoke_user_sessions', { target: userId });
  if (revokeErr) console.error('revoke_user_sessions failed:', revokeErr.message);
  else signedOut = true;
  if (!signedOut) console.error(`two-step reset: could not sign out ${user.email}`);

  // 3) Tell people. In-app: every admin, naming who did it. Email: the affected admin.
  const at = new Date();
  await notifyUsers(admin, await adminUserIds(admin), {
    kind: 'admin_mfa_reset',
    title: `Two-step sign-in reset for ${user.email}`,
    body: `${who.email} reset it${signedOut ? ' and they were signed out' : ''}. They set it up again at their next sign-in.`,
    link: '/admin/team',
  });
  const mail = await sendEmail(mfaResetEmail({ to: user.email ?? null, by: who.email, at }));
  if (!mail.ok) console.error('two-step reset email failed:', mail.error);

  const warnings = [
    ...(mail.ok ? [] : [`the email to ${user.email} was not sent: ${mail.error}`]),
    ...(signedOut ? [] : ['their current sessions could not be ended, so an open session keeps working until it expires (at most 1 hour)']),
  ];
  return NextResponse.json({
    ok: true,
    removed,
    signedOut,
    email: mail.ok ? (mail.dryRun ? 'dry_run' : 'sent') : 'failed',
    emailWarning: warnings.length ? `The two-step sign-in was reset, but ${warnings.join('; and ')}.` : undefined,
  });
}
