import { NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAdminUser } from '@/lib/admin-auth';

// Every admin account and whether its two-step sign-in is set up (for the Team page). Admins only, after two-step.
export async function GET() {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // The user list does not include authenticators, so ask for each admin's (there are only a few admins).
  const admins = (
    await Promise.all(
      (data?.users || []).filter((u) => isAdminUser(u)).map(async (u) => {
        const { data: f } = await admin.auth.admin.mfa.listFactors({ userId: u.id });
        return {
          id: u.id,
          email: u.email ?? '',
          twoStep: (f?.factors || []).some((x) => x.status === 'verified'),
          lastSignIn: u.last_sign_in_at ?? null,
          isYou: u.id === who.userId,
        };
      })
    )
  ).sort((x, y) => x.email.localeCompare(y.email));
  return NextResponse.json({ admins });
}
