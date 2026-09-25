'use client';

import { Mail, Phone, Calendar } from 'lucide-react';

export default function RepWidget() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <p className="text-[10px] font-bold text-rivix uppercase tracking-widest mb-3">Your RIVIX Rep</p>
      
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-rivix/10 flex items-center justify-center text-rivix font-bold overflow-hidden border border-slate-200">
            SR
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">Sayem R.</h4>
          <p className="text-[11px] text-slate-500 font-medium">Account Manager</p>
        </div>
      </div>

      <div className="space-y-2">
        <a href="mailto:sayem@rivix.ca" className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rivix transition-colors">
          <Mail size={14} className="text-slate-400" />
          sayem@rivix.ca
        </a>
        <a href="tel:+14035551234" className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rivix transition-colors">
          <Phone size={14} className="text-slate-400" />
          (403) 555-1234
        </a>
        <a 
          href="https://rivix.ca/contact"
          target="_blank"
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rivix transition-colors w-full text-left pt-1"
        >
          <Calendar size={14} className="text-slate-400" />
          Schedule a Call
        </a>

      </div>
    </div>

  );
}
