import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { approveInvitedRep } from '@/lib/rep-invites';
import { logRepActivity } from '@/lib/rep-activity';
import { notifyUsers } from '@/lib/notify';

// Approve a rep who signed up with a link: their rep card becomes active and they can use the sales portal.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invite not found.' }, { status: 404 });
  const admin = createAdminClient();
  const r = await approveInvitedRep(admin, id, who.email);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await logRepActivity(admin, { repId: r.repId, kind: 'status', by: who.email, summary: 'Approved after joining through an invite link' });
  await notifyUsers(admin, [r.userId], { kind: 'welcome', title: 'Your RIVIX sales account is approved', body: 'You can now use the sales portal.', link: '/rep' });
  return NextResponse.json({ ok: true });
}
