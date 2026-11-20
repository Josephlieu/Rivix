import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { audit, adminActor } from '@/lib/audit';

// Cancel a pending invite: the link stops working at once. A used invite cannot be cancelled (disable the rep instead).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invite not found.' }, { status: 404 });
  const admin = createAdminClient();
  const { data } = await admin.from('rep_invites')
    .update({ cancelled_at: new Date().toISOString(), cancelled_by: who.email })
    .eq('id', id).is('used_at', null).is('cancelled_at', null)
    .select('id, email');
  if (data?.length) {
    const audited = await audit(admin, adminActor(who), { action: 'rep_invite.cancel', table: 'rep_invites', id, route: 'POST /api/admin/rep-invites/[id]/cancel', before: { cancelled: false }, after: { cancelled: true, email: data[0].email } });
    return NextResponse.json({ ok: true, ...audited });
  }
  const { data: exists } = await admin.from('rep_invites').select('id, used_at').eq('id', id).maybeSingle();
  if (!exists) return NextResponse.json({ error: 'Invite not found.' }, { status: 404 });
  return NextResponse.json({ error: exists.used_at ? 'This link has already been used. Disable the rep instead.' : 'This invite was already cancelled.' }, { status: 409 });
}
