import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { isValidCandidateId, MAX_RESUME_BYTES, RESUME_BUCKET } from '@/lib/hiring-server';

// Open a candidate's resume: after the admin check, send the browser to a short-lived private link.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isValidCandidateId(id)) return NextResponse.json({ error: 'Invalid candidate id.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin.from('hiring_candidates').select('resume_path').eq('id', id).maybeSingle();
  if (!row?.resume_path) return NextResponse.json({ error: 'No resume on file.' }, { status: 404 });

  const { data: signed, error } = await admin.storage.from(RESUME_BUCKET).createSignedUrl(row.resume_path, 60 * 10);
  if (error || !signed) return NextResponse.json({ error: 'Could not open the resume.' }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}

// Attach (or replace) the resume PDF. The candidate must already be saved.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isValidCandidateId(id)) return NextResponse.json({ error: 'Invalid candidate id.' }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('resume');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file was sent.' }, { status: 400 });
  if (file.size > MAX_RESUME_BYTES) return NextResponse.json({ error: 'Resumes must be 4 MB or smaller.' }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Check the file really is a PDF, not just named like one.
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
    return NextResponse.json({ error: 'Only PDF files can be attached.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin.from('hiring_candidates').select('resume_path').eq('id', id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Save the candidate first.' }, { status: 404 });

  const path = `${id}/${Date.now()}.pdf`;
  const { error: upErr } = await admin.storage.from(RESUME_BUCKET).upload(path, bytes, { contentType: 'application/pdf' });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { error } = await admin.from('hiring_candidates').update({ resume_path: path, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    await admin.storage.from(RESUME_BUCKET).remove([path]); // don't leave an orphan file
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (row.resume_path) await admin.storage.from(RESUME_BUCKET).remove([row.resume_path]);
  return NextResponse.json({ ok: true });
}
