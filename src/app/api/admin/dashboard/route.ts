import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';

// Real numbers for the admin dashboard. All counts come straight from the database.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const db = createAdminClient();
  const [customers, documents, orders, events] = await Promise.all([
    db.from('customers').select('id', { count: 'exact', head: true }),
    db.from('documents').select('id', { count: 'exact', head: true }),
    db.from('orders').select('status, created_at'),
    db
      .from('order_events')
      .select('id, status, created_at, orders(batch_number, customers(company_name))')
      .not('status', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const failed = [customers, documents, orders, events].find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const byStage: Record<string, number> = {};
  (orders.data || []).forEach((o: any) => { byStage[o.status] = (byStage[o.status] || 0) + 1; });

  // Orders created per day / week / month / year (UTC), oldest first, empty periods included.
  // The page switches between these without another request.
  const DAY = 86400000;
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  const todayMs = Date.UTC(y, m, d);
  const mondayMs = todayMs - ((now.getUTCDay() + 6) % 7) * DAY;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const starts = {
    day: Array.from({ length: 14 }, (_, i) => todayMs - (13 - i) * DAY),
    week: Array.from({ length: 8 }, (_, i) => mondayMs - (7 - i) * 7 * DAY),
    month: Array.from({ length: 12 }, (_, i) => Date.UTC(y, m - (11 - i), 1)),
    year: Array.from({ length: 5 }, (_, i) => Date.UTC(y - (4 - i), 0, 1)),
  };
  const series = Object.fromEntries(
    Object.entries(starts).map(([k, list]) => [k, list.map((ms) => ({ start: iso(ms), count: 0 }))])
  ) as Record<keyof typeof starts, { start: string; count: number }[]>;

  (orders.data || []).forEach((o: any) => {
    const t = Date.parse(o.created_at);
    if (isNaN(t)) return;
    (Object.keys(starts) as (keyof typeof starts)[]).forEach((k) => {
      const list = starts[k];
      if (t < list[0]) return;
      let idx = list.length - 1;
      while (idx > 0 && list[idx] > t) idx--;
      series[k][idx].count += 1;
    });
  });

  return NextResponse.json({
    series,
    clients: customers.count ?? 0,
    documents: documents.count ?? 0,
    byStage,
    recent: (events.data || []).map((e: any) => ({
      id: e.id,
      status: e.status,
      created_at: e.created_at,
      batch_number: e.orders?.batch_number ?? '',
      customer: e.orders?.customers?.company_name ?? '',
    })),
  });
}
