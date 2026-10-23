'use client';

import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage { text: string; type: 'success' | 'error' }

// A short message in the bottom-right corner that confirms an action and goes away by itself.
export default function Toast({ toast, onClose, ms = 4500 }: { toast: ToastMessage | null; onClose: () => void; ms?: number }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, ms);
    return () => clearTimeout(t);
  }, [toast, onClose, ms]);

  if (!toast) return null;
  const ok = toast.type === 'success';
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4 sm:justify-end sm:px-8">
      <div className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
        {ok ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-600" />}
        <p className="text-[14px] font-semibold leading-snug">{toast.text}</p>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="ml-1 shrink-0 text-slate-400 hover:text-slate-700"><X size={16} /></button>
      </div>
    </div>
  );
}
