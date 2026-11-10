import { createHash, randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Rep sign-up links (task 9). The token is shown once (in the link); only its SHA-256 is stored. A sign-up creates a
// login and an INACTIVE rep card; an admin approves it before the rep can use anything (the email is never verified).
export const INVITE_DAYS = 7;
export const MIN_PASSWORD = 8;
export const RATE_LIMIT = { attempts: 10, minutes: 15 };
export const INVALID_LINK = 'This invite link is not valid. It may have expired, been used or been cancelled. Ask RIVIX for a new one.';
export const TOO_MANY = 'Too many attempts. Please try again in a few minutes.';

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const looksLikeToken = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(t);

export function inviteLink(req: NextRequest, token: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '');
  return `${base}/join/${token}`;
}

export type InviteRow = {
  id: string; email: string; created_by: string | null; created_at: string; expires_at: string; used_at: string | null;
  used_by_user_id: string | null; rep_id: string | null; cancelled_at: string | null; cancelled_by: string | null;
  approved_at: string | null; approved_by: string | null;
};
export type InviteStatus = 'pending' | 'expired' | 'cancelled' | 'awaiting_approval' | 'approved';
export function inviteStatus(r: InviteRow, now = Date.now()): InviteStatus {
  if (r.used_at) return r.approved_at ? 'approved' : 'awaiting_approval';
  if (r.cancelled_at) return 'cancelled';
  return new Date(r.expires_at).getTime() <= now ? 'expired' : 'pending';
}

// The caller's IP for the rate limit. Only headers the host (Vercel) sets and a client cannot fake are trusted:
// x-vercel-forwarded-for, then x-real-ip. Never the first value of a client-sent x-forwarded-for. Without them (local
// dev) every caller shares one fixed key.
export function clientKey(req: NextRequest): string {
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'local-dev';
  return createHash('sha256').update(`rep-signup:${ip}`).digest('hex');
}

// Counts this attempt; true when the caller is over the limit. Old rows are cleared as new ones come in.
export async function overRateLimit(admin: SupabaseClient, req: NextRequest): Promise<boolean> {
  const key = clientKey(req);
  const since = new Date(Date.now() - RATE_LIMIT.minutes * 60_000).toISOString();
  await admin.from('rep_signup_attempts').insert({ ip_hash: key });
  await admin.from('rep_signup_attempts').delete().lt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
  const { count } = await admin.from('rep_signup_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', key).gte('created_at', since);
  return (count ?? 0) > RATE_LIMIT.attempts;
}

// A rep whose card was made by a sign-up link and has not been approved yet.
export async function isAwaitingApproval(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('rep_invites').select('id').eq('used_by_user_id', userId).not('used_at', 'is', null).is('approved_at', null).limit(1);
  if (!data?.length) return false;
  const { data: rep } = await admin.from('reps').select('active').eq('user_id', userId).maybeSingle();
  return !!rep && !rep.active;
}

// Approve a rep who joined through a link: the rep card becomes active and the invite records who approved it.
export async function approveInvitedRep(admin: SupabaseClient, inviteId: string, by: string): Promise<{ ok: true; repId: string; name: string; userId: string | null } | { ok: false; status: number; error: string }> {
  const { data: inv } = await admin.from('rep_invites').select('id, rep_id, used_at, approved_at').eq('id', inviteId).maybeSingle();
  if (!inv) return { ok: false, status: 404, error: 'Invite not found.' };
  if (!inv.used_at || !inv.rep_id) return { ok: false, status: 400, error: 'Nobody has signed up with this link yet.' };
  if (inv.approved_at) return { ok: false, status: 409, error: 'This rep has already been approved.' };
  const { data: claimed } = await admin.from('rep_invites').update({ approved_at: new Date().toISOString(), approved_by: by }).eq('id', inviteId).is('approved_at', null).select('id');
  if (!claimed?.length) return { ok: false, status: 409, error: 'This rep has already been approved.' };
  const { data: rep, error } = await admin.from('reps').update({ active: true }).eq('id', inv.rep_id).select('id, name, user_id').single();
  if (error || !rep) {
    await admin.from('rep_invites').update({ approved_at: null, approved_by: null }).eq('id', inviteId);
    return { ok: false, status: 500, error: error?.message || 'Could not approve the rep.' };
  }
  return { ok: true, repId: rep.id, name: rep.name, userId: rep.user_id };
}
