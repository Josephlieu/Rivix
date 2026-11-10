import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { logRepActivity } from '@/lib/rep-activity';

type ActivityItem = { at: string; kind: 'order' | 'request' | 'replication' | 'team' | 'customer' | 'quote'; label: string; by: string | null; link: string | null };

// One rep with their numbers, customers, recent orders and history, for the Rep Detail page.
// The history comes from one table, rep_activity (see src/lib/rep-activity.ts).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: rep } = await admin.from('reps').select('*').eq('id', id).maybeSingle();
  if (!rep) return NextResponse.json({ error: 'Rep not found.' }, { status: 404 });

  const [customers, orders, ordersTotal, ordersDone, ordersInProgress, requestsTotal] = await Promise.all([
    admin
      .from('customers')
      .select('id, customer_code, company_name, contact_email, created_at')
      .eq('rep_id', id)
      .order('company_name', { ascending: true }),
    admin
      .from('orders')
      .select('id, batch_number, product_name, quantity, status, created_at, customers(company_name)')
      .eq('rep_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('rep_id', id),
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('rep_id', id).eq('status', 'Delivered'),
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('rep_id', id).not('status', 'in', '(Delivered,Cancelled)'),
    admin.from('document_requests').select('id', { count: 'exact', head: true }).eq('rep_id', id),
  ]);
  const failed = [customers, orders, ordersTotal, ordersDone, ordersInProgress, requestsTotal].find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  // The history is read from the rep_activity log only (written when each action happens; the second SQL patch
  // fills in what happened before). If the table is not there yet the page says so.
  const readLog = (cols: string) => admin.from('rep_activity').select(cols).eq('rep_id', id).order('created_at', { ascending: false }).limit(200);
  let log = await readLog('id, kind, summary, customer_id, order_id, link, created_by, created_at, approx');
  if (log.error) log = await readLog('id, kind, summary, customer_id, order_id, created_by, created_at'); // second patch not run yet
  const logRows = ((log.error ? [] : log.data) || []) as any[];
  const activity: ActivityItem[] = logRows.map((l) => ({
    at: l.created_at,
    kind: l.kind === 'quote_created' ? 'quote' : l.kind.startsWith('customer_') ? 'customer' : l.kind.startsWith('order_') || l.kind === 'document' ? 'order'
      : l.kind.startsWith('request_') ? 'request' : l.kind === 'replication' ? 'replication' : 'team',
    label: l.summary,
    by: l.created_by || null,
    link: l.link || (l.order_id ? `/admin/orders/${l.order_id}` : l.customer_id ? `/admin/clients/${l.customer_id}` : null),
  }));

  // When each current customer was assigned: the log's date, or (if the log has none) the date the customer was added.
  const assigned = new Map<string, { at: string; approx: boolean }>();
  for (const l of [...logRows].reverse()) {
    if (l.kind === 'customer_assigned' && l.customer_id) assigned.set(l.customer_id, { at: l.created_at, approx: Boolean(l.approx) });
  }
  const customersOut = (customers.data || []).map((c: any) => {
    const a = assigned.get(c.id);
    return { ...c, assigned_at: a?.at || c.created_at, assigned_exact: a ? !a.approx : false };
  });

  return NextResponse.json({
    rep: { ...rep, has_login: Boolean(rep.user_id), user_id: undefined },
    stats: {
      customers: (customers.data || []).length,
      orders_total: ordersTotal.count ?? 0,
      orders_completed: ordersDone.count ?? 0,
      orders_in_progress: ordersInProgress.count ?? 0,
      requests: requestsTotal.count ?? 0,
    },
    customers: customersOut,
    orders: orders.data || [],
    activity,
    log_ready: !log.error,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  // Only these fields can be changed — anything else in the body is ignored.
  const update: Record<string, unknown> = {};
  for (const key of ['name', 'title', 'email', 'phone', 'territory'] as const) {
    if (key in body) update[key] = String(body[key] ?? '').trim() || null;
  }
  // The email is the rep's sign-in, so once a login exists it can't be changed.
  if ('email' in update) {
    const { data: existing } = await createAdminClient().from('reps').select('email, user_id').eq('id', id).maybeSingle();
    if (existing?.user_id) {
      if (String(update.email).toLowerCase() !== existing.email.toLowerCase()) {
        return NextResponse.json({ error: "This rep's email is their login and can't be changed." }, { status: 400 });
      }
      delete update.email;
    }
  }
  if ('active' in body) update.active = Boolean(body.active);
  if ((update.name === null) || (update.email === null)) {
    return NextResponse.json({ error: 'Name and email cannot be empty.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before } = await admin.from('reps').select('*').eq('id', id).maybeSingle();
  const { data, error } = await admin.from('reps').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // History: a status change gets its own line; other edits list which details changed (names only, not values).
  if (before) {
    if (typeof update.active === 'boolean' && update.active !== before.active) {
      await logRepActivity(admin, { repId: id, kind: 'status', by: who.email, summary: update.active ? 'Set to active' : 'Set to inactive (login blocked, history kept)' });
    }
    const labels: Record<string, string> = { name: 'name', title: 'title', email: 'email', phone: 'phone', territory: 'province / territory' };
    const changed = Object.keys(labels).filter((k) => k in update && (update[k] ?? null) !== (before[k] ?? null)).map((k) => labels[k]);
    if (changed.length) await logRepActivity(admin, { repId: id, kind: 'profile', by: who.email, summary: `Details changed: ${changed.join(', ')}` });
  }

  // A disabled rep must not be able to sign in. Reps don't have logins yet
  // (user_id is empty), so today this does nothing — it starts applying as
  // soon as a rep is linked to a login.
  if ('active' in update && data.user_id) {
    await admin.auth.admin.updateUserById(data.user_id, {
      ban_duration: update.active ? 'none' : '876000h',
    });
  }

  // A rep who joined through an invite link and is switched on here counts as approved (who and when are recorded).
  if (update.active === true) {
    await admin.from('rep_invites').update({ approved_at: new Date().toISOString(), approved_by: who.email })
      .eq('rep_id', id).not('used_at', 'is', null).is('approved_at', null);
  }

  return NextResponse.json({ rep: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: rep } = await admin.from('reps').select('id, name, user_id').eq('id', id).maybeSingle();
  if (!rep) return NextResponse.json({ error: 'Rep not found.' }, { status: 404 });

  // Never delete a rep who still has customers — the customers would silently
  // lose their rep. Reassign them, or disable the rep instead.
  const { count, error: countErr } = await admin
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('rep_id', id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `${rep.name} still has ${count} customer${count === 1 ? '' : 's'}. Reassign them first, or disable the rep instead.`,
      },
      { status: 409 }
    );
  }

  const { error } = await admin.from('reps').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Remove the rep's login too, if they had one, so it isn't left orphaned.
  if (rep.user_id) await admin.auth.admin.deleteUser(rep.user_id);

  return NextResponse.json({ success: true });
}
