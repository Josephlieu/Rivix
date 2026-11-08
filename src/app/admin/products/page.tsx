'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, AlertCircle, Pencil, Trash2, FileText, Eye, Upload, X } from 'lucide-react';
import ComboInput from '@/components/ComboInput';
import ConfirmModal from '@/components/ConfirmModal';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { ALLOWED_DOC_MIME, DOC_ACCEPT, MAX_DOC_BYTES } from '@/lib/documents';
import { SAFETY_STANDARDS } from '@/lib/safety-standards';
import { formatDate } from '@/lib/format';

interface Customer { id: string; company_name: string; customer_code: string }
interface Spec {
  id: string; customer_id: string; product_name: string; fabric: string | null; safety_standard: string | null;
  description: string | null; file_url: string | null; file_label: string | null; created_at: string;
  customers: { company_name: string; customer_code: string } | null;
}
type Draft = { id: string | null; customer_id: string; product_name: string; fabric: string; safety_standard: string; description: string; file_label: string; file: File | null; remove_file: boolean; has_file: boolean };

const SPEC_BUCKET = 'product-specs';
const input = 'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';
const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';
const blank = (customerId = ''): Draft => ({ id: null, customer_id: customerId, product_name: '', fabric: '', safety_standard: '', description: '', file_label: '', file: null, remove_file: false, has_file: false });

