import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';

// Delete a document: the record and the stored file.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { docId } = await params;
  const admin = createAdminClient();
  const { data: doc } = await admin.from('documents').select('id, file_path').eq('id', docId).maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });

  await admin.storage.from('documents').remove([doc.file_path]);
  const { error } = await admin.from('documents').delete().eq('id', docId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
