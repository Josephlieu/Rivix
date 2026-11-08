import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAdminUser } from '@/lib/admin-auth';
import { getCurrentRep } from '@/lib/current-rep';
import { clean } from '@/lib/order-input';
import { notifyUsers } from '@/lib/notify';

// A rep (for one of their own customers) or an admin (any customer) declines an open order request, with a reason the
// customer sees. Body: { action: 'decline', reason }. Turning a request into an order happens in the order routes.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const isAdmin = isAdminUser(user);
  const rep = isAdmin ? null : await getCurrentRep();
  if (!isAdmin && !rep) return NextResponse.json({ error: 'Only the sales rep or an admin can do this.' }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (body?.action !== 'decline') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  const reason = clean(body.reason, 500);
  if (!reason) return NextResponse.json({ error: 'Give the customer a reason.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: r } = await admin.from('order_requests').select('id, customer_id, status, kind, customers(user_id, rep_id)').eq('id', id).maybeSingle();
  const cust = (r as unknown as { customers?: { user_id: string | null; rep_id: string | null } } | null)?.customers;
  // A rep only for their own customers; same answer whether it does not exist or is someone else's.
  if (!r || (!isAdmin && cust?.rep_id !== rep!.id)) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  if (r.status !== 'open') return NextResponse.json({ error: 'This request has already been handled.' }, { status: 409 });

  const { data: done } = await admin
    .from('order_requests')
    .update({ status: 'declined', decline_reason: reason, decided_by: isAdmin ? user.email || 'admin' : rep!.name, decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open')
    .select('id');
  if (!done?.length) return NextResponse.json({ error: 'This request has already been handled.' }, { status: 409 });

  await notifyUsers(admin, [cust?.user_id], {
    kind: 'order_request_declined',
    title: r.kind === 'reorder' ? 'Your reorder request was declined' : 'Your quote request was declined',
    body: reason,
    link: '/portal/requests',
  });
  return NextResponse.json({ ok: true });
}
