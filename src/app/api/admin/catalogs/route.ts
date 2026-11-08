import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { CATALOG_BUCKET } from '@/lib/catalogs';
import { checkUploadedCatalog } from '@/lib/catalog-storage';

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// Step 2 of a new catalog: the file is already in the private bucket; record it.
export async function POST(req: NextRequest) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const body = await req.json().catch(() => null);
  const path = String(body?.path ?? '');
  const fileName = clean(body?.file_name, 200);
  const title = clean(body?.title, 200) || fileName.replace(/\.pdf$/i, '');
  const description = clean(body?.description, 500) || null;
  if (!title) return NextResponse.json({ error: 'Give the catalog a title.' }, { status: 400 });

  const admin = createAdminClient();
  const file = await checkUploadedCatalog(admin, path);
  if (!file.ok) return NextResponse.json({ error: file.error }, { status: 400 });

  const { data, error } = await admin
    .from('catalogs')
    .insert({ title, description, file_path: path, file_name: fileName || path, file_size: file.size, mime_type: file.mime, uploaded_by: who.email })
    .select('id')
    .single();
  if (error) {
    await admin.storage.from(CATALOG_BUCKET).remove([path]); // don't leave an orphan file behind
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
