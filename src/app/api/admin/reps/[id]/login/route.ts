import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { createOrResetRepLogin } from '@/lib/rep-login';

// Create a login for this rep, or reset their password if they already have one.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

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

  return NextResponse.json({ credentials: result.credentials, reset: Boolean(result.reset) });
}
