'use client';

import Link from 'next/link';
import { Users, FileText, Inbox, FolderOpen, TrendingUp, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ORDER_STAGES } from '@/lib/order-stages';
import { formatDateTime, localDateKey, activeTimeZone } from '@/lib/format';

type Period = 'day' | 'week' | 'month' | 'year';

type Dashboard = {
  orderDates: string[];
  clients: number;
  documents: number;
  byStage: Record<string, number>;
  recent: { id: string; status: string | null; note: string | null; internal: boolean; created_at: string; batch_number: string; customer: string }[];
  hiring: { screening: number; interviewing: number; offer: number; archived: number; tier1: number; tier1Waiting: number } | null;
};

type Bucket = { start: string; count: number };

// Group order timestamps into day/week/month/year buckets by calendar day in the viewer's
// time zone (see activeTimeZone), oldest first, empty periods included. Bucket starts are plain
// "YYYY-MM-DD" keys, so the comparison is simple string order and daylight-saving safe.
function buildSeries(dates: string[]): Record<Period, Bucket[]> {
  const [ty, tm, td] = localDateKey().split('-').map(Number);
  const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const todayMs = Date.UTC(ty, tm - 1, td);
  const mondayMs = todayMs - ((new Date(todayMs).getUTCDay() + 6) % 7) * 86400000;
  const starts: Record<Period, string[]> = {
    day: Array.from({ length: 14 }, (_, i) => key(todayMs - (13 - i) * 86400000)),
    week: Array.from({ length: 8 }, (_, i) => key(mondayMs - (7 - i) * 7 * 86400000)),
    month: Array.from({ length: 12 }, (_, i) => key(Date.UTC(ty, tm - 1 - (11 - i), 1))),
    year: Array.from({ length: 5 }, (_, i) => key(Date.UTC(ty - (4 - i), 0, 1))),
  };
  const dayKeys = dates.map((iso) => localDateKey(iso)).filter(Boolean);
  const out = {} as Record<Period, Bucket[]>;
  (Object.keys(starts) as Period[]).forEach((k) => {
    const list = starts[k];
    const buckets = list.map((start) => ({ start, count: 0 }));
    dayKeys.forEach((dk) => {
      if (dk < list[0]) return;
      let idx = list.length - 1;
      while (idx > 0 && list[idx] > dk) idx--;
      buckets[idx].count += 1;
    });
    out[k] = buckets;
  });
  return out;
}

const PERIODS: { key: Period; label: string; span: string }[] = [
  { key: 'day', label: 'Day', span: 'Last 14 days' },
  { key: 'week', label: 'Week', span: 'Last 8 weeks' },
  { key: 'month', label: 'Month', span: 'Last 12 months' },
  { key: 'year', label: 'Year', span: 'Last 5 years' },
];

