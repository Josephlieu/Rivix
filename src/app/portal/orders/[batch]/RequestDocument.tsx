'use client';

import { useCallback, useEffect, useState } from 'react';
import { FilePlus2, Loader2, Send, X, AlertCircle } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { DOC_TYPES } from '@/lib/documents';
import { canRequestDocuments } from '@/lib/order-stages';

interface Req { id: string; doc_type: string; note: string | null; status: string; created_at: string }

const statusLabel: Record<string, { text: string; cls: string }> = {
  pending_rep: { text: 'With your rep', cls: 'bg-amber-50 text-amber-600' },
  open: { text: 'With RIVIX', cls: 'bg-sky-50 text-sky-600' },
  done: { text: 'Done', cls: 'bg-emerald-50 text-emerald-600' },
  dismissed: { text: 'Closed', cls: 'bg-slate-100 text-slate-500' },
};

// The customer asks for a document. It goes to their sales rep, who passes it on
// to RIVIX admin if needed. Not shown for cancelled orders.
export default function RequestDocument({ orderId, status }: { orderId: string; status: string }) {
  const allowed = canRequestDocuments(status);
  const [requests, setRequests] = useState<Req[]>([]);
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Row security: a customer only ever gets their own requests back.
    const { data } = await supabaseBrowser
      .from('document_requests')
      .select('id, doc_type, note, status, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    setRequests((data as Req[]) || []);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch(`/api/portal/orders/${orderId}/document-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_type: docType, note }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not send the request.'); return; }
    setSent(data.to === 'rep' ? 'Request sent to your sales rep.' : 'Request sent to RIVIX.');
    setOpen(false); setNote('');
    load();
  };

  const input = 'w-full px-3 py-2.5 bg-slate-50 border-none rounded-xl text-xs focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';

  return (
    <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
      {requests.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your requests</p>
          {requests.map((r) => {
            const st = statusLabel[r.status] || statusLabel.open;
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-700 truncate">{r.doc_type}</span>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${st.cls}`}>{st.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {sent && <p className="text-xs font-semibold text-emerald-600">{sent}</p>}

      {!allowed && status !== 'Cancelled' && (
        <p className="text-[11px] text-slate-400">You can request certificates and other documents once your order has shipped.</p>
      )}

      {allowed && !open && (
        <button onClick={() => { setOpen(true); setSent(null); setError(null); }} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-rivix hover:text-rivix transition-all">
          <FilePlus2 size={15} />Request a document
        </button>
      )}

      {allowed && open && (
        <form onSubmit={send} className="space-y-3 rounded-2xl border border-slate-100 p-4 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-800">Which document do you need?</p>
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Cancel"><X size={14} /></button>
          </div>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-semibold rounded-xl px-3 py-2">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}
          <select className={input} value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={1000} />
          <button disabled={busy} className="w-full bg-slate-950 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-rivix transition-all flex items-center justify-center gap-2 disabled:opacity-40">
            {busy ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}Send request
          </button>
          <p className="text-[10px] text-slate-400">Your sales rep is notified and will arrange it.</p>
        </form>
      )}
    </div>
  );
}
