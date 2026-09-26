'use client';

import { Mail, UserX } from 'lucide-react';

interface RepWidgetProps {
  // Real rep assignment doesn't exist in the data model yet (no Sales Rep
  // system built) — this is always undefined for now. Once a real
  // customer<->rep relationship exists, pass the assigned rep in here and
  // this component can show their real name/contact instead of the
  // "not assigned" fallback below.
  rep?: {
    name: string;
    title: string;
    email: string;
    phone?: string;
  };
}

export default function RepWidget({ rep }: RepWidgetProps) {
  if (!rep) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <p className="text-[10px] font-bold text-rivix uppercase tracking-widest mb-3">Your RIVIX Rep</p>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
            <UserX size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Not yet assigned</h4>
            <p className="text-[11px] text-slate-500 font-medium">No sales rep on this account</p>
          </div>
        </div>

        <a
          href="mailto:info@rivix.ca"
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rivix transition-colors"
        >
          <Mail size={14} className="text-slate-400" />
          Contact support: info@rivix.ca
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <p className="text-[10px] font-bold text-rivix uppercase tracking-widest mb-3">Your RIVIX Rep</p>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-rivix/10 flex items-center justify-center text-rivix font-bold overflow-hidden border border-slate-200">
            {rep.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">{rep.name}</h4>
          <p className="text-[11px] text-slate-500 font-medium">{rep.title}</p>
        </div>
      </div>

      <div className="space-y-2">
        <a href={`mailto:${rep.email}`} className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rivix transition-colors">
          <Mail size={14} className="text-slate-400" />
          {rep.email}
        </a>
      </div>
    </div>
  );
}
