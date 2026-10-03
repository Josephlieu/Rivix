import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { DOC_TYPES, MAX_DOC_BYTES } from '@/lib/documents';
import { customerParties, notifyUsers } from '@/lib/notify';

// Step 2 of an upload: the file is already in storage; record it against the order.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const path = String(body?.path ?? '');
  const fileName = String(body?.file_name ?? '').slice(0, 200);
  const title = String(body?.title ?? '').trim().slice(0, 200) || fileName;
  const docType = (DOC_TYPES as readonly string[]).includes(body?.doc_type) ? String(body.doc_type) : 'Other';

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, batch_number, customer_id').eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  // The path must be inside THIS order's folder — it can't point at anyone else's file.
  const prefix = `${order.customer_id}/${order.id}/`;
  if (!path.startsWith(prefix) || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid file path.' }, { status: 400 });
  }

  // Confirm the file really arrived, and take its size from storage, not from the browser.
  const folder = prefix.slice(0, -1);
  const name = path.slice(prefix.length);
  const { data: found } = await admin.storage.from('documents').list(folder, { search: name, limit: 5 });
  const obj = found?.find((f) => f.name === name);
  if (!obj) return NextResponse.json({ error: 'The upload did not finish. Please try again.' }, { status: 400 });
  const size = Number((obj.metadata as any)?.size ?? 0) || null;
  const mime = ((obj.metadata as any)?.mimetype as string) || null;
  if (size && size > MAX_DOC_BYTES) {
    await admin.storage.from('documents').remove([path]);
    return NextResponse.json({ error: 'Files must be 20 MB or smaller.' }, { status: 400 });
  }

  const { data: doc, error } = await admin
    .from('documents')
    .insert({
      customer_id: order.customer_id,
      order_id: order.id,
      title,
      doc_type: docType,
      file_path: path,
      file_name: fileName || name,
      file_size: size,
      mime_type: mime,
      uploaded_by: who.email,
    })
    .select('id')
    .single();

  if (error) {
    // Don't leave an orphan file behind
    await admin.storage.from('documents').remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Open rep requests for this order and this kind of document are now answered.
  const { data: fulfilled } = await admin
    .from('document_requests')
    .update({ status: 'done', done_at: new Date().toISOString(), done_by: who.email })
    .eq('order_id', order.id)
    .in('status', ['open', 'pending_rep'])
    .eq('doc_type', docType)
    .select('id');

  const parties = await customerParties(admin, order.customer_id);
  await notifyUsers(admin, [parties.customerUserId], {
    kind: 'document_added',
    title: `New document for ${order.batch_number}`,
    body: `${docType}: ${title}`,
    link: `/portal/orders/${order.batch_number}`,
    order_id: order.id,
  });
  await notifyUsers(admin, [parties.repUserId], {
    kind: fulfilled?.length ? 'request_done' : 'document_added',
    title: fulfilled?.length ? 'Your document request was fulfilled' : `New document for ${order.batch_number}`,
    body: `${docType}: ${title} (${parties.companyName || 'customer'})`,
    link: `/rep/orders/${order.id}`,
    order_id: order.id,
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
