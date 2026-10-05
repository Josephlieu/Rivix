'use client';

import Link from 'next/link';
import { Users, FileText, Inbox, FolderOpen, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ORDER_STAGES } from '@/lib/order-stages';
import { formatDateTime } from '@/lib/format';

type Dashboard = {
  clients: number;
  documents: number;
  byStage: Record<string, number>;
  recent: { id: string; status: string; created_at: string; batch_number: string; customer: string }[];
};

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
