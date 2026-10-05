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

  // Orders created per week for the last 8 weeks (weeks start Monday, UTC), oldest first.
  const WEEKS = 8;
  const DAY = 86400000;
  const today = new Date();
  const thisMonday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - ((today.getUTCDay() + 6) % 7) * DAY;
  const weekly = Array.from({ length: WEEKS }, (_, i) => {
    const start = thisMonday - (WEEKS - 1 - i) * 7 * DAY;
    return { start: new Date(start).toISOString().slice(0, 10), count: 0 };
  });
  const firstStart = Date.parse(weekly[0].start);
  (orders.data || []).forEach((o: any) => {
    const t = Date.parse(o.created_at);
    if (isNaN(t) || t < firstStart) return;
    const idx = Math.min(WEEKS - 1, Math.floor((t - firstStart) / (7 * DAY)));
    weekly[idx].count += 1;
  });

  return NextResponse.json({
    weekly,
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
