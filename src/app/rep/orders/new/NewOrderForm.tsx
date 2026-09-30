'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, AlertCircle, Check } from 'lucide-react';
import SizeGrid, { SizeGridValue, emptySizeGrid, gridToSizes, gridTotal } from '@/components/SizeGrid';

interface CustomerOption { id: string; customer_code: string; company_name: string }
interface Item { product_name: string; sizes: SizeGridValue; branding: string }

const newItem = (): Item => ({ product_name: '', sizes: emptySizeGrid(), branding: '' });

export default function NewOrderForm({
  customers,
  initialCustomerId,
}: {
  customers: CustomerOption[];
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(
    customers.some((c) => c.id === initialCustomerId) ? (initialCustomerId as string) : ''
  );
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [delivery, setDelivery] = useState('');
  const [po, setPo] = useState('');
  const [pricing, setPricing] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setItem = (i: number, patch: Partial<Item>) =>
    setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const empty = items.findIndex((it) => gridTotal(it.sizes) < 1);
    if (empty !== -1) {
      setError(`Product ${empty + 1}: enter a quantity for at least one size.`);
      return;
    }
    setSaving(true);
    const res = await fetch('/api/rep/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        items: items.map((it) => ({ product_name: it.product_name, sizes: gridToSizes(it.sizes), branding: it.branding })),
        delivery_location: delivery,
        po_number: po,
        pricing,
        special_requirements: notes,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not create the order.');
      setSaving(false);
      return;
    }
    router.push(`/rep/orders/${data.order.id}`);
  };

  const input =
    'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';
  const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

  if (customers.length === 0) {
    return <p className="text-sm text-slate-500">You have no customers assigned yet, so there's nobody to create an order for.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-2">
        <label className={label}>Customer *</label>
        <select required className={input} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Choose a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name} ({c.customer_code})</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-5">
        <h3 className="font-bold text-slate-900">Products</h3>
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
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className={label}>Product *</label>
                <input required className={input} value={it.product_name} onChange={(e) => setItem(i, { product_name: e.target.value })} placeholder="Hi-vis jacket" />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Sizes &amp; quantities *</label>
                <SizeGrid value={it.sizes} onChange={(v) => setItem(i, { sizes: v })} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Branding</label>
                <textarea rows={2} className={input} value={it.branding} onChange={(e) => setItem(i, { branding: e.target.value })} placeholder="Logo on back, 30 cm, white on navy" />
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setItems((l) => [...l, newItem()])} className="text-sm font-bold text-rivix hover:underline inline-flex items-center gap-2">
          <Plus size={16} />Add another product
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1.5">
          <label className={label}>Delivery location</label>
          <input className={input} value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="123 Main St, Calgary, AB" />
        </div>
        <div className="space-y-1.5">
          <label className={label}>PO number</label>
          <input className={input} value={po} onChange={(e) => setPo(e.target.value)} placeholder="PO-2026-118" />
        </div>
        <div className="space-y-1.5">
          <label className={label}>Pricing (reference)</label>
          <input className={input} value={pricing} onChange={(e) => setPricing(e.target.value)} placeholder="$45/unit, total $2,250" />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <label className={label}>Special requirements</label>
          <textarea rows={3} className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything admin or the factory should know" />
        </div>
      </div>

      <div className="flex gap-3">
        <button disabled={saving} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
          Submit order
        </button>
        <button type="button" onClick={() => router.push('/rep')} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
