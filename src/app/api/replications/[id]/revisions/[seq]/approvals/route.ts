import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { adminTechFile, seqParam } from '@/lib/tech-file-access';
import { TECH_FILES_BUCKET, sha256 } from '@/lib/tech-file-pdf-server';
import { checkApprovalFile, safeFileName } from '@/lib/approval-files';

// Task 30: an admin attaches the customer's approval of an APPROVED revision: a signed PDF, a JPEG or PNG image, or a saved
// email, with who approved it at the customer and when. Customers never see tech files in the portal. The file is checked
// by its content, stored once (no overwrite) with its SHA-256, and the record is never edited or deleted (database trigger).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; seq: string }> }) {
  const p = await params;
  const ctx = await adminTechFile(p.id);
  if (ctx instanceof NextResponse) return ctx;
  const seq = seqParam(p.seq);
  const { data: rev } = seq ? await ctx.admin.from('replication_revisions').select('id, status').eq('replication_id', ctx.row.id).eq('seq', seq).maybeSingle() : { data: null };
  if (!rev) return NextResponse.json({ error: 'Revision not found.' }, { status: 404 });
  if (rev.status !== 'approved') return NextResponse.json({ error: 'A customer approval can only be attached to an approved revision.' }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const approvedBy = String(form?.get('approvedBy') ?? '').trim();
  const approvedOn = String(form?.get('approvedOn') ?? '').trim();
  const note = String(form?.get('note') ?? '').trim();
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose the approval file.' }, { status: 400 });
  if (!approvedBy || approvedBy.length > 200) return NextResponse.json({ error: 'Enter who approved it at the customer.' }, { status: 400 });
  const day = /^\d{4}-\d{2}-\d{2}$/.test(approvedOn) ? new Date(`${approvedOn}T00:00:00Z`) : null;
  if (!day || Number.isNaN(day.getTime()) || day.getTime() > Date.now() + 36 * 3600 * 1000 || day.getUTCFullYear() < 2000) return NextResponse.json({ error: 'Enter the date the customer approved it (not in the future).' }, { status: 400 });
  if (note.length > 2000) return NextResponse.json({ error: 'The note is too long (2000 characters at most).' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkApprovalFile(bytes, file.name || '');
  if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const path = `${ctx.row.id}/approvals/${randomUUID()}.${checked.ext}`;
  const up = await ctx.admin.storage.from(TECH_FILES_BUCKET).upload(path, bytes, { contentType: checked.type, upsert: false });
  if (up.error) return NextResponse.json({ error: `The file could not be stored: ${up.error.message}` }, { status: 500 });
  const { data, error } = await ctx.admin.from('replication_customer_approvals').insert({
    replication_id: ctx.row.id, revision_id: rev.id, file_path: path, file_name: safeFileName(file.name || `approval.${checked.ext}`), file_type: checked.type,
    file_size: bytes.length, file_sha256: sha256(bytes), approved_by_name: approvedBy, approved_on: approvedOn, note, uploaded_by: ctx.actor.userId, uploaded_by_email: ctx.actor.email,
  }).select('id, file_sha256').single();
  if (error) { await ctx.admin.storage.from(TECH_FILES_BUCKET).remove([path]); return NextResponse.json({ error: error.message }, { status: 400 }); }
  return NextResponse.json({ ok: true, id: data.id, sha256: data.file_sha256 });
}
