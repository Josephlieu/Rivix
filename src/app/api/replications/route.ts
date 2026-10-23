import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase-admin';
import { getReplicationActor, unauthorized, repsByIds, requestLink } from '@/lib/replication-access';
import { replicationToRow, rowToReplication } from '@/lib/replication-server';
import { adminUserIds, notifyUsers } from '@/lib/notify';

const SQL_HINT = 'The replication rep-side tables are missing. Run dev-patch-replication-rep-side.sql in Supabase.';
const dbProblem = (e: { code?: string; message: string }) =>
  e.code === 'PGRST205' || e.code === '42703' || /does not exist|schema cache|rep_id/i.test(e.message);

// Requests, newest first. An admin sees all of them; a sales rep sees only their own.
export async function GET() {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();

  const admin = createAdminClient();
  let q = admin.from('replications').select('*').order('created_at', { ascending: false });
  if (actor.kind === 'rep') q = q.eq('rep_id', actor.repId);
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: dbProblem(error) ? (error.code === 'PGRST205' ? 'The replications table has not been created yet. Run dev-schema-replications.sql in Supabase.' : SQL_HINT) : error.message }, { status: 500 });
  }
  const reps = await repsByIds(admin, (data || []).map(r => r.rep_id));
  return NextResponse.json({ replications: await Promise.all((data || []).map(r => rowToReplication(admin, r, reps))) });
}

// Create a request. A rep's request belongs to that rep; an admin may give it to a rep or keep it ("handled directly").
// Photos are added afterwards, one by one, through /photos.
export async function POST(req: NextRequest) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();

  const body = await req.json().catch(() => null);
  const id = randomUUID();
  const parsed = replicationToRow(body ?? {}, id);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const admin = createAdminClient();
  let repId: string | null = null;
  if (actor.kind === 'rep') repId = actor.repId;
  else if (typeof body?.repId === 'string' && body.repId) {
    const { data: rep } = await admin.from('reps').select('id, active').eq('id', body.repId).maybeSingle();
    if (!rep || !rep.active) return NextResponse.json({ error: 'That sales rep was not found or is disabled.' }, { status: 400 });
    repId = rep.id as string;
  }

  const row = { id, ...parsed.row, images: [], status: 'received', rep_id: repId, created_by_role: actor.kind, created_by_name: actor.name };
  delete (row as Record<string, unknown>).ai_analysis; // a new request starts without an analysis
  let { data, error } = await admin.from('replications').insert(row).select('*').single();
  // Until dev-patch-replication-rep-side.sql has been run, an admin can still create a request nobody owns.
  if (error && dbProblem(error) && actor.kind === 'admin' && !repId) {
    const { rep_id: _r, created_by_role: _c, created_by_name: _n, ...plain } = row; // eslint-disable-line @typescript-eslint/no-unused-vars
    ({ data, error } = await admin.from('replications').insert(plain).select('*').single());
  }
  if (error || !data) return NextResponse.json({ error: error && dbProblem(error) ? SQL_HINT : error?.message || 'Could not create the request.' }, { status: 500 });

  // Tell the other side: admins hear about a rep's request; a rep hears about one an admin made for them.
  const reps = await repsByIds(admin, [repId]);
  const code = (data.request_code as string) || data.id;
  const what = `${data.product_name} (${data.client_name})`;
  if (actor.kind === 'rep') {
    await notifyUsers(admin, await adminUserIds(admin), {
      kind: 'replication_new', title: `New replication request ${code}`, body: `${actor.name} created ${what}.`, link: requestLink('admin', code),
    });
  } else if (repId) {
    await notifyUsers(admin, [reps.get(repId)?.userId], {
      kind: 'replication_new', title: `Replication request ${code} assigned to you`, body: what, link: requestLink('rep', code),
    });
  }
  return NextResponse.json({ replication: await rowToReplication(admin, data, reps) });
}
