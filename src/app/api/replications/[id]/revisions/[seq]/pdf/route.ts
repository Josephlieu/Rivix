import { NextRequest, NextResponse } from 'next/server';
import { adminTechFile, seqParam } from '@/lib/tech-file-access';
import { renderRevisionPdf, storeRevisionPdf, TECH_FILES_BUCKET } from '@/lib/tech-file-pdf-server';
import { repsByIds } from '@/lib/replication-access';
import type { TechFileSnapshot } from '@/lib/revisions';

export const maxDuration = 60;

async function revisionOf(ctx: Exclude<Awaited<ReturnType<typeof adminTechFile>>, NextResponse>, seqRaw: string) {
  const seq = seqParam(seqRaw);
  if (!seq) return null;
  const { data } = await ctx.admin.from('replication_revisions').select('*').eq('replication_id', ctx.row.id).eq('seq', seq).maybeSingle();
  return data;
}

// Task 30: a short-lived download link to an approved revision's stored PDF (admin only), and its SHA-256 fingerprint.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; seq: string }> }) {
  const p = await params;
  const ctx = await adminTechFile(p.id);
  if (ctx instanceof NextResponse) return ctx;
  const rev = await revisionOf(ctx, p.seq);
  if (!rev) return NextResponse.json({ error: 'Revision not found.' }, { status: 404 });
  if (!rev.pdf_path) return NextResponse.json({ error: 'This revision has no stored PDF.' }, { status: 404 });
  const name = `${ctx.row.request_code || ctx.row.id}-tech-file-rev${rev.revision}.pdf`;
  const { data, error } = await ctx.admin.storage.from(TECH_FILES_BUCKET).createSignedUrl(rev.pdf_path, 60, { download: name });
  if (error || !data) return NextResponse.json({ error: 'Could not make a download link.' }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, sha256: rev.pdf_sha256 });
}

// Task 30: "Make PDF": stores the PDF of an approved revision that has none yet (made from that revision's own copy). Once only.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; seq: string }> }) {
  const p = await params;
  const ctx = await adminTechFile(p.id);
  if (ctx instanceof NextResponse) return ctx;
  const rev = await revisionOf(ctx, p.seq);
  if (!rev) return NextResponse.json({ error: 'Revision not found.' }, { status: 404 });
  if (rev.status !== 'approved') return NextResponse.json({ error: 'Only an approved revision has a stored PDF.' }, { status: 400 });
  if (rev.pdf_path) return NextResponse.json({ error: 'This revision already has its PDF; it is never replaced.' }, { status: 409 });
  const repName = ctx.row.rep_id ? (await repsByIds(ctx.admin, [ctx.row.rep_id])).get(ctx.row.rep_id)?.name ?? null : null;
  let stored;
  try { stored = await storeRevisionPdf(ctx.admin, ctx.row.id, rev.revision, await renderRevisionPdf(ctx.admin, ctx.row, rev.snapshot as TechFileSnapshot, repName)); }
  catch (e) { return NextResponse.json({ error: `The PDF could not be made: ${e instanceof Error ? e.message.slice(0, 160) : 'unknown error'}` }, { status: 500 }); }
  const { error } = await ctx.admin.from('replication_revisions').update({ pdf_path: stored.path, pdf_sha256: stored.sha256 }).eq('id', rev.id).is('pdf_path', null);
  if (error) { await ctx.admin.storage.from(TECH_FILES_BUCKET).remove([stored.path]); return NextResponse.json({ error: error.message }, { status: 409 }); }
  return NextResponse.json({ ok: true, sha256: stored.sha256 });
}
