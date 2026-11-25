'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Send, Trash2 } from 'lucide-react';
import SpecText from '@/components/catalog/SpecText';
import { PRICE_ON_QUOTE, SPEC_LIMITS, type Spec } from '@/lib/catalog-families';

type Line = { id: string; familyId: string; familyCode: string; familyName: string; available: boolean; spec: Spec; sizes: { size: string; qty: number }[]; total: number; minimumNote: string | null; minimumError: string | null };
type Cart = { note: string | null; lines: Line[]; settings: { min_order_qty: number; note_below_qty: number } };

// The customer's quote cart (2026-11-26): private to them until submitted. Change quantities, remove lines, add a note,
// then submit it as one quote request to their rep. Everything they typed is shown as plain text.
export default function QuoteCartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [note, setNote] = useState('');
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch('/api/portal/quote-cart'); const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'Could not load your quote cart.'); return; }
    setCart(d); setNote(d.note ?? ''); setEdits({});
  }, []);
  useEffect(() => { load(); }, [load]);
  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true); setError(null);
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error || 'Something went wrong.'); return null; }
    return d;
  };
  if (!cart) return error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-slate-400">Loading…</p>;
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quote cart</h1>
        <p className="text-slate-500">Only you can see this until you submit it. {PRICE_ON_QUOTE}: your sales rep replies with prices.</p>
      </div>
      {!cart.lines.length && <p className="text-sm text-slate-500">Your quote cart is empty. <Link href="/portal/browse" className="text-rivix font-semibold">Browse products</Link>.</p>}
      <div className="space-y-3">
        {cart.lines.map((l) => {
          const e = edits[l.id];
          return (
            <div key={l.id} className={`bg-white rounded-2xl border shadow-sm p-4 space-y-3 ${l.available ? 'border-slate-100' : 'border-red-100'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">{l.familyName} <span className="text-xs font-semibold text-slate-400">{l.familyCode}</span></p>
                  {!l.available && <p className="text-xs font-semibold text-red-600">No longer available: remove it before submitting.</p>}
                </div>
                <button disabled={busy} onClick={async () => { if (await call(`/api/portal/quote-cart/lines/${l.id}`, 'DELETE')) load(); }} className="text-xs font-bold text-slate-500 inline-flex items-center gap-1"><Trash2 size={14} />Remove</button>
              </div>
              <SpecText spec={l.spec} className="text-sm text-slate-600" />
              <div className="flex flex-wrap gap-2">
                {l.sizes.map((s) => (
                  <label key={s.size} className="w-24 space-y-1"><span className="text-[10px] font-black text-slate-400 uppercase">{s.size}</span>
                    <input type="number" min={0} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" value={e?.[s.size] ?? String(s.qty)} onChange={(ev) => setEdits({ ...edits, [l.id]: { ...(e ?? {}), [s.size]: ev.target.value } })} />
                  </label>
                ))}
              </div>
              <p className="text-sm text-slate-600">Total {l.total}{l.minimumError ? <span className="text-red-600"> · {l.minimumError}</span> : l.minimumNote ? <span className="text-amber-700"> · {l.minimumNote}</span> : null}</p>
              {e && l.available && <button disabled={busy} onClick={async () => {
                const sizes = l.sizes.map((s) => ({ size: s.size, qty: Number(e[s.size] ?? s.qty) }));
                if (await call(`/api/portal/quote-cart/lines/${l.id}`, 'PATCH', { sizes })) load();
              }} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">Save quantities</button>}
            </div>
          );
        })}
      </div>
      {cart.lines.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <label className="block space-y-1"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Note for your rep</span>
            <textarea rows={3} maxLength={SPEC_LIMITS.note} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== (cart.note ?? '')) call('/api/portal/quote-cart', 'PATCH', { note }); }} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} onClick={async () => {
            if (note !== (cart.note ?? '') && !(await call('/api/portal/quote-cart', 'PATCH', { note }))) return;
            const d = await call('/api/portal/quote-cart/submit', 'POST');
            if (d) router.push('/portal/requests?sent=1'); else load();
          }} className="px-5 py-2.5 rounded-xl bg-rivix text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Submit quote request</button>
        </div>
      )}
      {!cart.lines.length && error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
