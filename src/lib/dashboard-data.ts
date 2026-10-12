import { unstable_cache, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase-admin';
import { ORDER_STAGES } from '@/lib/order-stages';

// The admin dashboard's numbers, saved on the server so opening the dashboard does not hit
// Supabase every time. Two things keep it correct:
//   1. Anything that changes what the dashboard shows (an order created or moved to another stage,
//      a client added/removed/disabled, a document added/removed) calls invalidateDashboard(), so the
//      next visit reads fresh numbers straight away.
//   2. A backup timer (CACHE_SECONDS) refreshes it anyway, in case data was changed outside the app.
// Only database results live in the cache. It holds nothing about who is logged in, and the route
// checks the admin login BEFORE it ever reads from here.
const CACHE_TAG = 'admin-dashboard';
const CACHE_SECONDS = 300;

// Supabase returns at most 1,000 rows per request, so selecting every order would silently
// stop counting once there are more. Counts are asked of the database directly, and the chart's
// dates are read in pages of this size until there are no more.
const PAGE_SIZE = 1000;

// The chart's widest view is the last 5 calendar years (see buildSeries on the dashboard page).
// Start 2 days before 1 January of the oldest year so every time zone's "first day" is covered.
const chartCutoff = () => new Date(Date.UTC(new Date().getUTCFullYear() - 4, 0, 1) - 2 * 86400000).toISOString();

export type DashboardData = {
  orderDates: string[];
  clients: number;
  documents: number;
  byStage: Record<string, number>;
  recent: { id: string; status: string; created_at: string; batch_number: string; customer: string }[];
};

async function readDashboard(): Promise<DashboardData> {
  const db = createAdminClient();

  // Orders per stage: one exact count per stage, no rows transferred, no row limit.
  const stageCounts = Promise.all(
    ORDER_STAGES.map((stage) => db.from('orders').select('id', { count: 'exact', head: true }).eq('status', stage))
  );

  // Order timestamps for the chart: only created_at, newest window only, paged.
  const readOrderDates = async () => {
    const dates: string[] = [];
    const cutoff = chartCutoff();
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from('orders')
        .select('created_at')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }) // stable order so pages never overlap or skip
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { dates, error };
      (data || []).forEach((o: { created_at: string }) => dates.push(o.created_at));
      if (!data || data.length < PAGE_SIZE) return { dates, error: null };
    }
  };

  const [customers, documents, stages, orderDates, events] = await Promise.all([
    db.from('customers').select('id', { count: 'exact', head: true }),
    db.from('documents').select('id', { count: 'exact', head: true }),
    stageCounts,
    readOrderDates(),
    db
      .from('order_events')
      .select('id, status, created_at, orders(batch_number, customers(company_name))')
      .not('status', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  // Throwing means nothing is saved: an error is never cached, the next visit simply tries again.
  const failed = [customers, documents, ...stages, orderDates, events].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const byStage: Record<string, number> = {};
  ORDER_STAGES.forEach((stage, i) => { byStage[stage] = stages[i].count ?? 0; });

  return {
    // Raw order timestamps: the page groups them by the viewer's own time zone.
    orderDates: orderDates.dates,
    clients: customers.count ?? 0,
    documents: documents.count ?? 0,
    byStage,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recent: (events.data || []).map((e: any) => ({
      id: e.id,
      status: e.status,
      created_at: e.created_at,
      batch_number: e.orders?.batch_number ?? '',
      customer: e.orders?.customers?.company_name ?? '',
    })),
  };
}

export const getDashboardData = unstable_cache(readDashboard, ['admin-dashboard-v1'], {
  tags: [CACHE_TAG],
  revalidate: CACHE_SECONDS,
});

/** Call after anything that changes what the dashboard shows, so the next visit reads fresh numbers. */
export function invalidateDashboard() {
  // { expire: 0 }: never serve the old copy, the next dashboard visit reads the database again.
  revalidateTag(CACHE_TAG, { expire: 0 });
}
