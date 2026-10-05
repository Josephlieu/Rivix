'use client';

import Link from 'next/link';
import { Users, FileText, Inbox, FolderOpen, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ORDER_STAGES } from '@/lib/order-stages';
import { formatDateTime } from '@/lib/format';

type Dashboard = {
  weekly: { start: string; count: number }[];
  clients: number;
  documents: number;
  byStage: Record<string, number>;
  recent: { id: string; status: string; created_at: string; batch_number: string; customer: string }[];
};

// Orders created per week. Plain SVG: one series, so no legend; hover shows the exact value.
function WeeklyOrdersChart({ weekly }: { weekly: Dashboard['weekly'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 220, L = 32, R = 8, T = 16, B = 28;
  const max = Math.max(4, ...weekly.map((w) => w.count));
  const top = Math.ceil(max / 4) * 4;
  const ticks = [0, top / 4, top / 2, (top * 3) / 4, top];
  const slot = (W - L - R) / weekly.length;
  const barW = Math.min(28, slot * 0.6);
  const y = (n: number) => T + (H - T - B) * (1 - n / top);
  const label = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const total = weekly.reduce((n, w) => n + w.count, 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Orders created per week, last ${weekly.length} weeks, ${total} in total`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-slate-100" strokeWidth={1} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" className="fill-slate-400" fontSize={10}>{t}</text>
          </g>
        ))}
        {weekly.map((w, i) => {
          const x = L + slot * i + (slot - barW) / 2;
          const h = Math.max(0, y(0) - y(w.count));
          return (
            <g key={w.start} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill="transparent" />
              {w.count > 0 && (
                <rect x={x} y={y(w.count)} width={barW} height={h} rx={4} className={hover === i ? 'fill-rivix' : 'fill-rivix/80'} />
              )}
              <text x={L + slot * i + slot / 2} y={H - 8} textAnchor="middle" className="fill-slate-400" fontSize={10}>{label(w.start)}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap"
          style={{ left: `${((L + slot * hover + slot / 2) / W) * 100}%`, top: `${(y(weekly[hover].count) / H) * 100}%` }}
        >
          <span className="font-bold">{weekly[hover].count}</span> order{weekly[hover].count === 1 ? '' : 's'} · week of {label(weekly[hover].start)}
        </div>
      )}
      <table className="sr-only">
        <caption>Orders created per week</caption>
        <thead><tr><th>Week starting</th><th>Orders</th></tr></thead>
        <tbody>{weekly.map((w) => (<tr key={w.start}><td>{w.start}</td><td>{w.count}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      if (!res.ok) setError(json.error || 'Could not load the dashboard.');
      else setData(json);
    })();
  }, []);

  const by = data?.byStage || {};
  const activeOrders = ORDER_STAGES.filter((s) => s !== 'Delivered' && s !== 'Cancelled').reduce((n, s) => n + (by[s] || 0), 0);
  const maxStage = Math.max(1, ...ORDER_STAGES.map((s) => by[s] || 0));
  const show = (n: number | undefined) => (data ? String(n ?? 0) : '…');

  const stats = [
    { label: 'Total Clients', value: show(data?.clients), icon: Users, color: 'text-rivix', bg: 'bg-rivix/10' },
    { label: 'Active Orders', value: show(activeOrders), icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'New Orders', value: show(by['Order Received']), icon: Inbox, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Documents Uploaded', value: show(data?.documents), icon: FolderOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Revenue (MTD)', value: 'Coming soon', sub: 'Needs QuickBooks', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500">Welcome back. Here's what's happening across RIVIX orders today.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:border-rivix/20 transition-all">
              <div className={`${stat.bg} ${stat.color} p-3 rounded-xl transition-colors`}>
                <Icon size={22} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-lg font-black text-slate-900">{stat.value}</p>
                {stat.sub && <p className="text-[10px] text-slate-400">{stat.sub}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-bold text-slate-900">Orders per week</h3>
          <span className="text-xs text-slate-400">Last 8 weeks</span>
        </div>
        {data ? <WeeklyOrdersChart weekly={data.weekly} /> : <p className="text-sm text-slate-400 italic">Loading…</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
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
                      {e.batch_number} ({e.customer}) moved to {e.status}
                    </p>
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
    </div>
  );
}
