import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getReplicationActor, unauthorized, notFound } from '@/lib/replication-access';
import { isValidReplicationId } from '@/lib/replication-server';

// Who downloaded the tech file (admin only: reps cannot download it, and cannot read this log either).
async function adminOnly(id: string) {
  const actor = await getReplicationActor();
  if (!actor) return { error: unauthorized() } as const;
  if (actor.kind !== 'admin') return { error: NextResponse.json({ error: 'Only an admin can download the tech file.' }, { status: 403 }) } as const;
  if (!isValidReplicationId(id)) return { error: NextResponse.json({ error: 'Invalid request id.' }, { status: 400 }) } as const;
  const admin = createAdminClient();
  const { data: row } = await admin.from('replications').select('id').eq('id', id).maybeSingle();
  if (!row) return { error: notFound() } as const;
  return { actor, admin, id: row.id as string } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await adminOnly((await params).id);
  if ('error' in ctx) return ctx.error;
  const { data, error } = await ctx.admin
    .from('replication_downloads')
    .select('id, downloaded_by_email, downloaded_by_role, revision, approved, created_at')
    .eq('replication_id', ctx.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ downloads: [] });
  return NextResponse.json({ downloads: (data || []).map(d => ({ id: d.id, by: d.downloaded_by_email, role: d.downloaded_by_role, revision: d.revision, approved: d.approved, at: d.created_at })) });
}

// Record a download. Best effort: a failed log never stops the file from being made.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await adminOnly((await params).id);
  if ('error' in ctx) return ctx.error;
  const body = await req.json().catch(() => ({}));
  const revision = Number.isFinite(Number(body?.revision)) ? Math.max(0, Math.floor(Number(body.revision))) : null;
  const { error } = await ctx.admin.from('replication_downloads').insert({
    replication_id: ctx.id, downloaded_by: ctx.actor.userId, downloaded_by_email: ctx.actor.email, downloaded_by_role: ctx.actor.kind, revision, approved: body?.approved === true,
  });
  if (error) console.error('download log failed:', error.message);
  return NextResponse.json({ ok: !error });
}
