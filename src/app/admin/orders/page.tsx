'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, AlertCircle, Eye } from 'lucide-react';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { ORDER_STAGES } from '@/lib/order-stages';

interface Row {
  id: string;
  batch_number: string;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
  customer_id: string | null;
  customer: string;
  customer_code: string;
  rep: string | null;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [rep, setRep] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/orders');
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Could not load orders.');
      else setOrders(data.orders);
      setLoading(false);
    })();
  }, []);

  const reps = useMemo(() => Array.from(new Set(orders.map((o) => o.rep).filter(Boolean))) as string[], [orders]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; });
    return c;
  }, [orders]);

  const q = search.trim().toLowerCase();
  const filtered = orders.filter(
    (o) =>
      (!stage || o.status === stage) &&
      (!rep || o.rep === rep) &&
      (!q ||
        o.batch_number.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.customer_code.toLowerCase().includes(q) ||
        o.product_name.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-slate-500">Orders your reps have entered. Open one to move it through production, add tracking and notes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search orders, clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 focus:border-rivix outline-none transition-all w-full sm:w-64"
            />
          </div>
          <select value={rep} onChange={(e) => setRep(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-rivix/20">
            <option value="">All reps</option>
            {reps.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStage('')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!stage ? 'bg-slate-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-rivix'}`}>
          All <span className="opacity-60">({orders.length})</span>
        </button>
        {ORDER_STAGES.map((s) => (
          <button key={s} onClick={() => setStage(stage === s ? '' : s)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${stage === s ? 'bg-slate-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-rivix'}`}>
            {s} <span className="opacity-60">({counts[s] || 0})</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-left min-w-[820px]">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              {['Order #', 'Customer', 'Rep', 'Product', 'Created', 'Stage', 'Actions'].map((h) => (
                <th key={h} className={`px-4 sm:px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="px-8 py-10 text-center text-slate-400"><Loader2 className="animate-spin inline" size={18} /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-8 py-10 text-center text-sm text-slate-400">{orders.length === 0 ? 'No orders yet. Orders appear here when a rep creates one.' : 'No orders match your filters.'}</td></tr>
            )}
            {filtered.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 sm:px-6 py-5 font-bold text-slate-700 whitespace-nowrap">
                  <Link href={`/admin/orders/${o.id}`} className="hover:text-rivix">{o.batch_number}</Link>
                </td>
                <td className="px-4 sm:px-6 py-5">
                  {o.customer_id ? (
                    <Link href={`/admin/clients/${o.customer_id}`} className="font-semibold text-slate-800 hover:text-rivix">{o.customer}</Link>
                  ) : o.customer}
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{o.customer_code}</p>
                </td>
                <td className="px-4 sm:px-6 py-5 text-sm text-slate-600">{o.rep || <span className="text-slate-300">Unassigned</span>}</td>
                <td className="px-4 sm:px-6 py-5 text-sm text-slate-600">{o.product_name} <span className="text-slate-400">× {o.quantity}</span></td>
                <td className="px-4 sm:px-6 py-5 text-sm text-slate-500 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="px-4 sm:px-6 py-5"><OrderStatusBadge status={o.status} /></td>
                <td className="px-4 sm:px-6 py-5 text-right">
                  <Link href={`/admin/orders/${o.id}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-rivix hover:text-rivix transition-all whitespace-nowrap">
                    <Eye size={14} />Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
