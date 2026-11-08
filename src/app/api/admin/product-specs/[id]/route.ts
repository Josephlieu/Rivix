import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { SPEC_BUCKET, checkSpecFields, checkUploadedSpecFile } from '@/lib/product-specs';

// Edit a spec. body.path = attach or replace the file (uploaded first through upload-url); body.remove_file = true
// removes it. The old file is deleted once the spec no longer points at it. The customer cannot be changed.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  if ('customer_id' in body) return NextResponse.json({ error: 'A spec cannot be moved to another customer. Create a new one instead.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: spec } = await admin.from('product_specs').select('id, customer_id, file_url').eq('id', id).maybeSingle();
  if (!spec) return NextResponse.json({ error: 'Spec not found.' }, { status: 404 });

  const checked = checkSpecFields(body, true);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const update: Record<string, unknown> = { ...checked.values };

  let newPath: string | null = null;
  if (body.path) {
    newPath = String(body.path);
    const f = await checkUploadedSpecFile(admin, spec.customer_id, newPath);
    if (!f.ok) return NextResponse.json({ error: f.error }, { status: 400 });
    update.file_url = newPath;
  } else if (body.remove_file === true) {
    update.file_url = null;
    update.file_label = null;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  const { error } = await admin.from('product_specs').update(update).eq('id', id);
  if (error) {
    if (newPath) await admin.storage.from(SPEC_BUCKET).remove([newPath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if ('file_url' in update && spec.file_url && spec.file_url !== update.file_url) await admin.storage.from(SPEC_BUCKET).remove([spec.file_url]);
  return NextResponse.json({ ok: true });
}

// Delete a spec and its file.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const admin = createAdminClient();
  const { data: spec } = await admin.from('product_specs').select('id, file_url').eq('id', id).maybeSingle();
  if (!spec) return NextResponse.json({ error: 'Spec not found.' }, { status: 404 });
  const { error } = await admin.from('product_specs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (spec.file_url) await admin.storage.from(SPEC_BUCKET).remove([spec.file_url]);
  return NextResponse.json({ ok: true });
}
