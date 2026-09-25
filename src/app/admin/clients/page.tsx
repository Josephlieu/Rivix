'use client';

import { Users, Search, Plus, MoreVertical, ShieldCheck, Mail, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getOrders, OrderData } from '@/lib/storage';

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const orders = await getOrders();
      const uniqueClients = Array.from(new Set(orders.map(o => o.client_name)));
      
      // Default demo clients
      const demoClients = [
        { id: 'test-sol', name: 'Solomon Riby-Williams (Test)', email: 'solgoody@gmail.com', location: 'Calgary, AB', active_batches: 0, status: 'Verified' },
        { id: '1', name: 'Pacific Mining Co.', email: 'ops@pacificmining.com', location: 'Vancouver, BC', active_batches: 2, status: 'Verified' },
        { id: '2', name: 'Nexus Drilling', email: 'procurement@nexus.ca', location: 'Calgary, AB', active_batches: 1, status: 'Verified' },
        { id: '3', name: 'Coastal Construction', email: 'safety@coastal.com', location: 'St. Johns, NL', active_batches: 1, status: 'Pending Audit' },
      ];

      const additionalClients = uniqueClients
        .filter(name => name && !demoClients.find(dc => dc.name === name))
        .map((name, i) => ({
          id: `new-${i}`,
          name: name || 'Unknown Client',
          email: `contact@${(name || 'unknown').toLowerCase().replace(/ /g, '')}.com`,
          location: 'TBD',
          active_batches: orders.filter(o => o.client_name === name).length,
          status: 'Verified'
        }));

      setClients([...demoClients, ...additionalClients]);
    };
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Client Directory</h1>
          <p className="text-slate-500">Manage portal access and compliance profiles for your customers.</p>
        </div>
        <button className="bg-rivix text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all flex items-center gap-2">
          <Plus size={18} />
          Add New Client
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search clients..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 focus:border-rivix outline-none transition-all w-80"
            />
          </div>
        </div>

        <table className="w-full text-left">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Client Name</th>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Contact</th>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Active Batches</th>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-slate-50/30 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs group-hover:bg-rivix/10 group-hover:text-rivix transition-colors">
                      {client.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{client.name}</p>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        <MapPin size={10} />
                        {client.location}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail size={14} className="text-slate-400" />
                      {client.email}
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className="text-sm font-bold text-slate-700">{client.active_batches} Active</span>
                </td>
                <td className="px-8 py-6">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    client.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <ShieldCheck size={12} />
                    {client.status}
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <button className="p-2 text-slate-400 hover:text-rivix transition-colors">
                    <MoreVertical size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
