import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getReplicationActor, unauthorized, notFound, canAccess, repsByIds, requestLink } from '@/lib/replication-access';
import { isValidReplicationId } from '@/lib/replication-server';
import { adminUserIds, notifyUsers } from '@/lib/notify';

const MISSING = 'The replication chat table is missing. Run dev-patch-replication-rep-side.sql in Supabase.';

// The chat on one request: between the sales rep who owns it and the admins. Customers are never part of it.
async function load(id: string) {
  const actor = await getReplicationActor();
  if (!actor) return { error: unauthorized() } as const;
  if (!isValidReplicationId(id)) return { error: NextResponse.json({ error: 'Invalid request id.' }, { status: 400 }) } as const;
  const admin = createAdminClient();
  const { data: row } = await admin.from('replications').select('*').eq('id', id).maybeSingle();
  if (!row || !canAccess(actor, row)) return { error: notFound() } as const;
  return { actor, admin, row } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await load((await params).id);
  if ('error' in ctx) return ctx.error;
  const { data, error } = await ctx.admin
    .from('replication_messages')
    .select('id, sender_role, sender_name, body, created_at')
    .eq('replication_id', ctx.row.id)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: /does not exist|schema cache/i.test(error.message) || error.code === 'PGRST205' ? MISSING : error.message }, { status: 500 });
  return NextResponse.json({ messages: (data || []).map(m => ({ id: m.id, senderRole: m.sender_role, senderName: m.sender_name, message: m.body, timestamp: m.created_at })) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await load((await params).id);
  if ('error' in ctx) return ctx.error;
  const { actor, admin, row } = ctx;

  const body = await req.json().catch(() => null);
  const text = String(body?.message ?? '').trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });

  const { data, error } = await admin
    .from('replication_messages')
    .insert({ replication_id: row.id, sender_user_id: actor.userId, sender_role: actor.kind, sender_name: actor.name, body: text })
    .select('id, sender_role, sender_name, body, created_at')
    .single();
  if (error) return NextResponse.json({ error: /does not exist|schema cache/i.test(error.message) || error.code === 'PGRST205' ? MISSING : error.message }, { status: 500 });

  // The other side gets a notice: an admin's message goes to the owning rep; a rep's message goes to every admin.
  const code = (row.request_code as string) || row.id;
  const what = `${row.product_name} (${row.client_name})`;
  const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;
  if (actor.kind === 'admin') {
    const reps = await repsByIds(admin, [row.rep_id]);
    await notifyUsers(admin, [row.rep_id ? reps.get(row.rep_id as string)?.userId : null], {
      kind: 'replication_message', title: `Admin replied on ${code}`, body: `${what}: ${preview}`, link: requestLink('rep', code, 'chat'),
    });
  } else {
    await notifyUsers(admin, await adminUserIds(admin), {
      kind: 'replication_message', title: `${actor.name} wrote on ${code}`, body: `${what}: ${preview}`, link: requestLink('admin', code, 'chat'),
    });
  }
  return NextResponse.json({ message: { id: data.id, senderRole: data.sender_role, senderName: data.sender_name, message: data.body, timestamp: data.created_at } });
}
