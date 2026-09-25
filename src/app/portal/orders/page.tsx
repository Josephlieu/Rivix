'use client';

import { useState, useEffect } from 'react';
import { getOrders, OrderData } from '@/lib/storage';
import { Package, Search, Filter, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const stored = await getOrders();
      const mockData: OrderData[] = [
        { id: '1', batch_number: 'RVX-2026-9421', product_name: 'ArcticShield Coverall', quantity: 150, status: 'In Production', client_name: 'Pacific Mining Co.' },
        { id: '2', batch_number: 'RVX-2026-9422', product_name: 'ArcticShield Parka', quantity: 300, status: 'Shipped', client_name: 'Pacific Mining Co.' },
        { id: '3', batch_number: 'RVX-2026-8814', product_name: 'Hi-Vis Standard Vest', quantity: 500, status: 'Delivered', client_name: 'Pacific Mining Co.' },
      ];


      const clientOrders = stored.filter(o => o.client_name === 'Pacific Mining Co.');
      setOrders([...clientOrders, ...mockData]);
    };
    loadData();
  }, []);


  const filteredOrders = orders.filter(o => 
    o.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.product_name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-rivix transition-colors">
            <Filter size={18} />
          </button>
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
            {filteredOrders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6 whitespace-nowrap">
                  <p className="font-bold text-slate-900 mb-0.5">{order.batch_number}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Ref: AS-2024-MIN-V1</p>
                </td>

                <td className="px-8 py-6">
                  <p className="text-sm font-semibold text-slate-700">{order.product_name}</p>
                  <p className="text-xs text-slate-400">Heavy-Duty Arctic Grade</p>
                </td>
                <td className="px-8 py-6 text-sm font-bold text-slate-600">{order.quantity} Units</td>
                <td className="px-8 py-6 text-right">

                  <Link 
                    href={`/portal/orders/${order.id}`} 
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
