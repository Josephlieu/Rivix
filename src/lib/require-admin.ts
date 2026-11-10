import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { readAdminSession, TWO_STEP_REQUIRED } from '@/lib/admin-session';

// Call at the top of any admin-only API route. Returns a 401 response to send straight back unless the caller is a
// signed-in admin who has passed the two-step sign-in (aal2); null when they may go on.
export async function requireAdmin(): Promise<NextResponse | null> {
  const s = await readAdminSession(await createSupabaseServerClient());
  if (!s.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!s.trusted) return NextResponse.json({ error: TWO_STEP_REQUIRED, code: 'mfa_required' }, { status: 401 });
  return null;
}

// Same check, but also returns who the admin is (for "who did this" records).
export async function getAdminIdentity(): Promise<{ denied: NextResponse } | { email: string; userId: string }> {
  const s = await readAdminSession(await createSupabaseServerClient());
  if (!s.isAdmin) return { denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!s.trusted) return { denied: NextResponse.json({ error: TWO_STEP_REQUIRED, code: 'mfa_required' }, { status: 401 }) };
  return { email: s.user?.email || 'admin', userId: s.user!.id };
}

// For routes that serve admins AND others (reps, customers): true only for a fully trusted admin. A password-only
// admin session is treated as having no admin rights at all.
export async function isTrustedAdmin(): Promise<boolean> {
  return (await readAdminSession(await createSupabaseServerClient())).trusted;
}
