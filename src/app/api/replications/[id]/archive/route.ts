import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getReplicationActor, unauthorized, notFound } from '@/lib/replication-access';
import { isValidReplicationId, rowToReplication } from '@/lib/replication-server';

// Task 30: archive a request (admin only) instead of deleting it. Everything is kept: photos, revisions, PDFs, customer
// approvals. An archived request leaves the queue; it can be restored. { archived: true | false }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  if (actor.kind !== 'admin') return NextResponse.json({ error: 'Only an admin can archive a request.' }, { status: 403 });
  const { id } = await params;
  if (!isValidReplicationId(id)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (typeof body?.archived !== 'boolean') return NextResponse.json({ error: 'Say whether to archive or restore it.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from('replications').select('id').eq('id', id).maybeSingle();
  if (!existing) return notFound();
  const { data, error } = await admin.from('replications')
    .update(body.archived ? { archived_at: new Date().toISOString(), archived_by_email: actor.email } : { archived_at: null, archived_by_email: null })
    .eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: /archived/.test(error.message) ? 'Archiving is not set up yet: run task-30b-archive-and-delete-guard.sql in Supabase.' : error.message }, { status: 500 });
  return NextResponse.json({ replication: await rowToReplication(admin, data, 'admin') });
}