// Admin product specifications: each customer's contracted products with fabric, safety standard, notes and an
// optional file. Customers see their own on /portal/products; reps and admins get them as suggestions in New Order.
export default function AdminProductSpecsPage() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Spec | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  const load = async () => {
    const res = await fetch('/api/admin/product-specs');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || 'Could not load the product specs.');
    setSpecs(data.specs || []);
    setCustomers(data.customers || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => specs.filter((s) => !filter || s.customer_id === filter), [specs, filter]);

  const edit = (s: Spec) => {
    setDraft({ id: s.id, customer_id: s.customer_id, product_name: s.product_name, fabric: s.fabric || '', safety_standard: s.safety_standard || '', description: s.description || '', file_label: s.file_label || '', file: null, remove_file: false, has_file: !!s.file_url });
    setFileKey((k) => k + 1); setError(null); setNotice(null);
  };

  const uploadFile = async (customerId: string, f: File): Promise<string> => {
    const r1 = await fetch('/api/admin/product-specs/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: customerId, file_name: f.name, size: f.size, mime: f.type }) });
    const d1 = await r1.json().catch(() => ({}));
    if (!r1.ok) throw new Error(d1.error || 'Could not start the upload.');
    const up = await supabaseBrowser.storage.from(SPEC_BUCKET).uploadToSignedUrl(d1.path, d1.token, f, { contentType: f.type });
    if (up.error) throw new Error(up.error.message || 'The upload failed.');
    return d1.path;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setError(null); setNotice(null);
    if (!draft.customer_id) { setError('Choose a customer.'); return; }
    if (draft.file && !(ALLOWED_DOC_MIME as readonly string[]).includes(draft.file.type)) { setError('That file type is not allowed. Use PDF, an image, Word or Excel.'); return; }
    if (draft.file && draft.file.size > MAX_DOC_BYTES) { setError('Files must be 20 MB or smaller.'); return; }
    setSaving(true);
    try {
      const path = draft.file ? await uploadFile(draft.customer_id, draft.file) : null;
      const fields = { product_name: draft.product_name, fabric: draft.fabric, safety_standard: draft.safety_standard, description: draft.description, file_label: draft.file_label };
      const res = draft.id
        ? await fetch(`/api/admin/product-specs/${draft.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, ...(path ? { path } : draft.remove_file ? { remove_file: true } : {}) }) })
        : await fetch('/api/admin/product-specs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, customer_id: draft.customer_id, ...(path ? { path } : {}) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the spec.');
      setNotice(draft.id ? 'Spec updated.' : 'Spec added. The customer can see it on their Product Specs page.');
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the spec.');
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true); setError(null); setNotice(null);
    const res = await fetch(`/api/admin/product-specs/${toDelete.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) { setError(data.error || 'Could not delete the spec.'); return; }
    setToDelete(null); setNotice('Spec deleted.'); await load();
  };

  const openFile = async (s: Spec) => {
    const res = await fetch(`/api/admin/product-specs/${s.id}/file`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) { setError(data.error || 'Could not open the file.'); return; }
    window.open(data.url, '_blank', 'noopener');
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product specifications</h1>
          <p className="text-slate-500">Each customer&apos;s contracted products: fabric, safety standard, notes and a spec file.</p>
        </div>
        {!draft && (
          <button onClick={() => { setDraft(blank(filter)); setFileKey((k) => k + 1); setError(null); setNotice(null); }} className="bg-rivix text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all inline-flex items-center justify-center gap-2">
            <Plus size={16} />New spec
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {notice && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>}

      {draft && (
        <form onSubmit={save} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">{draft.id ? 'Edit spec' : 'New spec'}</h3>
            <button type="button" onClick={() => setDraft(null)} className="p-2 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={label}>Customer *</label>
              <select required disabled={!!draft.id} className={`${input} ${draft.id ? 'opacity-70' : ''}`} value={draft.customer_id} onChange={(e) => setDraft({ ...draft, customer_id: e.target.value })}>
                <option value="">Choose a customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name} ({c.customer_code})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={label}>Product name *</label>
              <input required maxLength={200} className={input} value={draft.product_name} onChange={(e) => setDraft({ ...draft, product_name: e.target.value })} placeholder="Hi-vis winter parka" />
            </div>
            <div className="space-y-1.5">
              <label className={label}>Fabric</label>
              <input maxLength={300} className={input} value={draft.fabric} onChange={(e) => setDraft({ ...draft, fabric: e.target.value })} placeholder="300D Oxford polyester, PU coated" />
            </div>
            <div className="space-y-1.5">
              <label className={label}>Safety standard</label>
              <ComboInput className={input} value={draft.safety_standard} onChange={(v) => setDraft({ ...draft, safety_standard: v })} options={[...SAFETY_STANDARDS]} placeholder="Pick one, or type another (Other)" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className={label}>Notes</label>
              <textarea rows={3} maxLength={2000} className={input} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Anything the customer should know about this product" />
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">Spec file (optional)</p>
            {draft.has_file && !draft.file && (
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={draft.remove_file} onChange={(e) => setDraft({ ...draft, remove_file: e.target.checked })} />
                Remove the current file
              </label>
            )}
            <input key={fileKey} type="file" accept={DOC_ACCEPT} onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] || null, remove_file: false })} className="block w-full text-sm text-slate-500 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold file:text-xs hover:file:bg-slate-200" />
            <p className="text-[11px] text-slate-400">{draft.has_file ? 'Choosing a file replaces the current one. ' : ''}PDF, image, Word or Excel, up to 20 MB.</p>
            <div className="space-y-1.5">
              <label className={label}>Button label</label>
              <input maxLength={100} className={input} value={draft.file_label} onChange={(e) => setDraft({ ...draft, file_label: e.target.value })} placeholder="Download spec sheet" />
            </div>
          </div>
          <button disabled={saving} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}{draft.id ? 'Save changes' : 'Add spec'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900">Specs ({shown.length})</h3>
          <select className="px-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by customer">
            <option value="">All customers</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-slate-400">No product specs{filter ? ' for this customer' : ''} yet.</p>
        ) : (
          <div className="space-y-3">
            {shown.map((s) => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-bold text-slate-900">{s.product_name}</p>
                  <p className="text-[11px] text-slate-400">{s.customers?.company_name || 'Unknown customer'} · added {formatDate(s.created_at)}</p>
                  <p className="text-xs text-slate-600">
                    {s.fabric ? <>Fabric: {s.fabric}</> : <span className="text-slate-400">No fabric</span>}
                    {' · '}
                    {s.safety_standard ? <>Standard: {s.safety_standard}</> : <span className="text-slate-400">No standard</span>}
                  </p>
                  {s.description && <p className="text-xs text-slate-500 italic">{s.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {s.file_url ? (
                    <button onClick={() => openFile(s)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:border-rivix hover:text-rivix">
                      <Eye size={14} />{s.file_label || 'File'}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 px-2"><FileText size={12} />No file</span>
                  )}
                  <button onClick={() => edit(s)} className="p-2 text-slate-400 hover:text-rivix" aria-label={`Edit ${s.product_name}`}><Pencil size={16} /></button>
                  <button onClick={() => setToDelete(s)} className="p-2 text-slate-400 hover:text-red-500" aria-label={`Delete ${s.product_name}`}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={toDelete !== null}
        danger
        loading={deleting}
        title={`Delete "${toDelete?.product_name}"?`}
        message="The customer will no longer see this spec, and its file is deleted. Orders already placed keep their own fabric and standard."
        confirmLabel="Delete spec"
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