const fmtBucket = (start: string, period: Period, long = false) => {
  const d = new Date(start + 'T00:00:00Z');
  const o = (opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-CA', { ...opts, timeZone: 'UTC' });
  if (period === 'year') return o({ year: 'numeric' });
  if (period === 'month') return long ? o({ month: 'long', year: 'numeric' }) : o({ month: 'short' });
  return o({ month: 'short', day: 'numeric' });
};

// Orders created per day/week/month/year. Plain SVG: one series, so no legend; hover shows the exact value.
function OrdersChart({ series, period }: { series: Record<Period, Bucket[]>; period: Period }) {
  const [hover, setHover] = useState<number | null>(null);
  const items = series[period];
  // The chart is drawn at the real width of its card with a fixed, compact height, so it stays easy to read on wide screens.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setW(Math.max(280, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 210, L = 32, R = 8, T = 12, B = 26;
  const max = Math.max(4, ...items.map((w) => w.count));
  const top = Math.ceil(max / 4) * 4;
  const ticks = [0, top / 4, top / 2, (top * 3) / 4, top];
  const slot = (W - L - R) / items.length;
  const barW = Math.min(28, slot * 0.6);
  const y = (n: number) => T + (H - T - B) * (1 - n / top);
  const total = items.reduce((n, w) => n + w.count, 0);
  // One label per bar when they fit (about 44px each); otherwise every 2nd, 3rd... so they never overlap.
  const every = Math.max(1, Math.ceil(44 / slot));
  const unit = { day: 'on', week: 'week of', month: 'in', year: 'in' }[period];
  const cx = hover === null ? 0 : (L + slot * hover + slot / 2) / W;

  return (
    <div className="relative" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block" role="img" aria-label={`Orders created per ${period}, ${total} in total`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-slate-100" strokeWidth={1} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" className="fill-slate-400" fontSize={10}>{t}</text>
          </g>
        ))}
        {items.map((w, i) => {
          const x = L + slot * i + (slot - barW) / 2;
          const h = Math.max(0, y(0) - y(w.count));
          return (
            <g key={w.start} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill="transparent" />
              {w.count > 0 && (
                <>
                  <rect x={x} y={y(w.count)} width={barW} height={h} rx={4} className={hover === i ? 'fill-rivix' : 'fill-rivix/80'} />
                  <text x={L + slot * i + slot / 2} y={y(w.count) - 4} textAnchor="middle" className="fill-slate-600" fontSize={10} fontWeight={700}>{w.count}</text>
                </>
              )}
              {i % every === (items.length - 1) % every && (
                <text x={L + slot * i + slot / 2} y={H - 8} textAnchor="middle" className="fill-slate-400" fontSize={10}>{fmtBucket(w.start, period)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {total === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
          <span className="inline-block bg-white/90 text-slate-400 text-xs font-semibold px-4 py-2 rounded-full border border-slate-100">No orders in this period</span>
        </div>
      )}
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-y-full bg-slate-900 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap"
          style={{
            left: `${cx * 100}%`,
            top: `${(y(items[hover].count) / H) * 100}%`,
            transform: `translate(${cx > 0.8 ? '-100%' : cx < 0.2 ? '0' : '-50%'}, -100%)`,
          }}
        >
          <span className="font-bold">{items[hover].count}</span> order{items[hover].count === 1 ? '' : 's'} · {unit} {fmtBucket(items[hover].start, period, true)}
        </div>
      )}
      <table className="sr-only">
        <caption>Orders created per {period}</caption>
        <thead><tr><th>Period starting</th><th>Orders</th></tr></thead>
        <tbody>{items.map((w) => (<tr key={w.start}><td>{w.start}</td><td>{w.count}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('week');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      if (!res.ok) setError(json.error || 'Could not load the dashboard.');
      else setData(json);
    })();
  }, []);

  const series = useMemo(() => buildSeries(data?.orderDates || []), [data]);
  const by = data?.byStage || {};
  const activeOrders = ORDER_STAGES.filter((s) => s !== 'Delivered' && s !== 'Cancelled').reduce((n, s) => n + (by[s] || 0), 0);
  const maxStage = Math.max(1, ...ORDER_STAGES.map((s) => by[s] || 0));
  const show = (n: number | undefined) => (data ? String(n ?? 0) : '…');

  const stats = [
    { label: 'Total Clients', value: show(data?.clients), icon: Users, color: 'text-rivix', bg: 'bg-rivix/10' },
    { label: 'Active Orders', value: show(activeOrders), icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'New Orders', value: show(by['Order Received']), icon: Inbox, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Documents Uploaded', value: show(data?.documents), icon: FolderOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    // Hiring: one small card. It turns red and says so when strong (Tier 1) candidates are still waiting in Screen.
    ...(data?.hiring
      ? [{
          label: 'Sales Hiring',
          value: `${data.hiring.screening + data.hiring.interviewing + data.hiring.offer} active`,
          sub: data.hiring.tier1Waiting > 0
            ? `${data.hiring.tier1Waiting} Tier 1 waiting in Screen`
            : data.hiring.offer > 0 ? `${data.hiring.offer} at Offer` : 'Nobody waiting',
          alert: data.hiring.tier1Waiting > 0,
          href: '/admin/hiring',
          icon: UserCheck, color: 'text-indigo-600', bg: 'bg-indigo-50',
        }]
      : []),
    { label: 'Revenue (MTD)', value: 'Coming soon', sub: 'Needs QuickBooks', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500">Welcome back. Here's what's happening across RIVIX orders today.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-[1700px]:grid-cols-6 gap-4 lg:gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const href = 'href' in stat ? (stat.href as string) : null;
          const alert = 'alert' in stat && stat.alert === true;
          const box = `bg-white p-5 rounded-2xl shadow-sm border flex items-center gap-4 min-w-0 group transition-all ${alert ? 'border-rivix/40' : 'border-slate-100 hover:border-rivix/20'}`;
          const inner = (
            <>
              <div className={`${stat.bg} ${stat.color} p-3 rounded-xl transition-colors`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{stat.label}</p>
                <p className="text-lg font-black text-slate-900 whitespace-nowrap">{stat.value}</p>
                {stat.sub && <p className={`text-[10px] truncate ${alert ? 'font-bold text-rivix' : 'text-slate-400'}`} title={stat.sub}>{stat.sub}</p>}
              </div>
            </>
          );
          return href ? (
            <Link key={stat.label} href={href} className={`${box} hover:shadow-md`} title="Open the Sales Hiring page">{inner}</Link>
          ) : (
            <div key={stat.label} className={box}>{inner}</div>
          );
        })}
      </div>

      {/* Row 1: chart on the left, orders by stage on the right. Recent activity goes below. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 xl:col-span-2 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-900">Orders created</h3>
            <span className="text-xs text-slate-400">{PERIODS.find((p) => p.key === period)?.span}{data ? ` · times in ${activeTimeZone().replace(/_/g, ' ')}` : ''}</span>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Group orders by">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                aria-pressed={period === p.key}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${period === p.key ? 'bg-white text-rivix shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {data ? <OrdersChart series={series} period={period} /> : <p className="text-sm text-slate-400 italic">Loading…</p>}
      </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-w-0">
          <h3 className="font-bold text-slate-900 mb-6">Orders by stage</h3>
          <div className="space-y-4">
            {ORDER_STAGES.map((stage) => {
              const n = by[stage] || 0;
              return (
                <div key={stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">{stage}</span>
                    <span className="font-bold text-slate-900">{data ? n : '…'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-rivix" style={{ width: `${(n / maxStage) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Recent Activity</h3>
            <Link href="/admin/orders" className="text-xs font-bold text-rivix hover:underline">View All</Link>
          </div>
          <div className="space-y-6">
            {data && data.recent.length > 0 ? (
              data.recent.map((e) => (
                <div key={e.id} className="flex gap-4 items-start">
                  <div className="w-2 h-2 rounded-full bg-rivix mt-1.5 shadow-[0_0_8px_rgba(218,33,40,0.5)]" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {e.status ? (
                        <>{e.batch_number} ({e.customer}) moved to {e.status}</>
                      ) : (
                        <>{e.batch_number} ({e.customer}) <span className="font-medium text-slate-500">note added</span>{e.internal && <span className="ml-2 align-middle text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Internal</span>}</>
                      )}
                    </p>
                    {!e.status && e.note && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{e.note}</p>}
                    <p className="text-xs text-slate-400">{formatDateTime(e.created_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic">{data ? 'No order activity yet.' : 'Loading…'}</p>
            )}
          </div>
        </div>
    </div>
  );
}
