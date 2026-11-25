import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { readAdminSession, TWO_STEP_REQUIRED } from '@/lib/admin-session';
import { getCurrentRep } from '@/lib/current-rep';
import { isId } from '@/lib/catalog-route';
import { notifyUsers } from '@/lib/notify';
import { SPEC_LIMITS } from '@/lib/catalog-families';
import { audit } from '@/lib/audit';

// The customer's rep (own customers only) or a two-step admin decides an open sample request (2026-11-26):
// { action: 'sent' } or { action: 'decline', reason }. Another rep's customer answers like a request that does not exist.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sess = await readAdminSession(await createSupabaseServerClient());
  const user = sess.user;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (sess.isAdmin && !sess.trusted) return NextResponse.json({ error: TWO_STEP_REQUIRED, code: 'mfa_required' }, { status: 401 });
  const isAdmin = sess.trusted;
  const rep = isAdmin ? null : await getCurrentRep();
  if (!isAdmin && !rep) return NextResponse.json({ error: 'Only the sales rep or an admin can do this.' }, { status: 403 });

  const { id } = await params;
  const notFound = NextResponse.json({ error: 'Sample request not found.' }, { status: 404 });
  if (!isId(id)) return notFound;
  const body = await req.json().catch(() => null);
  const action = body?.action === 'sent' ? 'sent' : body?.action === 'decline' ? 'declined' : null;
  if (!action) return NextResponse.json({ error: "action must be 'sent' or 'decline'." }, { status: 400 });
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (action === 'declined' && !reason) return NextResponse.json({ error: 'Give the customer a reason.' }, { status: 400 });
  if (reason.length > SPEC_LIMITS.reason) return NextResponse.json({ error: `The reason is longer than ${SPEC_LIMITS.reason} characters.` }, { status: 400 });

  const admin = createAdminClient();
  const { data: r } = await admin.from('sample_requests').select('id, status, quantity, customer:customers(user_id, rep_id), family:product_families(name)').eq('id', id).maybeSingle();
  const x = r as unknown as { id: string; status: string; quantity: number; customer: { user_id: string | null; rep_id: string | null } | null; family: { name: string } | null } | null;
  if (!x || (!isAdmin && x.customer?.rep_id !== rep!.id)) return notFound;
  if (x.status !== 'open') return NextResponse.json({ error: 'This sample request has already been handled.' }, { status: 409 });

  const email = user.email || (isAdmin ? 'admin' : 'rep');
  const { data: done } = await admin.from('sample_requests')
    .update({ status: action, decided_by: user.id, decided_by_email: email, decided_at: new Date().toISOString(), decline_reason: action === 'declined' ? reason : null })
    .eq('id', id).eq('status', 'open').select('id');
  if (!done?.length) return NextResponse.json({ error: 'This sample request has already been handled.' }, { status: 409 });

  const audited = await audit(admin, { userId: user.id, role: isAdmin ? 'admin' : 'rep', email: user.email ?? null }, {
    action: 'sample_request.decide', table: 'sample_requests', id, route: 'PATCH /api/sample-requests/[id]',
    before: { status: 'open' }, after: { status: action }, note: action === 'declined' ? reason : null,
  });
  await notifyUsers(admin, [x.customer?.user_id], {
    kind: 'sample_request_decided',
    title: action === 'sent' ? `Your samples of ${x.family?.name ?? 'a product'} are on the way` : `Your sample request for ${x.family?.name ?? 'a product'} was declined`,
    body: action === 'declined' ? reason : null,
    link: '/portal/requests',
  });
  return NextResponse.json({ ok: true, status: action, ...audited });
}
