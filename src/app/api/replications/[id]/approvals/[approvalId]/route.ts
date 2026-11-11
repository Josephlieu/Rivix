import { NextRequest, NextResponse } from 'next/server';
import { adminTechFile } from '@/lib/tech-file-access';
import { TECH_FILES_BUCKET } from '@/lib/tech-file-pdf-server';

// Task 30: a short-lived link to download a customer approval document (admin only). It always downloads as a file, never
// opens in the browser.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; approvalId: string }> }) {
  const p = await params;
  const ctx = await adminTechFile(p.id);
  if (ctx instanceof NextResponse) return ctx;
  if (!/^[0-9a-f-]{36}$/i.test(p.approvalId)) return NextResponse.json({ error: 'Invalid approval id.' }, { status: 400 });
  const { data: a } = await ctx.admin.from('replication_customer_approvals').select('file_path, file_name, file_sha256').eq('id', p.approvalId).eq('replication_id', ctx.row.id).maybeSingle();
  if (!a) return NextResponse.json({ error: 'Approval not found.' }, { status: 404 });
  const { data, error } = await ctx.admin.storage.from(TECH_FILES_BUCKET).createSignedUrl(a.file_path, 60, { download: a.file_name });
  if (error || !data) return NextResponse.json({ error: 'Could not make a download link.' }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, sha256: a.file_sha256 });
}
