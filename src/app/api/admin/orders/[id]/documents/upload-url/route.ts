import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { ALLOWED_DOC_MIME, MAX_DOC_BYTES, safeFileName } from '@/lib/documents';

// Step 1 of an upload: check the file is acceptable, then hand the browser a
// one-time signed upload link so the file goes straight to storage. (Sending a
// big file through our own server would hit the hosting request-size limit.)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const fileName = String(body?.file_name ?? '');
  const size = Number(body?.size);
  const mime = String(body?.mime ?? '');

  if (!fileName) return NextResponse.json({ error: 'Choose a file first.' }, { status: 400 });
  if (!(ALLOWED_DOC_MIME as readonly string[]).includes(mime)) {
    return NextResponse.json({ error: 'That file type is not allowed. Use PDF, an image, Word or Excel.' }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_DOC_BYTES) {
    return NextResponse.json({ error: 'Files must be 20 MB or smaller.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, customer_id').eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  const path = `${order.customer_id}/${order.id}/${randomUUID()}-${safeFileName(fileName)}`;
  const { data, error } = await admin.storage.from('documents').createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not start the upload.' }, { status: 500 });

  return NextResponse.json({ path: data.path, token: data.token });
}
