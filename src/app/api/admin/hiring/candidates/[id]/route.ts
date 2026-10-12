import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { candidateToRow, isValidCandidateId, rowToCandidate, RESUME_BUCKET } from '@/lib/hiring-server';

// Create or update one candidate (the browser picks the id for a new one).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isValidCandidateId(id)) return NextResponse.json({ error: 'Invalid candidate id.' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const parsed = candidateToRow(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // The resume file is handled by its own route, so saving details never touches resume_path.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('hiring_candidates')
    .upsert({ id, ...parsed.row }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ candidate: rowToCandidate(data) });
}

// Remove a candidate and their resume file.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isValidCandidateId(id)) return NextResponse.json({ error: 'Invalid candidate id.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin.from('hiring_candidates').select('resume_path').eq('id', id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });

  if (row.resume_path) await admin.storage.from(RESUME_BUCKET).remove([row.resume_path]);
  const { error } = await admin.from('hiring_candidates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
