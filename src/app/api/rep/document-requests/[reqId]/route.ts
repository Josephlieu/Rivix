import { NextRequest, NextResponse } from 'next/server';
import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import { adminUserIds, customerParties, notifyUsers } from '@/lib/notify';

// The rep deals with a customer's request: send it to admin, or dismiss it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reqId: string }> }) {
  const rep = await getCurrentRep();
  if (!rep) return NextResponse.json({ error: 'Only sales reps can do this.' }, { status: 403 });

  const { reqId } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== 'forward' && action !== 'dismiss') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: r } = await admin
    .from('document_requests')
    .select('id, status, order_id, customer_id, doc_type, note, requested_by, customers(company_name, rep_id), orders(batch_number)')
    .eq('id', reqId)
    .maybeSingle();
  // Only requests from this rep's own customers
  if (!r || (r as any).customers?.rep_id !== rep.id) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  if (r.status !== 'pending_rep') return NextResponse.json({ error: 'This request was already handled.' }, { status: 409 });

  const batch = (r as any).orders?.batch_number || 'the order';
  const company = (r as any).customers?.company_name || 'the customer';

  const { error } = await admin.from('document_requests').update({ status: action === 'forward' ? 'open' : 'dismissed' }).eq('id', reqId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const parties = await customerParties(admin, r.customer_id);
  if (action === 'forward') {
    await notifyUsers(admin, await adminUserIds(admin), {
      kind: 'document_request',
      title: `${rep.name} passed on a request from ${company}`,
      body: `${r.doc_type} for ${batch}${r.note ? ` — ${r.note}` : ''}`,
      link: `/admin/orders/${r.order_id}`,
      order_id: r.order_id,
    });
    await notifyUsers(admin, [parties.customerUserId], {
      kind: 'request_update',
      title: 'Your document request is being handled',
      body: `${r.doc_type} for ${batch} — ${rep.name} has passed it to RIVIX.`,
      link: `/portal/orders/${batch}`,
      order_id: r.order_id,
    });
  } else {
    await notifyUsers(admin, [parties.customerUserId], {
      kind: 'request_update',
      title: 'About your document request',
      body: `${rep.name} closed your request for ${r.doc_type} (${batch}). Please contact them if you still need it.`,
      link: `/portal/orders/${batch}`,
      order_id: r.order_id,
    });
  }
  return NextResponse.json({ ok: true });
}
