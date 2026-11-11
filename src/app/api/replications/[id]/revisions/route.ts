import { NextRequest, NextResponse } from 'next/server';
import { adminTechFile } from '@/lib/tech-file-access';

// Task 30: the tech file's revision history, newest first (admin only): who, when, draft or approved, what changed, the
// template and drawing versions, the stored PDF's fingerprint, and the customer approvals attached to each revision.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await adminTechFile((await params).id);
  if (ctx instanceof NextResponse) return ctx;
  const [revs, apps] = await Promise.all([
    ctx.admin.from('replication_revisions').select('id, seq, status, revision, changes, template_versions, drawing, pdf_path, pdf_sha256, created_by_email, created_at').eq('replication_id', ctx.row.id).order('seq', { ascending: false }),
    ctx.admin.from('replication_customer_approvals').select('id, revision_id, file_name, file_type, file_size, file_sha256, approved_by_name, approved_on, note, uploaded_by_email, created_at').eq('replication_id', ctx.row.id).order('created_at', { ascending: true }),
  ]);
  if (revs.error) return NextResponse.json({ revisions: [], missing: true });
  return NextResponse.json({
    revisions: (revs.data || []).map((r) => ({
      id: r.id, seq: r.seq, status: r.status, revision: r.revision, changes: r.changes ?? [], templateVersions: r.template_versions ?? [], drawing: r.drawing ?? null,
      pdf: r.pdf_path ? { sha256: r.pdf_sha256 } : null, by: r.created_by_email, at: r.created_at,
      approvals: (apps.data || []).filter((a) => a.revision_id === r.id).map((a) => ({ id: a.id, fileName: a.file_name, fileType: a.file_type, fileSize: a.file_size, sha256: a.file_sha256, approvedBy: a.approved_by_name, approvedOn: a.approved_on, note: a.note, uploadedBy: a.uploaded_by_email, at: a.created_at })),
    })),
  });
}
