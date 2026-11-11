'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { confirmReplicationType, getGarmentTypes, suggestReplicationType, type ReplicationRequest } from '@/lib/replicationStorage';
import { DEFAULT_GARMENT_CATEGORIES, DEFAULT_GARMENT_TYPES, garmentTypeLabel, type GarmentCategory, type GarmentType } from '@/lib/garment-types-data';
import { isTypeConfirmed, typeCheckOf } from '@/lib/type-check';

// Task 28, step 1: before the AI scan, an admin confirms the product type. The type on the request form is only a starting guess.
// The AI can suggest one from the photos (only when asked); the admin uses it or picks another. Everything the AI wrote here
// (its reason) is shown as plain text.
export default function TypeCheckPanel({ rep, onUpdated, onNote }: { rep: ReplicationRequest; onUpdated: (r: ReplicationRequest) => void; onNote?: (note: string) => void }) {
  const [categories, setCategories] = useState<GarmentCategory[]>(DEFAULT_GARMENT_CATEGORIES);
  const [types, setTypes] = useState<GarmentType[]>(DEFAULT_GARMENT_TYPES);
  useEffect(() => { getGarmentTypes().then(l => { setCategories(l.categories); setTypes(l.types); }).catch(() => {}); }, []);
  const active = types.filter(t => t.active);
  const label = (key: string | null | undefined) => garmentTypeLabel(key, types);
  const catLabel = (key: string | null | undefined) => categories.find(c => c.key === key)?.label ?? '';
  const catOf = (key: string) => types.find(t => t.key === key)?.category ?? '';

  const tc = typeCheckOf(rep.specs);
  const confirmed = isTypeConfirmed(rep);
  const sug = tc?.suggestion;
  const [category, setCategory] = useState(catOf(rep.garmentType) || categories[0]?.key || '');
  const [typeKey, setTypeKey] = useState(rep.garmentType);
  useEffect(() => { setTypeKey(rep.garmentType); setCategory(catOf(rep.garmentType)); }, [rep.garmentType, types]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState<'' | 'suggest' | 'confirm'>('');
  const [error, setError] = useState('');

  const suggest = async () => {
    setBusy('suggest'); setError('');
    try { const { replication, note } = await suggestReplicationType(rep.id); onUpdated(replication); if (note && onNote) onNote(note); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not suggest a product type.'); }
    setBusy('');
  };
  const confirm = async (key: string) => {
    setBusy('confirm'); setError('');
    try { onUpdated(await confirmReplicationType(rep.id, key)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not confirm the product type.'); }
    setBusy('');
  };
  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rivix/30';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${confirmed ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Product type</p>
          <p className="text-sm font-bold text-slate-900">{label(rep.garmentType)} <span className="font-normal text-slate-500">({catLabel(catOf(rep.garmentType)) || 'no category'})</span></p>
          <p className={`text-[12px] ${confirmed ? 'text-emerald-700' : 'text-amber-800'}`}>
            {confirmed
              ? tc?.confirmedType ? <>Confirmed by {tc.confirmedBy}{tc.confirmedAt ? ` on ${new Date(tc.confirmedAt).toLocaleDateString()}` : ''}.</> : 'Used for the earlier scan (counts as confirmed).'
              : 'Not confirmed yet. The type on the request form is only a starting guess: confirm it, or pick another, before the AI scan.'}
          </p>
        </div>
        <button type="button" onClick={suggest} disabled={!!busy || rep.images.length === 0}
          title={rep.images.length === 0 ? 'Add photos first' : 'A quick AI look at the photos'}
          className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50">
          {busy === 'suggest' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Suggest type from photos
        </button>
      </div>

      {sug && (
        <div className="rounded-xl border border-violet-100 bg-white px-3 py-2 text-[13px] text-slate-700">
          {sug.typeKey
            ? <p><span className="font-bold">AI suggestion:</span> {label(sug.typeKey)} <span className="text-slate-500">in {catLabel(sug.categoryKey)}</span>, {sug.confidence}% sure.</p>
            : <p><span className="font-bold">AI suggestion:</span> not a product type on the list ({sug.confidence}% sure). Pick a type by hand if it is one.</p>}
          {sug.reason && <p className="text-slate-500">Why: {sug.reason}</p>}
          {sug.alternatives.length > 0 && <p className="text-slate-500">Could also be: {sug.alternatives.map(a => `${label(a.typeKey)} (${a.confidence}%)`).join(', ')}</p>}
          <div className="mt-1.5 flex flex-wrap gap-2">
            {sug.typeKey && active.some(t => t.key === sug.typeKey) && (
              <button type="button" onClick={() => confirm(sug.typeKey!)} disabled={!!busy} className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50">Use {label(sug.typeKey)}</button>
            )}
            {sug.alternatives.filter(a => active.some(t => t.key === a.typeKey)).map(a => (
              <button key={a.typeKey} type="button" onClick={() => confirm(a.typeKey)} disabled={!!busy} className="rounded-lg border border-violet-200 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50">Use {label(a.typeKey)}</button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">A suggestion only. You decide.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block space-y-1"><span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Category</span>
          <select className={field} value={category} onChange={e => { setCategory(e.target.value); const first = active.find(t => t.category === e.target.value); if (first) setTypeKey(first.key); }}>
            {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label className="block space-y-1"><span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Type</span>
          <select className={field} value={typeKey} onChange={e => setTypeKey(e.target.value)}>
            {active.filter(t => t.category === category).map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => confirm(typeKey)} disabled={!!busy || !active.some(t => t.key === typeKey)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50">
          {busy === 'confirm' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Confirm this type
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] text-red-800">{error}</p>}
    </div>
  );
}
