'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Clock, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';
import OrderRequestForm from '@/components/OrderRequestForm';
import { formatDate } from '@/lib/format';
import { MAX_OPEN_REQUESTS } from '@/lib/order-requests-shared';

interface Req {
  id: string; kind: 'reorder' | 'quote'; status: 'open' | 'converted' | 'declined'; note: string | null; decline_reason: string | null;
  decided_at: string | null; created_at: string; items: { product_name: string; sizes: { size: string; qty: number }[] }[];
  source: { batch_number: string } | null; order: { batch_number: string } | null;
}

// The customer's reorders and quote requests, and what happened to each. "Request a quote" opens the same form empty.
function RequestsInner() {
  const sent = useSearchParams().get('sent') === '1';
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/portal/order-requests');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || 'Could not load your requests.');
      setRequests(data.requests || []);
      setLoading(false);
    })();
  }, []);

  const open = requests.filter((r) => r.status === 'open').length;

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requests</h1>
          <p className="text-slate-500">Your reorders and quote requests. To reorder, open a past order and press Reorder.</p>
        </div>
        {!quoting && (
          <button onClick={() => setQuoting(true)} disabled={open >= MAX_OPEN_REQUESTS} className="bg-rivix text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50">
            <Plus size={16} />Request a quote
          </button>
        )}
      </div>
      {sent && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold rounded-2xl px-4 py-3">Request sent. Your sales rep (or RIVIX) will get back to you.</div>}
      {open >= MAX_OPEN_REQUESTS && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">You have {open} open requests, the most allowed. New ones can be sent once RIVIX answers some of them.</p>}
      {quoting && <OrderRequestForm kind="quote" onCancel={() => setQuoting(false)} />}
      {error && <p className="text-sm font-semibold text-red-500">{error}</p>}

      {!loading && !error && requests.length === 0 && !quoting && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300"><ClipboardList size={28} /></div>
          <p className="font-bold text-slate-900">No requests yet</p>
          <p className="text-sm text-slate-500">Reorder from one of your orders, or request a quote for something new.</p>
        </div>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-900">{r.kind === 'reorder' ? `Reorder${r.source ? ` of ${r.source.batch_number}` : ''}` : 'Quote request'}</p>
              <span className="text-[11px] text-slate-400">Sent {formatDate(r.created_at)}</span>
            </div>
            <ul className="text-sm text-slate-600 space-y-0.5">
              {r.items.map((it, i) => (
                <li key={i}>{it.product_name}: {it.sizes.map((s) => `${s.size} x${s.qty}`).join(', ')}</li>
              ))}
            </ul>
            {r.note && <p className="text-xs text-slate-500">Your note: {r.note}</p>}
            {r.status === 'open' && <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700"><Clock size={14} />Waiting for your sales rep or RIVIX</p>}
            {r.status === 'converted' && (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={14} />Turned into order{' '}
                {r.order ? <Link href={`/portal/orders/${r.order.batch_number}`} className="underline">{r.order.batch_number}</Link> : '(removed)'}
              </p>
            )}
            {r.status === 'declined' && <p className="inline-flex items-start gap-1.5 text-xs font-semibold text-red-600"><XCircle size={14} className="shrink-0 mt-px" />Declined{r.decided_at ? ` on ${formatDate(r.decided_at)}` : ''}{r.decline_reason ? `: ${r.decline_reason}` : ''}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PortalRequestsPage() {
  return <Suspense><RequestsInner /></Suspense>;
}
