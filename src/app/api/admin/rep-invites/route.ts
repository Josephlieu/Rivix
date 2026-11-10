import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { INVITE_DAYS, hashToken, inviteLink, inviteStatus, newToken, type InviteRow } from '@/lib/rep-invites';

const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;

// Every rep invite, newest first, with its state (admins only, after two-step).
export async function GET() {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const admin = createAdminClient();
  const { data, error } = await admin.from('rep_invites').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const repIds = (data || []).map((r) => r.rep_id).filter(Boolean) as string[];
  const { data: reps } = repIds.length ? await admin.from('reps').select('id, name, active').in('id', repIds) : { data: [] };
  const byId = new Map((reps || []).map((r) => [r.id, r]));
  return NextResponse.json({
    invites: (data || []).map((r: InviteRow) => ({
      id: r.id, email: r.email, createdBy: r.created_by, createdAt: r.created_at, expiresAt: r.expires_at, usedAt: r.used_at,
      cancelledAt: r.cancelled_at, approvedAt: r.approved_at, approvedBy: r.approved_by, status: inviteStatus(r),
      repName: r.rep_id ? byId.get(r.rep_id)?.name ?? null : null,
    })),
  });
}

// Create an invite for one email. The link (with the token) is returned ONCE; only its hash is stored.
export async function POST(req: NextRequest) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });

  const admin = createAdminClient();
  // Refuse an email that already has a login or a rep card.
  const { data: repSame } = await admin.from('reps').select('id').ilike('email', email).limit(1);
  if (repSame?.length) return NextResponse.json({ error: 'There is already a rep with this email.' }, { status: 409 });
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if ((users?.users || []).some((u) => (u.email || '').toLowerCase() === email)) {
    return NextResponse.json({ error: 'There is already an account with this email.' }, { status: 409 });
  }

  const token = newToken();
  const expires = new Date(Date.now() + INVITE_DAYS * 24 * 3600_000).toISOString();
  const { data, error } = await admin.from('rep_invites')
    .insert({ email, token_hash: hashToken(token), created_by: who.email, expires_at: expires })
    .select('id, email, expires_at')
    .single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'This email already has a pending invite. Cancel it first to make a new one.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ invite: { id: data.id, email: data.email, expiresAt: data.expires_at }, link: inviteLink(req, token) }, { status: 201 });
}
