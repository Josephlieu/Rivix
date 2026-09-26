'use client';

import { useState, useEffect, useRef } from 'react';
import { getMyOrders, OrderData } from '@/lib/storage';
import { Package, Search, Filter, ArrowUpRight, CheckCircle2, Clock, Check } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const myOrders = await getMyOrders();
      setOrders(myOrders);
    };
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const statuses = Array.from(new Set(orders.map((o) => o.status).filter(Boolean)));

  const filteredOrders = orders.filter(o =>
    (o.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.product_name.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!statusFilter || o.status === statusFilter)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order History</h1>
          <p className="text-slate-500">Access your compliance certificates and product history.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 focus:border-rivix outline-none transition-all w-64"
            />
          </div>
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={cn(
                "p-2 bg-white border rounded-xl transition-colors",
                statusFilter ? "border-rivix text-rivix" : "border-slate-200 text-slate-500 hover:text-rivix"
              )}
            >
              <Filter size={18} />
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20">
                <button
                  onClick={() => { setStatusFilter(null); setFilterOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-rivix transition-colors"
                >
                  All statuses
                  {!statusFilter && <Check size={14} />}
                </button>
                {statuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => { setStatusFilter(status); setFilterOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-rivix transition-colors"
                  >
                    {status}
                    {statusFilter === status && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Order Info</th>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Product Specification</th>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Quantity</th>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={4} className="px-8 py-10 text-center text-sm text-slate-400">
                  {orders.length === 0 ? 'No orders yet.' : 'No orders match your search or filter.'}
                </td>
              </tr>
            )}
            {filteredOrders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6 whitespace-nowrap">
                  <p className="font-bold text-slate-900 mb-0.5">{order.batch_number}</p>
                </td>

                <td className="px-8 py-6">
                  <p className="text-sm font-semibold text-slate-700">{order.product_name}</p>
                  {order.material && <p className="text-xs text-slate-400">{order.material}</p>}
                </td>
                <td className="px-8 py-6 text-sm font-bold text-slate-600">{order.quantity} Units</td>
                <td className="px-8 py-6 text-right">

                  <Link 
                    href={`/portal/orders/${order.batch_number}`}
                    className="inline-flex items-center gap-1 px-4 py-2 bg-slate-50 group-hover:bg-rivix text-xs font-bold text-slate-400 group-hover:text-white rounded-lg transition-all"
                  >
                    Details
                    <ArrowUpRight size={14} />
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
