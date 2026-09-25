'use client';

import { 
  Users, 
  FileText, 
  ShieldCheck, 
  TrendingUp 
} from 'lucide-react';

import { useEffect, useState } from 'react';
import { getOrders, OrderData } from '@/lib/storage';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderData[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const data = await getOrders();
      setOrders(data);
    };
    loadData();
  }, []);


  const stats = [
    { label: 'Total Clients', value: new Set(orders.map(o => o.client_name)).size.toString(), icon: Users, color: 'text-rivix', bg: 'bg-rivix/10' },
    { label: 'Active Orders', value: orders.filter(o => o.status !== 'Delivered').length.toString(), icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Certs Generated', value: (orders.length * 3).toString(), icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Revenue (MTD)', value: `$${(orders.length * 1250).toLocaleString()}`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500">Welcome back. Here's what's happening with RIVIX compliance today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
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
              </div>
            </div>
          );
        })}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-96 flex flex-col justify-center items-center text-slate-400 space-y-4">
          <div className="bg-slate-50 p-4 rounded-full">
            <TrendingUp size={32} />
          </div>
          <p className="text-sm font-medium">Order Velocity Chart (Placeholder)</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Recent Activity</h3>
            <button className="text-xs font-bold text-rivix hover:underline">View All</button>
          </div>
          <div className="space-y-6">
            {orders.length > 0 ? (
              orders.slice(-5).reverse().map((order) => (
                <div key={order.id} className="flex gap-4 items-start">
                  <div className="w-2 h-2 rounded-full bg-rivix mt-1.5 shadow-[0_0_8px_rgba(218,33,40,0.5)]" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">New batch created for {order.client_name}</p>
                    <p className="text-xs text-slate-400">Batch #{order.batch_number} • Just now</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic">No recent activity. Import a CSV to get started.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

