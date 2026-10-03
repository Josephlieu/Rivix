import { NextRequest, NextResponse } from 'next/server';
import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import { adminUserIds, notifyUsers } from '@/lib/notify';
import { DOC_TYPES } from '@/lib/documents';

// A rep asks admin for a document on one of their own customers' orders.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rep = await getCurrentRep();
  if (!rep) return NextResponse.json({ error: 'Only sales reps can request documents.' }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const docType = (DOC_TYPES as readonly string[]).includes(body?.doc_type) ? String(body.doc_type) : 'Other';
  const note = String(body?.note ?? '').trim().slice(0, 1000) || null;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, batch_number, customer_id, customers(company_name, rep_id)')
    .eq('id', id)
    .maybeSingle();
  // Only orders of this rep's own customers
  if (!order || (order as any).customers?.rep_id !== rep.id) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const { data: reqRow, error } = await admin
    .from('document_requests')
    .insert({ order_id: order.id, customer_id: order.customer_id, rep_id: rep.id, doc_type: docType, note })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyUsers(admin, await adminUserIds(admin), {
    kind: 'document_request',
    title: `${rep.name} requested a document`,
    body: `${docType} for ${order.batch_number} (${(order as any).customers?.company_name || 'customer'})${note ? ` — ${note}` : ''}`,
    link: `/admin/orders/${order.id}`,
    order_id: order.id,
  });

  return NextResponse.json({ id: reqRow.id }, { status: 201 });
}
