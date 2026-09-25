'use client';

import { 
  Package, 
  FileText, 
  ShieldCheck, 
  ArrowUpRight 
} from 'lucide-react';

import { useEffect, useState } from 'react';
import { getOrders, OrderData } from '@/lib/storage';
import Link from 'next/link';
import { cn } from '@/lib/utils';


export default function ClientPortalHome() {
  const [orders, setOrders] = useState<OrderData[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const stored = await getOrders();
      const mockData: OrderData[] = [
        { id: '1', batch_number: 'RVX-2026-9421', product_name: 'ArcticShield Coverall', quantity: 150, status: 'In Production', material: '88% Cotton / 12% Nylon FR', origin: 'Partner Facility', order_date: '2026-04-10', ship_date: '2026-05-02', certs_generated: true },
        { id: '2', batch_number: 'RVX-2026-9422', product_name: 'ArcticShield Parka', quantity: 300, status: 'Shipped', material: '300D Oxford Polyester', origin: 'Partner Facility', order_date: '2026-04-12', ship_date: '2026-05-10', certs_generated: true },
      ];


      // Filter stored orders to only show those for "Pacific Mining Co." (simulated client filtering)
      const clientOrders = stored.filter(o => o.client_name === 'Pacific Mining Co.');
      setOrders([...clientOrders, ...mockData]);
    };
    loadData();
  }, []);


  const stats = [
    { label: 'Total Orders', value: orders.length.toString(), icon: FileText, color: 'text-rivix' },
    { label: 'Compliance Certificates', value: (orders.length * 3).toString(), icon: ShieldCheck, color: 'text-emerald-600' },
  ];


  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="bg-gradient-to-r from-rivix to-rivix-dark rounded-2xl lg:rounded-3xl p-6 lg:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-start gap-3 lg:gap-4">
          <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
            Client Portal
          </div>
          <h1 className="text-2xl lg:text-4xl font-bold tracking-tight">Welcome back, Pacific Mining Co.</h1>
          <p className="text-white/80 max-w-lg mb-2 lg:mb-4 text-sm lg:text-base">Your compliance documentation and order history are up to date. You have {orders.length} active records in the system.</p>
          <Link href="/portal/orders" className="bg-white text-rivix px-6 py-3 rounded-xl font-bold text-sm hover:bg-white/90 active:scale-95 transition-all shadow-lg flex items-center gap-2">
            View All Orders
            <ArrowUpRight size={18} />
          </Link>
        </div>
        
        {/* Abstract background shapes */}
        <div className="absolute -right-20 -bottom-20 w-40 h-40 lg:w-80 lg:h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute right-20 top-0 w-20 h-20 lg:w-40 lg:h-40 bg-white/20 rounded-full blur-2xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 lg:p-8 rounded-2xl shadow-sm border border-slate-100 group hover:border-rivix/20 transition-all">
            <div className={`p-3 lg:p-4 rounded-xl inline-block mb-4 lg:mb-6 bg-slate-50 group-hover:bg-rivix/5 transition-colors`}>
              <stat.icon className={cn(stat.color, "w-6 h-6 lg:w-7 lg:h-7")} />

            </div>
            <p className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-2xl lg:text-3xl font-extrabold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>


      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Recent Orders</h3>
          <button className="text-sm font-bold text-rivix hover:text-rivix-dark transition-colors">View History</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Order #</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Product</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Quantity</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6 font-bold text-slate-700 whitespace-nowrap">{order.batch_number}</td>
                  <td className="px-8 py-6 text-slate-600 font-medium min-w-[200px]">{order.product_name}</td>
                  <td className="px-8 py-6 text-slate-600 font-medium whitespace-nowrap">{order.quantity} units</td>
                  <td className="px-8 py-6 text-right">
                    <Link href={`/portal/orders/${order.id}`} className="text-xs font-bold text-slate-400 group-hover:text-rivix transition-colors whitespace-nowrap">Details →</Link>
                  </td>
                </tr>

              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

