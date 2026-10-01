'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, Check, Truck, MessageSquarePlus, FileText } from 'lucide-react';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import SizeBreakdown from '@/components/SizeBreakdown';
import ConfirmModal from '@/components/ConfirmModal';
import ComboInput from '@/components/ComboInput';
import { ORDER_STAGES, CARRIERS } from '@/lib/order-stages';

interface Order {
  id: string; batch_number: string; status: string; created_at: string;
  delivery_location: string | null; po_number: string | null; pricing: string | null;
  special_requirements: string | null; carrier: string | null; tracking_number: string | null;
}
interface Item { id: string; product_name: string; quantity: number; sizing: string | null; size_breakdown: { size: string; qty: number }[] | null; branding: string | null }
interface EventRow { id: string; status: string | null; note: string | null; customer_visible: boolean; created_by: string | null; created_at: string }
interface CustomerInfo { id: string; company_name: string; customer_code: string; contact_email: string | null; rep: { name: string; rep_code?: string | null } | null }

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex justify-between gap-6 text-sm border-b border-slate-50 pb-3">
    <span className="text-slate-400">{label}</span>
    <span className="text-slate-900 font-semibold text-right break-words">{value || '—'}</span>
  </div>
);

export default function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [stage, setStage] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmStage, setConfirmStage] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/admin/orders/${id}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Could not load this order.'); setLoading(false); return; }
    setOrder(data.order); setCustomer(data.customer); setItems(data.items); setEvents(data.events);
    setStage(data.order.status); setCarrier(data.order.carrier || ''); setTracking(data.order.tracking_number || '');
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const patch = async (body: Record<string, unknown>, label: string) => {
    setBusy(label); setError(null); setNotice(null);
    const res = await fetch(`/api/admin/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setError(data.error || 'Could not save.'); return false; }
    setNotice(data.changed === false ? 'Nothing changed.' : 'Saved.');
    await load();
    return true;
  };

  const updateStage = async () => {
    if (await patch({ status: stage, note: stageNote }, 'stage')) setStageNote('');
    setConfirmStage(false);
  };
  const onUpdateStageClick = () => {
    if (stage === order?.status) return;
    if (stage === 'Delivered' || stage === 'Cancelled') setConfirmStage(true);
    else updateStage();
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('note'); setError(null); setNotice(null);
    const res = await fetch(`/api/admin/orders/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note, customer_visible: visible }) });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setError(data.error || 'Could not add the note.'); return; }
    setNote(''); setNotice('Note added.'); await load();
  };

  const input = 'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';
  const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

  if (loading) return <div className="py-20 text-center text-slate-400"><Loader2 className="animate-spin inline" size={20} /></div>;
  if (!order || !customer) {
    return (
      <div className="space-y-4">
        <Link href="/admin/orders" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2"><ArrowLeft size={16} />Back to orders</Link>
        <p className="text-sm text-red-600">{error || 'Order not found.'}</p>
      </div>
    );
  }

  const total = items.reduce((n, it) => n + it.quantity, 0);
  const shippingChanged = carrier.trim() !== (order.carrier || '') || tracking.trim() !== (order.tracking_number || '');

  return (
    <div className="space-y-8 max-w-6xl">
      <Link href="/admin/orders" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2"><ArrowLeft size={16} />Back to orders</Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{order.batch_number}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            <Link href={`/admin/clients/${customer.id}`} className="font-semibold hover:text-rivix">{customer.company_name}</Link> · {customer.customer_code} · Rep: {customer.rep?.name || 'Unassigned'} · Created {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {notice && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-3">
            <h3 className="font-bold text-slate-900 mb-2">Order details</h3>
            <Row label="Delivery location" value={order.delivery_location} />
            <Row label="PO number" value={order.po_number} />
            <Row label="Pricing (reference)" value={order.pricing} />
            <Row label="Special requirements" value={order.special_requirements} />
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
            <h3 className="font-bold text-slate-900">Products <span className="text-slate-400 font-semibold">({total} units)</span></h3>
            {items.length === 0 && <p className="text-sm text-slate-400">No product lines on this order.</p>}
            {items.map((it) => (
              <div key={it.id} className="rounded-2xl border border-slate-100 p-4 text-sm space-y-1">
                <p className="font-bold text-slate-900">{it.product_name} <span className="text-slate-400 font-semibold">× {it.quantity}</span></p>
                <SizeBreakdown sizes={it.size_breakdown} fallbackText={it.sizing} />
                {it.branding && <p className="text-slate-500">Branding: {it.branding}</p>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-3">
            <div className="flex items-center gap-2"><FileText size={18} className="text-slate-400" /><h3 className="font-bold text-slate-900">Documents</h3></div>
            <p className="text-sm text-slate-400">Certificates and files for this order will be uploaded here — coming next.</p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
            <h3 className="font-bold text-slate-900">Stage</h3>
            <div className="space-y-1.5">
              <label className={label}>Move this order to</label>
              <select className={input} value={stage} onChange={(e) => setStage(e.target.value)}>
                {ORDER_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={label}>Note (optional)</label>
              <input className={input} value={stageNote} onChange={(e) => setStageNote(e.target.value)} placeholder="Shown on the timeline with this change" />
            </div>
            <button onClick={onUpdateStageClick} disabled={stage === order.status || busy === 'stage'} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-950">
              {busy === 'stage' ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}Update stage
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
            <div className="flex items-center gap-2"><Truck size={18} className="text-slate-400" /><h3 className="font-bold text-slate-900">Shipping</h3></div>
            <div className="space-y-1.5">
              <label className={label}>Carrier</label>
              <ComboInput className={`${input} pr-10`} value={carrier} onChange={setCarrier} options={CARRIERS} placeholder="Choose or type a carrier" />
            </div>
            <div className="space-y-1.5">
              <label className={label}>Tracking number</label>
              <input className={input} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 1Z999AA10123456784" />
            </div>
            <button onClick={() => patch({ carrier, tracking_number: tracking }, 'ship')} disabled={!shippingChanged || busy === 'ship'} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-950">
              {busy === 'ship' ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}Save shipping
            </button>
          </div>

          <form onSubmit={addNote} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
            <div className="flex items-center gap-2"><MessageSquarePlus size={18} className="text-slate-400" /><h3 className="font-bold text-slate-900">Add a note</h3></div>
            <textarea required rows={3} className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sample approved by customer" />
            <div className="flex gap-4 text-sm text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={visible} onChange={() => setVisible(true)} className="accent-[#c61213]" />Customer can see</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={!visible} onChange={() => setVisible(false)} className="accent-[#c61213]" />Internal only</label>
            </div>
            <button disabled={busy === 'note'} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-40">
              {busy === 'note' ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}Add note
            </button>
          </form>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-3">
            <h3 className="font-bold text-slate-900">Timeline</h3>
            {events.map((e) => (
              <div key={e.id} className="text-sm border-l-2 border-slate-100 pl-4">
                <p className="font-semibold text-slate-900">
                  {e.status || 'Note'}
                  {!e.customer_visible && <span className="ml-2 text-[10px] font-black uppercase text-amber-500">internal</span>}
                </p>
                {e.note && <p className="text-slate-500">{e.note}</p>}
                <p className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}{e.created_by ? ` · ${e.created_by}` : ''}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmStage}
        danger={stage === 'Cancelled'}
        loading={busy === 'stage'}
        title={stage === 'Cancelled' ? `Cancel ${order.batch_number}?` : `Mark ${order.batch_number} as delivered?`}
        message={stage === 'Cancelled' ? 'The customer and rep will see the order as cancelled. You can move it to another stage later if this was a mistake.' : 'The customer and rep will see the order as delivered.'}
        confirmLabel={stage === 'Cancelled' ? 'Cancel order' : 'Mark delivered'}
        onConfirm={updateStage}
        onCancel={() => setConfirmStage(false)}
      />
    </div>
  );
}
