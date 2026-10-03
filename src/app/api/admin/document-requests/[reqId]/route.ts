import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { customerParties, notifyUsers } from '@/lib/notify';

// Admin marks a rep's document request as done (without uploading, or after).
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ reqId: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const { reqId } = await params;
  const admin = createAdminClient();
  const { data: r } = await admin
    .from('document_requests')
    .select('id, status, order_id, customer_id, doc_type, orders(batch_number)')
    .eq('id', reqId)
    .maybeSingle();
  if (!r) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  if (r.status === 'done') return NextResponse.json({ ok: true, changed: false });

  const { error } = await admin
    .from('document_requests')
    .update({ status: 'done', done_at: new Date().toISOString(), done_by: who.email })
    .eq('id', reqId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const parties = await customerParties(admin, r.customer_id);
  await notifyUsers(admin, [parties.repUserId], {
    kind: 'request_done',
    title: 'Your document request was handled',
    body: `${r.doc_type} for ${(r as any).orders?.batch_number || 'the order'}`,
    link: `/rep/orders/${r.order_id}`,
    order_id: r.order_id,
  });
  return NextResponse.json({ ok: true, changed: true });
}
