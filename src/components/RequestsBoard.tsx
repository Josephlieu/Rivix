'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

export interface BoardRow {
  id: string; kind: 'reorder' | 'quote'; status: 'open' | 'converted' | 'declined'; created_at: string;
  items: { product_name: string; sizes: { size: string; qty: number }[]; branding: string | null }[];
  note: string | null; decline_reason: string | null; decided_by: string | null; decided_at: string | null;
  company: string; code: string; handler?: string; source_batch: string | null; order_id: string | null; order_batch: string | null;
}

// Customer reorders and quote requests for the rep (their customers) or the admin (everyone): open ones first, with
// "Create order" (the pre-filled New Order form) and "Decline" (with a reason the customer sees).
export default function RequestsBoard({ rows, newOrderPath, orderPath }: { rows: BoardRow[]; newOrderPath: string; orderPath: string }) {
  const router = useRouter();
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decline = async (id: string) => {
    setBusy(true); setError(null);
    const res = await fetch(`/api/order-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decline', reason }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not decline the request.'); return; }
    setDeclining(null); setReason('');
    router.refresh();
  };

  const open = rows.filter((r) => r.status === 'open');
  const done = rows.filter((r) => r.status !== 'open');
  const card = (r: BoardRow) => (
    <div key={r.id} id={r.id} className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${r.status === 'open' ? 'border-amber-100 bg-white shadow-sm' : 'border-slate-100 bg-slate-50/40'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">{r.company} <span className="text-xs font-semibold text-slate-400">{r.code}</span></p>
          <p className="text-xs text-slate-500">
            {r.kind === 'reorder' ? `Reorder${r.source_batch ? ` of ${r.source_batch}` : ''}` : 'Quote request'} · {formatDateTime(r.created_at)}
            {r.handler ? ` · Handled by ${r.handler}` : ''}
          </p>
        </div>
      </div>
      <ul className="text-sm text-slate-700 space-y-1">
        {r.items.map((it, i) => (
          <li key={i}>
            <span className="font-semibold">{it.product_name}</span>: {it.sizes.map((s) => `${s.size} x${s.qty}`).join(', ')} ({it.sizes.reduce((n, s) => n + s.qty, 0)} total)
            {it.branding ? <span className="text-slate-500">. Branding: {it.branding}</span> : null}
          </li>
        ))}
      </ul>
      {r.note && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 whitespace-pre-line">Customer note: {r.note}</p>}
      {r.status === 'open' && (declining === r.id ? (
        <div className="flex flex-wrap items-center gap-2">
          <input autoFocus maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (the customer sees this)" className="flex-1 min-w-[12rem] px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm" />
          <button onClick={() => decline(r.id)} disabled={busy || !reason.trim()} className="px-4 py-2 rounded-xl border border-red-100 bg-white text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1.5">
            {busy && <Loader2 className="animate-spin" size={14} />}Decline request
          </button>
          <button onClick={() => { setDeclining(null); setReason(''); }} className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link href={`${newOrderPath}?request=${r.id}`} className="px-4 py-2 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-rivix inline-flex items-center gap-1.5">
            Create order<ArrowRight size={14} />
          </Link>
          <button onClick={() => { setDeclining(r.id); setReason(''); setError(null); }} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:border-red-200 hover:text-red-600">Decline</button>
        </div>
      ))}
      {r.status === 'converted' && (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 size={14} />Turned into {r.order_id ? <Link href={`${orderPath}/${r.order_id}`} className="underline">{r.order_batch || 'an order'}</Link> : 'an order (since removed)'}
          {r.decided_by ? ` by ${r.decided_by}` : ''}
        </p>
      )}
      {r.status === 'declined' && (
        <p className="inline-flex items-start gap-1.5 text-xs font-semibold text-red-600">
          <XCircle size={14} className="shrink-0 mt-px" />Declined{r.decided_by ? ` by ${r.decided_by}` : ''}{r.decline_reason ? `: ${r.decline_reason}` : ''}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
      <section className="space-y-3">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Open ({open.length})</h2>
        {open.length ? open.map(card) : <p className="text-sm text-slate-400">No open requests.</p>}
      </section>
      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Handled</h2>
          {done.map(card)}
        </section>
      )}
    </div>
  );
}
