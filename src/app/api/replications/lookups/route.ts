import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getReplicationActor, unauthorized } from '@/lib/replication-access';

// Suggestions for the new-request form. Customers are only a typed name on a request (never a link), so the
// list is just company names to pick from. An admin also gets the active sales reps to give a request to.
export async function GET() {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  const admin = createAdminClient();

  let q = admin.from('customers').select('company_name').order('company_name', { ascending: true }).limit(500);
  if (actor.kind === 'rep') q = q.eq('rep_id', actor.repId); // a rep only sees the names of their own customers
  const { data: customers } = await q;

  let reps: Array<{ id: string; name: string }> = [];
  if (actor.kind === 'admin') {
    const { data } = await admin.from('reps').select('id, name').eq('active', true).order('name', { ascending: true });
    reps = (data || []).map(r => ({ id: r.id as string, name: r.name as string }));
  }
  return NextResponse.json({
    role: actor.kind,
    repName: actor.kind === 'rep' ? actor.name : null,
    customers: Array.from(new Set((customers || []).map(c => c.company_name as string).filter(Boolean))),
    reps,
  });
}
