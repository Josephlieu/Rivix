import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { AUDIT_ACTIONS, isAuditAction } from '@/lib/audit';

// Audit log (2026-11-21): read-only, two-step admins only. Customers and reps have no rights on the table at all; this route
// reads it with the server's key. Newest first, 50 per page. Filters (all optional):
//   user   = a user id (exact) or part of an email
//   action = one of AUDIT_ACTIONS
//   table  = the record's table (exact), record = the record's id (exact)
//   from, to = ISO date-times (the page sends the start and end of the chosen local days)
//   page   = 0, 1, 2 ...
const PAGE = 50;
const COLUMNS = 'id, at, actor_user_id, actor_role, actor_email, action, record_table, record_id, before, after, route, note';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isTime = (v: string) => v.length <= 40 && !Number.isNaN(Date.parse(v));

export async function GET(req: NextRequest) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const q = req.nextUrl.searchParams;
  const user = (q.get('user') || '').trim().slice(0, 254);
  const action = q.get('action') || '';
  const table = (q.get('table') || '').trim().slice(0, 80);
  const record = (q.get('record') || '').trim().slice(0, 200);
  const from = q.get('from') || '', to = q.get('to') || '';
  const page = Math.max(0, Math.min(10_000, Math.floor(Number(q.get('page')) || 0)));
  if (action && !isAuditAction(action)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  if ((from && !isTime(from)) || (to && !isTime(to))) return NextResponse.json({ error: 'Use real dates.' }, { status: 400 });

  let s = createAdminClient().from('audit_log').select(COLUMNS, { count: 'exact' });
  if (user) s = UUID.test(user) ? s.eq('actor_user_id', user) : s.ilike('actor_email', `%${user.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (action) s = s.eq('action', action);
  if (table) s = s.eq('record_table', table);
  if (record) s = s.eq('record_id', record);
  if (from) s = s.gte('at', new Date(from).toISOString());
  if (to) s = s.lte('at', new Date(to).toISOString());
  const { data, error, count } = await s.order('at', { ascending: false }).order('id', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (error) {
    const missing = /does not exist|schema cache/i.test(error.message);
    return NextResponse.json({ error: missing ? 'The audit log is not set up on this database yet.' : 'Could not read the audit log.' }, { status: missing ? 503 : 500 });
  }
  return NextResponse.json({
    rows: data || [], total: count ?? 0, page, pageSize: PAGE,
    actions: Object.entries(AUDIT_ACTIONS).map(([key, label]) => ({ key, label })),
  });
}
