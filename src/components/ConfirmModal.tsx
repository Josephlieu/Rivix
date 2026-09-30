'use client';

import { useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={() => !loading && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-8 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl shrink-0 ${danger ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 id="confirm-title" className="font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white flex items-center gap-2 disabled:opacity-60 transition-all ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-950 hover:bg-rivix'
            }`}
          >
            {loading && <Loader2 className="animate-spin" size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
