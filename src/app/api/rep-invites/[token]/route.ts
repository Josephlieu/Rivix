import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { INVALID_LINK, MIN_PASSWORD, TOO_MANY, hashToken, looksLikeToken, overRateLimit } from '@/lib/rep-invites';
import { adminUserIds, notifyUsers } from '@/lib/notify';
import { logRepActivity } from '@/lib/rep-activity';

// The public side of a rep sign-up link (task 9). No sign-in: the token in the link is the only key. Rate limited.
// Every way a link can be wrong (unknown, used, cancelled, expired) gets the same answer, so nothing can be probed.
const invalid = () => NextResponse.json({ error: INVALID_LINK }, { status: 404 });
const tooMany = () => NextResponse.json({ error: TOO_MANY }, { status: 429 });

async function openInvite(admin: ReturnType<typeof createAdminClient>, token: string) {
  const { data } = await admin.from('rep_invites').select('id, email, expires_at, used_at, cancelled_at').eq('token_hash', hashToken(token)).maybeSingle();
  if (!data || data.used_at || data.cancelled_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}

// Is this link still good? Returns the email it is for, so the page can show it.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const admin = createAdminClient();
  if (await overRateLimit(admin, req)) return tooMany();
  const { token } = await params;
  if (!looksLikeToken(token)) return invalid();
  const inv = await openInvite(admin, token);
  if (!inv) return invalid();
  return NextResponse.json({ email: inv.email, expiresAt: inv.expires_at });
}

// Sign up: { name, password, phone? }. Anything else in the body (a role, an email, app_metadata...) is ignored.
// 1) claim the invite in ONE conditional update (only while unused, not cancelled, not expired): the link can never be
//    used twice, even by two people at the same moment; 2) create the login with role 'rep' on the server, for the
//    invite's email; 3) create the rep card INACTIVE, waiting for an admin to approve it. A failure undoes what was made
//    and releases the link.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const admin = createAdminClient();
  if (await overRateLimit(admin, req)) return tooMany();
  const { token } = await params;
  if (!looksLikeToken(token)) return invalid();

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
  const password = String(body?.password ?? '');
  const phone = String(body?.phone ?? '').trim();
  if (!name || name.length > 120) return NextResponse.json({ error: 'Enter your name (up to 120 characters).' }, { status: 400 });
  if (password.length < MIN_PASSWORD || password.length > 72) return NextResponse.json({ error: `Choose a password of at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  if (phone.length > 40 || (phone && !/^[0-9+().\-\s]+$/.test(phone))) return NextResponse.json({ error: 'Enter a valid phone number, or leave it empty.' }, { status: 400 });

  const nowIso = new Date().toISOString();
  const { data: claimed } = await admin.from('rep_invites')
    .update({ used_at: nowIso })
    .eq('token_hash', hashToken(token)).is('used_at', null).is('cancelled_at', null).gt('expires_at', nowIso)
    .select('id, email');
  const inv = claimed?.[0];
  if (!inv) return invalid();
  const release = async () => { await admin.from('rep_invites').update({ used_at: null, used_by_user_id: null, rep_id: null }).eq('id', inv.id); };

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: inv.email,
    password,
    email_confirm: true,
    app_metadata: { role: 'rep' }, // set here, never from the browser
    user_metadata: { name },
  });
  if (userErr || !created?.user) {
    await release();
    const exists = /already|registered|exists/i.test(userErr?.message || '');
    return NextResponse.json({ error: exists ? 'An account with this email already exists. Ask RIVIX to check it.' : 'Could not create your account. Please try again.' }, { status: exists ? 409 : 500 });
  }
  const userId = created.user.id;

  const { data: rep, error: repErr } = await admin.from('reps')
    .insert({ name, email: inv.email, phone: phone || null, active: false, user_id: userId })
    .select('id, name')
    .single();
  if (repErr || !rep) {
    await admin.auth.admin.deleteUser(userId);
    await release();
    return NextResponse.json({ error: 'Could not create your account. Please try again.' }, { status: 500 });
  }
  await admin.from('rep_invites').update({ used_by_user_id: userId, rep_id: rep.id }).eq('id', inv.id);

  await logRepActivity(admin, { repId: rep.id, kind: 'joined', by: name, summary: 'Joined through an invite link (waiting for approval)' });
  await notifyUsers(admin, await adminUserIds(admin), {
    kind: 'rep_signup',
    title: `New rep waiting for approval: ${name}`,
    body: `${inv.email} signed up with an invite link. Approve them on the Team page before they can use the sales portal.`,
    link: '/admin/team#rep-invites', // the Approve button is there
  });
  return NextResponse.json({ ok: true, status: 'awaiting_approval' }, { status: 201 });
}
