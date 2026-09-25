'use client';

import { FileText, ShieldAlert, Loader2, FileDown, CheckCircle2, Search, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getOrders, OrderData } from '@/lib/storage';

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const stored = await getOrders();
      const mockOrders: OrderData[] = [
        { id: '1', batch_number: 'AS-24-1001', client_name: 'Pacific Mining Co', product_name: 'ArcticShield Coverall', quantity: 150, status: 'In Production', certs_generated: false },
        { id: '2', batch_number: 'AS-24-1002', client_name: 'Nexus Drilling', product_name: 'ArcticShield Parka', quantity: 300, status: 'Shipped', certs_generated: true },
        { id: '3', batch_number: 'RVX-24-1003', client_name: 'Coastal Construction', product_name: 'Hi-Vis Standard Vest', quantity: 500, status: 'Delivered', certs_generated: true },
      ];
      setOrders([...stored, ...mockOrders]);
    };
    loadData();
  }, []);


  const handleGenerate = (orderId: string) => {
    setGenerating(orderId);
    setTimeout(() => {
      setGenerating(null);
    }, 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-slate-500">Manage order records and trigger certification workflows.</p>
        </div>
        <button className="bg-rivix text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all flex items-center gap-2">
          <Plus size={18} />
          Manual Order Entry
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search orders, clients, or products..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 focus:border-rivix outline-none transition-all w-96"
            />
          </div>
        </div>

        <table className="w-full text-left">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Order Info</th>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Client</th>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Product Specification</th>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-slate-50/30 transition-colors group">
                <td className="px-8 py-6 font-bold text-slate-900">{order.batch_number}</td>
                <td className="px-8 py-6 text-sm font-semibold text-slate-600">{order.client_name}</td>
                <td className="px-8 py-6">
                  <p className="text-sm font-medium text-slate-500">{order.product_name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{order.quantity} Units</p>
                </td>
                <td className="px-8 py-6 text-right">

                  {!order.certs_generated ? (
                    <button 
                      onClick={() => handleGenerate(order.id)}
                      disabled={generating === order.id}
                      className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-[10px] hover:bg-rivix transition-all flex items-center justify-center gap-2 ml-auto w-36 shadow-sm shadow-slate-900/10"
                    >
                      {generating === order.id ? (
                        <><Loader2 size={12} className="animate-spin" /> Working...</>
                      ) : (
                        <><FileText size={12} /> Generate Certs</>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-4 justify-end">
                      <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase tracking-tighter">
                        <CheckCircle2 size={12} /> Live in Portal
                      </span>
                      <button className="text-slate-400 hover:text-rivix font-bold text-xs transition-colors flex items-center gap-1">
                        <FileDown size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
