'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, AlertCircle, Check } from 'lucide-react';
import ComboInput from '@/components/ComboInput';
import { SAFETY_STANDARDS } from '@/lib/safety-standards';
import StandardNote from '@/components/StandardNote';
import SizeGrid, { SizeGridValue, emptySizeGrid, gridToSizes, gridTotal, sizesToGrid } from '@/components/SizeGrid';

interface CustomerOption { id: string; customer_code: string; company_name: string; rep_id?: string | null; rep_name?: string | null }
interface RepOption { id: string; name: string }
interface Item { product_name: string; sizes: SizeGridValue; branding: string; fabric: string; safety_standard: string }
// A customer's saved product spec, offered as a product suggestion (the server only sends ones this user may see).
export interface SpecOption { customer_id: string; product_name: string; fabric: string | null; safety_standard: string | null }

// The customer's saved spec whose product name matches (trimmed, any capitals), if any.
export const findSpec = (specs: SpecOption[], customerId: string | undefined, productName: string) => {
  const name = productName.trim().toLowerCase();
  return customerId && name ? specs.find((s) => s.customer_id === customerId && s.product_name.trim().toLowerCase() === name) : undefined;
};

const newItem = (): Item => ({ product_name: '', sizes: emptySizeGrid(), branding: '', fabric: '', safety_standard: '' });

