'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, AlertCircle, Send } from 'lucide-react';
import SizeGrid, { SizeGridValue, emptySizeGrid, gridToSizes, gridTotal, sizesToGrid } from '@/components/SizeGrid';

interface Item { product_name: string; sizes: SizeGridValue; branding: string }
const newItem = (): Item => ({ product_name: '', sizes: emptySizeGrid(), branding: '' });

// The customer's reorder or quote request. It is NOT an order: it goes to their rep (or RIVIX directly), who turns it
// into an order. A reorder starts with the past order's products and sizes; a quote request starts empty.
export default function OrderRequestForm({
  kind,
  sourceOrderId,
  sourceBatch,
  initialItems = [],
  onCancel,
}: {
  kind: 'reorder' | 'quote';
  sourceOrderId?: string;
  sourceBatch?: string;
  initialItems?: { product_name: string; sizes: { size: string; qty: number }[]; branding?: string | null }[];
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(
    initialItems.length ? initialItems.map((it) => ({ product_name: it.product_name, sizes: sizesToGrid(it.sizes), branding: it.branding || '' })) : [newItem()]
  );
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setItem = (i: number, patch: Partial<Item>) => setItems((l) => l.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const empty = items.findIndex((it) => gridTotal(it.sizes) < 1);
    if (empty !== -1) { setError(`Product ${empty + 1}: enter a quantity for at least one size.`); return; }
    setSending(true);
    const res = await fetch('/api/portal/order-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        ...(kind === 'reorder' ? { source_order_id: sourceOrderId } : {}),
        items: items.map((it) => ({ product_name: it.product_name, sizes: gridToSizes(it.sizes), branding: it.branding })),
        note,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || 'Could not send the request.'); setSending(false); return; }
    router.push('/portal/requests?sent=1');
  };

  const input = 'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';
  const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

  return (
    <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-5">
      <div>
        <h3 className="font-bold text-slate-900">{kind === 'reorder' ? `Reorder ${sourceBatch || ''}`.trim() : 'Request a quote'}</h3>
        <p className="text-sm text-slate-500 mt-1">
          {kind === 'reorder' ? 'Change the quantities if you need to and add a note. ' : 'Tell us what you need. '}
          This sends a request to your sales rep (or RIVIX directly); it is not an order yet. You will see the answer on your Requests page.
        </p>
      </div>
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {items.map((it, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Product {i + 1}</p>
            {items.length > 1 && (
              <button type="button" onClick={() => setItems((l) => l.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-400 hover:text-red-500" aria-label={`Remove product ${i + 1}`}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <label className={label}>Product *</label>
            <input required maxLength={200} className={input} value={it.product_name} onChange={(e) => setItem(i, { product_name: e.target.value })} placeholder="Hi-vis jacket" />
          </div>
          <div className="space-y-1.5">
            <label className={label}>Sizes &amp; quantities *</label>
            <SizeGrid value={it.sizes} onChange={(v) => setItem(i, { sizes: v })} />
          </div>
          <div className="space-y-1.5">
            <label className={label}>Branding</label>
            <textarea rows={2} maxLength={1000} className={input} value={it.branding} onChange={(e) => setItem(i, { branding: e.target.value })} placeholder="Logo on back, 30 cm, white on navy" />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setItems((l) => [...l, newItem()])} className="text-sm font-bold text-rivix hover:underline inline-flex items-center gap-2">
        <Plus size={16} />Add another product
      </button>
      <div className="space-y-1.5">
        <label className={label}>Note</label>
        <textarea rows={3} maxLength={1000} className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery date, changes from last time, anything we should know" />
      </div>
      <div className="flex gap-3">
        <button disabled={sending} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-60">
          {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}Send request
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50">Cancel</button>}
      </div>
    </form>
  );
}
