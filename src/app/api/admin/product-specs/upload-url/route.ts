import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { ALLOWED_DOC_MIME, MAX_DOC_BYTES, safeFileName } from '@/lib/documents';
import { SPEC_BUCKET } from '@/lib/product-specs';

// Step 1 of a spec file upload: check the file, then hand the browser a one-time signed upload link into THIS
// customer's folder of the private bucket.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const customerId = String(body?.customer_id ?? '');
  const fileName = String(body?.file_name ?? '');
  const size = Number(body?.size);
  const mime = String(body?.mime ?? '');
  if (!fileName) return NextResponse.json({ error: 'Choose a file first.' }, { status: 400 });
  if (!(ALLOWED_DOC_MIME as readonly string[]).includes(mime)) return NextResponse.json({ error: 'That file type is not allowed. Use PDF, an image, Word or Excel.' }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_DOC_BYTES) return NextResponse.json({ error: 'Files must be 20 MB or smaller.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: customer } = await admin.from('customers').select('id').eq('id', customerId).maybeSingle();
  if (!customer) return NextResponse.json({ error: 'That customer does not exist.' }, { status: 404 });

  const path = `${customer.id}/${randomUUID()}-${safeFileName(fileName)}`;
  const { data, error } = await admin.storage.from(SPEC_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not start the upload.' }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token });
}
