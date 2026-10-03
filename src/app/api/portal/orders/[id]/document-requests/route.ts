import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { adminUserIds, customerParties, notifyUsers } from '@/lib/notify';
import { DOC_TYPES } from '@/lib/documents';
import { canRequestDocuments } from '@/lib/order-stages';

// A customer asks for a document on one of their own orders. It goes to their
// sales rep (who decides whether to pass it to admin). With no rep assigned, it
// goes straight to admin instead so it isn't lost.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const docType = (DOC_TYPES as readonly string[]).includes(body?.doc_type) ? String(body.doc_type) : 'Other';
  const note = String(body?.note ?? '').trim().slice(0, 1000) || null;

  const admin = createAdminClient();
  const { data: customer } = await admin.from('customers').select('id, company_name, rep_id').eq('user_id', user.id).maybeSingle();
  if (!customer) return NextResponse.json({ error: 'Only customers can send this request.' }, { status: 403 });

  const { data: order } = await admin.from('orders').select('id, batch_number, customer_id, status').eq('id', id).maybeSingle();
  // Same answer whether the order doesn't exist or isn't theirs
  if (!order || order.customer_id !== customer.id) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.status === 'Cancelled') return NextResponse.json({ error: 'This order was cancelled.' }, { status: 400 });
  if (!canRequestDocuments(order.status)) {
    return NextResponse.json({ error: 'You can request documents once your order has shipped.' }, { status: 400 });
  }

  // One open request per type per order
  const { data: dup } = await admin
    .from('document_requests')
    .select('id')
    .eq('order_id', order.id)
    .eq('doc_type', docType)
    .in('status', ['pending_rep', 'open'])
    .limit(1);
  if (dup?.length) return NextResponse.json({ error: 'You have already asked for this document.' }, { status: 409 });

  const parties = await customerParties(admin, customer.id);
  const toRep = Boolean(customer.rep_id && parties.repUserId);

  const { data: row, error } = await admin
    .from('document_requests')
    .insert({
      order_id: order.id,
      customer_id: customer.id,
      rep_id: customer.rep_id,
      doc_type: docType,
      note,
      requested_by: 'customer',
      status: toRep ? 'pending_rep' : 'open',
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const text = `${docType} for ${order.batch_number}${note ? ` — ${note}` : ''}`;
  if (toRep) {
    await notifyUsers(admin, [parties.repUserId], {
      kind: 'customer_request',
      title: `${customer.company_name} asked for a document`,
      body: text,
      link: `/rep/orders/${order.id}`,
      order_id: order.id,
    });
  } else {
    await notifyUsers(admin, await adminUserIds(admin), {
      kind: 'document_request',
      title: `${customer.company_name} asked for a document`,
      body: text,
      link: `/admin/orders/${order.id}`,
      order_id: order.id,
    });
  }

  return NextResponse.json({ id: row.id, to: toRep ? 'rep' : 'admin' }, { status: 201 });
}
