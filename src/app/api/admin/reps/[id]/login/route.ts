import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { createOrResetRepLogin } from '@/lib/rep-login';
import { audit, adminActor } from '@/lib/audit';

// Create a login for this rep, or reset their password if they already have one.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: rep } = await admin
    .from('reps')
    .select('id, email, user_id, active')
    .eq('id', id)
    .maybeSingle();
  if (!rep) return NextResponse.json({ error: 'Rep not found.' }, { status: 404 });

  const result = await createOrResetRepLogin(admin, rep);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 500 });

  // A new login gives the rep role (a password reset changes no role and is not a listed action). Never the password.
  const audited = result.userId
    ? await audit(admin, adminActor(who), { action: 'role.grant', table: 'reps', id: rep.id, route: 'POST /api/admin/reps/[id]/login', before: { role: null }, after: { role: 'rep', user_id: result.userId } })
    : {};
  return NextResponse.json({ credentials: result.credentials, reset: Boolean(result.reset), ...audited });
}
