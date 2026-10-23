import { unstable_cache, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase-admin';
import { ORDER_STAGES } from '@/lib/order-stages';
import { computeScore, TIER_1_MIN } from '@/lib/hiring-criteria';
import { getHiringSettingsServer } from '@/lib/hiring-settings-server';

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
  // Stage moves AND notes. status is null for a note; internal notes are marked so the admin can tell.
  recent: { id: string; status: string | null; note: string | null; internal: boolean; created_at: string; batch_number: string; customer: string }[];
  // Candidates by stage and how many are Tier 1; null when the hiring table does not exist yet.
  hiring: { screening: number; interviewing: number; offer: number; archived: number; tier1: number; tier1Waiting: number } | null;
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

  // Hiring snapshot: never lets a missing hiring table break the dashboard.
  const readHiring = async (): Promise<DashboardData['hiring']> => {
    const { data, error } = await db.from('hiring_candidates').select('status, scorecard');
    if (error) return null;
    const settings = await getHiringSettingsServer().catch(() => null);
    const out = { screening: 0, interviewing: 0, offer: 0, archived: 0, tier1: 0, tier1Waiting: 0 };
    for (const c of data || []) {
      if (c.status in out) out[c.status as 'screening' | 'interviewing' | 'offer' | 'archived'] += 1;
      const s = settings ? computeScore(c.scorecard, settings.criteria) : null;
      if (c.status !== 'archived' && s !== null && s >= TIER_1_MIN) out.tier1 += 1;
      if (c.status === 'screening' && s !== null && s >= TIER_1_MIN) out.tier1Waiting += 1; // strong, but nobody has moved them on
    }
    return out;
  };

  const [customers, documents, stages, orderDates, events, hiring] = await Promise.all([
    db.from('customers').select('id', { count: 'exact', head: true }),
    db.from('documents').select('id', { count: 'exact', head: true }),
    stageCounts,
    readOrderDates(),
    db
      .from('order_events')
      .select('id, status, note, customer_visible, created_at, orders(batch_number, customers(company_name))')
      .order('created_at', { ascending: false })
      .limit(8),
    readHiring(),
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
      status: e.status ?? null,
      note: e.note ?? null,
      internal: e.customer_visible === false,
      created_at: e.created_at,
      batch_number: e.orders?.batch_number ?? '',
      customer: e.orders?.customers?.company_name ?? '',
    })),
    hiring,
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
