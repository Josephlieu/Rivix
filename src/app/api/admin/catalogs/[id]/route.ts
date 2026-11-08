import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity, requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { CATALOG_BUCKET } from '@/lib/catalogs';
import { checkUploadedCatalog } from '@/lib/catalog-storage';

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// Edit a catalog's title or description, or replace its file (body.path = a file just uploaded with upload-url).
// On a replacement the old file is removed once the record points at the new one.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const admin = createAdminClient();
  const { data: current } = await admin.from('catalogs').select('id, file_path').eq('id', id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Catalog not found.' }, { status: 404 });

  const update: Record<string, unknown> = {};
  if ('title' in body) {
    const title = clean(body.title, 200);
    if (!title) return NextResponse.json({ error: 'The title cannot be empty.' }, { status: 400 });
    update.title = title;
  }
  if ('description' in body) update.description = clean(body.description, 500) || null;

  let newPath: string | null = null;
  if ('path' in body) {
    newPath = String(body.path ?? '');
    const file = await checkUploadedCatalog(admin, newPath);
    if (!file.ok) return NextResponse.json({ error: file.error }, { status: 400 });
    Object.assign(update, { file_path: newPath, file_name: clean(body.file_name, 200) || newPath, file_size: file.size, mime_type: file.mime, uploaded_by: who.email });
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  update.updated_at = new Date().toISOString();

  const { error } = await admin.from('catalogs').update(update).eq('id', id);
  if (error) {
    if (newPath) await admin.storage.from(CATALOG_BUCKET).remove([newPath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (newPath && current.file_path !== newPath) await admin.storage.from(CATALOG_BUCKET).remove([current.file_path]);
  return NextResponse.json({ ok: true });
}

// Remove a catalog: the record and its file.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();
  const { data: cat } = await admin.from('catalogs').select('id, file_path').eq('id', id).maybeSingle();
  if (!cat) return NextResponse.json({ error: 'Catalog not found.' }, { status: 404 });

  const { error } = await admin.from('catalogs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.storage.from(CATALOG_BUCKET).remove([cat.file_path]);
  return NextResponse.json({ ok: true });
}
