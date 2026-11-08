import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { safeFileName } from '@/lib/documents';
import { CATALOG_BUCKET, CATALOG_MIME, MAX_CATALOG_BYTES } from '@/lib/catalogs';

// Step 1 of a catalog upload (new or replacement): check the file, then hand the browser a one-time signed upload
// link so the file goes straight to the private bucket (a big PDF would hit the hosting request-size limit here).
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const fileName = String(body?.file_name ?? '');
  const size = Number(body?.size);
  const mime = String(body?.mime ?? '');
  if (!fileName) return NextResponse.json({ error: 'Choose a file first.' }, { status: 400 });
  if (mime !== CATALOG_MIME) return NextResponse.json({ error: 'Catalogs must be PDF files.' }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_CATALOG_BYTES) return NextResponse.json({ error: 'Catalogs must be 50 MB or smaller.' }, { status: 400 });

  const path = `${randomUUID()}-${safeFileName(fileName)}`;
  const { data, error } = await createAdminClient().storage.from(CATALOG_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not start the upload.' }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token });
}
