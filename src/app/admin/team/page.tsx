'use client';

import { useState } from 'react';
import { User, Mail, Phone, Camera, Save, CheckCircle2 } from 'lucide-react';

export default function TeamManagement() {
  const [saved, setSaved] = useState(false);
  const [repInfo, setRepInfo] = useState({
    name: 'Sarah Chen',
    title: 'Senior Account Manager',
    email: 'sarah.chen@rivix.ca',
    phone: '(403) 555-1234',
    photo: '/sarah_rep.png'
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    // In a real app, this would update a database or global state
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team & Rep Management</h1>
        <p className="text-slate-500">Update the sales representative information shown to clients in their portal.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-rivix/10 flex items-center justify-center text-rivix">
              <User size={32} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Primary Account Representative</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Global Assignment</p>
            </div>
          </div>
          {saved && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 size={16} />
              Changes Saved Successfully
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={repInfo.name}
                onChange={(e) => setRepInfo({...repInfo, name: e.target.value})}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Job Title</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={repInfo.title}
                onChange={(e) => setRepInfo({...repInfo, title: e.target.value})}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="email" 
                value={repInfo.email}
                onChange={(e) => setRepInfo({...repInfo, email: e.target.value})}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={repInfo.phone}
                onChange={(e) => setRepInfo({...repInfo, phone: e.target.value})}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all font-medium"
              />
            </div>
          </div>

          <div className="md:col-span-2 pt-4 flex justify-end">
            <button 
              type="submit"
              className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-rivix transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2"
            >
              <Save size={20} />
              Update Representative Info
            </button>
          </div>
        </form>
      </div>

      <div className="p-8 bg-amber-50 rounded-3xl border border-amber-100">
        <h4 className="text-amber-800 font-bold mb-2">Notice for Client Portal</h4>
        <p className="text-sm text-amber-700 leading-relaxed">
          The information above is displayed in the "Your Account Manager" widget for all clients. 
          Updating this info will change the contact details for everyone currently using the portal.
        </p>
      </div>
    </div>
  );
}
