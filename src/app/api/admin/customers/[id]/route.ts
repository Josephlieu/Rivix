import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';

// Assign (or unassign) a customer's rep. One rep per customer.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !('rep_id' in body)) {
    return NextResponse.json({ error: 'rep_id is required (or null to unassign).' }, { status: 400 });
  }
  const repId = body.rep_id ? String(body.rep_id) : null;

  const admin = createAdminClient();

  if (repId) {
    const { data: rep } = await admin.from('reps').select('id, active').eq('id', repId).maybeSingle();
    if (!rep) return NextResponse.json({ error: 'That rep does not exist.' }, { status: 400 });
    if (!rep.active) return NextResponse.json({ error: 'That rep is disabled.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('customers')
    .update({ rep_id: repId })
    .eq('id', id)
    .select('id, rep_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customer: data });
}
