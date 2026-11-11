// Server only (task 30): every revision and customer-approval route starts here. Tech files are admin only (task 33): reps,
// customers and signed-out callers get nothing. Admins must have finished two-step sign-in (getReplicationActor checks it).
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase-admin';
import { getReplicationActor, unauthorized, notFound } from '@/lib/replication-access';
import { isValidReplicationId } from '@/lib/replication-server';

type Actor = { kind: 'admin'; userId: string; email: string; name: string };
export async function adminTechFile(id: string): Promise<{ admin: SupabaseClient; actor: Actor; row: Record<string, any> } | NextResponse> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  if (actor.kind !== 'admin') return NextResponse.json({ error: 'Tech files are for RIVIX admin only.' }, { status: 403 });
  if (!isValidReplicationId(id)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
  const admin = createAdminClient();
  const { data: row } = await admin.from('replications').select('*').eq('id', id).maybeSingle();
  if (!row) return notFound();
  return { admin, actor, row };
}
export const seqParam = (v: string) => (/^\d{1,6}$/.test(v) ? Number(v) : null);