export default function NewOrderForm({
  customers,
  initialCustomerId,
  endpoint = '/api/rep/orders',
  orderBasePath = '/rep/orders',
  cancelPath = '/rep',
  reps,
  emptyMessage = "You have no customers assigned yet, so there's nobody to create an order for.",
  fromRequest,
  specs = [],
}: {
  customers: CustomerOption[];
  initialCustomerId?: string;
  endpoint?: string;                  // where the order is sent (the admin page uses /api/admin/orders)
  orderBasePath?: string;             // after it is created, go to <orderBasePath>/<new order id> (text only: a server page cannot pass a function)
  cancelPath?: string;
  reps?: RepOption[];                 // admin only: when given, a "Sales rep" dropdown lets the admin pick the rep
  emptyMessage?: string;
  // Pre-filled from a customer's reorder or quote request: the order is linked to it and the customer is fixed.
  specs?: SpecOption[];               // saved product specs, used as product suggestions for the chosen customer
  fromRequest?: { id: string; label: string; items: { product_name: string; sizes: { size: string; qty: number }[]; branding: string | null }[]; note: string | null };
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(
    customers.some((c) => c.id === initialCustomerId) ? (initialCustomerId as string) : ''
  );
  const [repId, setRepId] = useState(''); // '' = keep the customer's current rep
  const [items, setItems] = useState<Item[]>(
    fromRequest?.items.length
      ? fromRequest.items.map((it) => {
          // Fill fabric and standard from the customer's saved spec with the same product name (any capitals).
          const spec = findSpec(specs, customers.some((c) => c.id === initialCustomerId) ? initialCustomerId : undefined, it.product_name);
          return { product_name: it.product_name, sizes: sizesToGrid(it.sizes), branding: it.branding || '', fabric: spec?.fabric || '', safety_standard: spec?.safety_standard || '' };
        })
      : [newItem()]
  );
  const [delivery, setDelivery] = useState('');
  const [po, setPo] = useState('');
  const [pricing, setPricing] = useState('');
  const [notes, setNotes] = useState(fromRequest?.note ? `Customer note: ${fromRequest.note}` : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setItem = (i: number, patch: Partial<Item>) =>
    setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  // The chosen customer's specs. Typing or picking a spec's exact product name fills its fabric and standard
  // (still editable).
  const customerSpecs = specs.filter((s) => s.customer_id === customerId);
  const setProductName = (i: number, name: string) => {
    const spec = findSpec(specs, customerId, name);
    setItem(i, spec ? { product_name: name, fabric: spec.fabric || '', safety_standard: spec.safety_standard || '' } : { product_name: name });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const unnamed = items.findIndex((it) => !it.product_name.trim());
    if (unnamed !== -1) { setError(`Product ${unnamed + 1}: enter a product name.`); return; }
    const empty = items.findIndex((it) => gridTotal(it.sizes) < 1);
    if (empty !== -1) {
      setError(`Product ${empty + 1}: enter a quantity for at least one size.`);
      return;
    }
    setSaving(true);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        ...(reps ? { rep_id: repId } : {}),
        ...(fromRequest ? { request_id: fromRequest.id } : {}),
        items: items.map((it) => ({ product_name: it.product_name, sizes: gridToSizes(it.sizes), branding: it.branding, fabric: it.fabric, safety_standard: it.safety_standard })),
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
    router.push(`${orderBasePath}/${data.order.id}`);
  };

  const input =
    'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';
  const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

  if (customers.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {fromRequest && (
        <p className="text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3 leading-relaxed">
          Pre-filled from the customer&apos;s {fromRequest.label}. Check the products and sizes, then submit: the request is marked as turned into this order.
        </p>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-2">
        <label className={label}>Customer *</label>
        <select required disabled={!!fromRequest} className={`${input} ${fromRequest ? 'opacity-70' : ''}`} value={customerId} onChange={(e) => { setCustomerId(e.target.value); setRepId(''); }}>
          <option value="">Choose a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name} ({c.customer_code})</option>
          ))}
        </select>
        {reps && customerId && (() => {
          const cust = customers.find((c) => c.id === customerId);
          const picked = reps.find((r) => r.id === repId);
          const toAdmin = repId === 'none';
          const changes = toAdmin ? !!cust?.rep_id : !!picked && picked.id !== (cust?.rep_id ?? null);
          return (
            <div className="pt-4 space-y-2">
              <label className={label}>Sales rep</label>
              <select className={input} value={repId} onChange={(e) => setRepId(e.target.value)}>
                <option value="">{cust?.rep_name ? `Keep ${cust.rep_name} (the customer's rep)` : 'Admin (handled directly)'}</option>
                {cust?.rep_id && <option value="none">Admin (handled directly)</option>}
                {reps.filter((r) => r.id !== cust?.rep_id).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {changes ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed">
                  {toAdmin ? (
                    <>This will take <strong>{cust?.company_name}</strong> away from {cust?.rep_name || 'their rep'} and handle them directly as admin, the same as choosing Admin on the Clients page. {cust?.rep_name || 'The rep'} will no longer see their orders.</>
                  ) : (
                    <>This will also make <strong>{picked?.name}</strong> the sales rep for <strong>{cust?.company_name}</strong>, the same as changing it on the Clients page.
                    They will see all of this customer&apos;s orders{cust?.rep_name ? <>, and {cust.rep_name} will no longer see them</> : null}.</>
                  )}
                </p>
              ) : (
                <p className="text-xs text-slate-400 px-1">The chosen rep is notified about this order.</p>
              )}
            </div>
          );
        })()}
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
                {customerSpecs.length ? (
                  <ComboInput className={input} value={it.product_name} onChange={(v) => setProductName(i, v)} options={customerSpecs.map((s) => s.product_name)} placeholder="Pick one of the customer's products, or type one" />
                ) : (
                  <input required className={input} value={it.product_name} onChange={(e) => setItem(i, { product_name: e.target.value })} placeholder="Hi-vis jacket" />
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={label}>Fabric</label>
                  <input maxLength={300} className={input} value={it.fabric} onChange={(e) => setItem(i, { fabric: e.target.value })} placeholder="65% poly / 35% cotton twill" />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Safety standard</label>
                  <ComboInput className={input} value={it.safety_standard} onChange={(v) => setItem(i, { safety_standard: v })} options={[...SAFETY_STANDARDS]} placeholder="Pick one, or type another (Other)" />
                  <StandardNote value={it.safety_standard} />
                </div>
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
        <button type="button" onClick={() => router.push(cancelPath)} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
