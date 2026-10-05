'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Eye } from 'lucide-react';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { formatDate } from '@/lib/format';

interface Row {
  id: string;
  batch_number: string;
  customer: string;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
}

export default function RepOrdersList({ orders }: { orders: Row[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const statuses = Array.from(new Set(orders.map((o) => o.status)));

  const q = search.trim().toLowerCase();
  const filtered = orders.filter(
    (o) =>
      (!status || o.status === status) &&
      (!q || o.batch_number.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.product_name.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500">Every order you've created. Admin handles production; you can follow along here.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 focus:border-rivix outline-none transition-all w-full sm:w-64"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-rivix/20"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Link href="/rep/orders/new" className="bg-rivix text-white px-5 py-2 rounded-xl font-bold text-sm shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all flex items-center gap-2">
            <Plus size={16} />New order
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              {['Order #', 'Customer', 'Product', 'Created', 'Status', 'Actions'].map((h) => (
                <th key={h} className={`px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-8 py-10 text-center text-sm text-slate-400">
                  {orders.length === 0 ? 'No orders yet. Create one with “New order”.' : 'No orders match your search.'}
                </td>
              </tr>
            )}
            {filtered.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-4 sm:px-8 py-5 font-bold text-slate-700 whitespace-nowrap">{o.batch_number}</td>
                <td className="px-4 sm:px-8 py-5 text-slate-600 font-medium">{o.customer}</td>
                <td className="px-4 sm:px-8 py-5 text-slate-600 font-medium">{o.product_name} <span className="text-slate-400">× {o.quantity}</span></td>
                <td className="px-4 sm:px-8 py-5 text-sm text-slate-500 whitespace-nowrap">{formatDate(o.created_at)}</td>
                <td className="px-4 sm:px-8 py-5"><OrderStatusBadge status={o.status} /></td>
                <td className="px-4 sm:px-8 py-5 text-right">
                  <Link href={`/rep/orders/${o.id}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-rivix hover:text-rivix transition-all whitespace-nowrap"><Eye size={14} />View details</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
