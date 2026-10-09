'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, AlertCircle, Check } from 'lucide-react';
import { DOC_TYPES } from '@/lib/documents';
import { formatDate } from '@/lib/format';

interface Req { id: string; doc_type: string; note: string | null; status: string; created_at: string; requested_by?: string }

// A rep asks admin for a document on this order. Admin gets a notification.
export default function RequestDocument({ orderId, requests }: { orderId: string; requests: Req[] }) {
  const router = useRouter();
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const act = async (reqId: string, action: 'forward' | 'dismiss') => {
    setActing(reqId + action); setError(null);
    const res = await fetch(`/api/rep/document-requests/${reqId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    setActing(null);
    if (!res.ok) { setError((await res.json()).error || 'Could not update the request.'); return; }
    router.refresh();
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setSent(false);
    const res = await fetch(`/api/rep/orders/${orderId}/document-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_type: docType, note }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not send the request.'); return; }
    setNote(''); setSent(true);
    router.refresh();
  };

  const input = 'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';

  return (
    <div className="space-y-4">
      {requests.length > 0 && (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-bold text-slate-800">{r.doc_type}{r.requested_by === 'customer' && <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-violet-500">from customer</span>}</p>
                {r.note && <p className="text-xs text-slate-500 truncate">{r.note}</p>}
                <p className="text-[11px] text-slate-400">{formatDate(r.created_at)}</p>
              </div>
              {r.status === 'pending_rep' ? (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => act(r.id, 'forward')} disabled={acting !== null} className="px-3 py-1.5 rounded-lg bg-slate-950 text-white text-xs font-bold hover:bg-rivix disabled:opacity-40 whitespace-nowrap">Send to admin</button>
                  <button onClick={() => act(r.id, 'dismiss')} disabled={acting !== null} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40">Dismiss</button>
                </div>
              ) : (
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap ${r.status === 'done' ? 'bg-emerald-50 text-emerald-600' : r.status === 'dismissed' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>
                  {r.status === 'done' ? 'Done' : r.status === 'dismissed' ? 'Dismissed' : 'Waiting for admin'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={send} className="rounded-2xl border border-dashed border-slate-200 p-4 space-y-3">
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}
        {sent && <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5"><Check size={14} />Request sent — admin has been notified.</p>}
        <select className={input} value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for admin (optional) — e.g. customer needs it before shipping" maxLength={1000} />
        <button disabled={busy} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-40">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}Request document
        </button>
      </form>
    </div>
  );
}
