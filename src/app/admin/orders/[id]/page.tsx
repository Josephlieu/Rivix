'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, Check, Truck, MessageSquarePlus, FileText, Upload } from 'lucide-react';
import OrderHeading from '@/components/OrderHeading';
import SizeBreakdown from '@/components/SizeBreakdown';
import ConfirmModal from '@/components/ConfirmModal';
import ComboInput from '@/components/ComboInput';
import DocumentList from '@/components/DocumentList';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { DOC_TYPES, DOC_ACCEPT, MAX_DOC_BYTES, ALLOWED_DOC_MIME, DocumentRow } from '@/lib/documents';
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
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [docDelete, setDocDelete] = useState<DocumentRow | null>(null);
  const [fileKey, setFileKey] = useState(0);
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
    setOrder(data.order); setCustomer(data.customer); setItems(data.items); setEvents(data.events); setDocs(data.documents || []); setRequests(data.requests || []);
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


  const uploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;
    setError(null); setNotice(null);
    if (!(ALLOWED_DOC_MIME as readonly string[]).includes(docFile.type)) { setError('That file type is not allowed. Use PDF, an image, Word or Excel.'); return; }
    if (docFile.size > MAX_DOC_BYTES) { setError('Files must be 20 MB or smaller.'); return; }
    setBusy('doc');
    try {
      // 1) ask the server for a one-time upload link  2) send the file straight to storage  3) record it
      const r1 = await fetch(`/api/admin/orders/${id}/documents/upload-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_name: docFile.name, size: docFile.size, mime: docFile.type }) });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.error || 'Could not start the upload.');
      const up = await supabaseBrowser.storage.from('documents').uploadToSignedUrl(d1.path, d1.token, docFile, { contentType: docFile.type });
      if (up.error) throw new Error(up.error.message || 'The upload failed.');
      const r2 = await fetch(`/api/admin/orders/${id}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: d1.path, file_name: docFile.name, title: docTitle, doc_type: docType }) });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.error || 'Could not save the document.');
      setNotice('Document uploaded.'); setDocFile(null); setDocTitle(''); setFileKey((k) => k + 1);
      await load();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    }
    setBusy(null);
  };

  const deleteDocument = async () => {
    if (!docDelete) return;
    setBusy('docdel'); setError(null); setNotice(null);
    const res = await fetch(`/api/admin/documents/${docDelete.id}`, { method: 'DELETE' });
    setBusy(null);
    if (!res.ok) { setError((await res.json()).error || 'Could not delete the document.'); return; }
    setDocDelete(null); setNotice('Document deleted.'); await load();
  };

  const markRequestDone = async (reqId: string) => {
    setBusy('req' + reqId); setError(null); setNotice(null);
    const res = await fetch(`/api/admin/document-requests/${reqId}`, { method: 'PATCH' });
    setBusy(null);
    if (!res.ok) { setError((await res.json()).error || 'Could not update the request.'); return; }
    setNotice('Request marked as done.'); await load();
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
          <OrderHeading number={order.batch_number} status={order.status} />
          <p className="text-sm text-slate-500 mt-2">
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

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-5">
            <div className="flex items-center gap-2"><FileText size={18} className="text-slate-400" /><h3 className="font-bold text-slate-900">Documents</h3></div>
            <p className="text-xs text-slate-400">Files uploaded here are visible to {customer.company_name} and their rep. PDF, image, Word or Excel, up to 20 MB.</p>
            {requests.some((r) => r.status === 'open') && (
              <div className="rounded-2xl bg-amber-50/60 border border-amber-100 p-4 space-y-2">
                <p className="text-xs font-black text-amber-700 uppercase tracking-widest">Requested by the rep</p>
                {requests.filter((r) => r.status === 'open').map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800">{r.doc_type}{r.rep?.name ? <span className="text-slate-400 font-semibold"> · {r.rep.name}</span> : null}</p>
                      {r.note && <p className="text-xs text-slate-500">{r.note}</p>}
                    </div>
                    <button onClick={() => markRequestDone(r.id)} disabled={busy === 'req' + r.id} className="px-3 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50 whitespace-nowrap">Mark done</button>
                  </div>
                ))}
                <p className="text-[11px] text-amber-700/70">Uploading a document of the same type marks its request as done automatically.</p>
              </div>
            )}
            <DocumentList documents={docs} onDelete={setDocDelete} empty="No documents uploaded for this order yet." />
            <form onSubmit={uploadDocument} className="rounded-2xl border border-dashed border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={label}>Type</label>
                  <select className={input} value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Title (optional)</label>
                  <input className={input} value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Defaults to the file name" />
                </div>
              </div>
              <input key={fileKey} type="file" accept={DOC_ACCEPT} onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold file:text-xs hover:file:bg-slate-200" />
              <button disabled={!docFile || busy === 'doc'} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-950">
                {busy === 'doc' ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}Upload document
              </button>
            </form>
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

      <ConfirmModal
        open={docDelete !== null}
        danger
        loading={busy === 'docdel'}
        title={`Delete "${docDelete?.title}"?`}
        message="The customer and rep will no longer see this document. This can't be undone."
        confirmLabel="Delete document"
        onConfirm={deleteDocument}
        onCancel={() => setDocDelete(null)}
      />
    </div>
  );
}
