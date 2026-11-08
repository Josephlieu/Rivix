import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { invalidateDashboard } from '@/lib/dashboard-data';
import { parseExpiryDate } from '@/lib/documents';

// Set, change or clear a document's expiry date. Only the expiry date can be changed here.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { docId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !('expires_on' in body)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const expiry = parseExpiryDate(body.expires_on);
  if (!expiry.ok) return NextResponse.json({ error: 'Use a real date (YYYY-MM-DD), or leave it empty for no expiry.' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('documents').update({ expires_on: expiry.value }).eq('id', docId).select('id, expires_on').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, expires_on: data.expires_on });
}

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
  invalidateDashboard(); // the document count changed
  return NextResponse.json({ ok: true });
}
