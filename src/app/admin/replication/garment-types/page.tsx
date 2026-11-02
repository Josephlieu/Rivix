'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, ArrowDown, Check, ChevronDown, Loader2, Pencil, Plus, X } from 'lucide-react';
import Toast, { type ToastMessage } from '@/components/Toast';
import { getGarmentTypes, type GarmentLibraryData } from '@/lib/replicationStorage';
import { FAMILIES, familyKeyFor, resolveTemplate } from '@/lib/garment-templates';

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-rivix/40 focus:outline-none focus:ring-2 focus:ring-rivix/10';

// What the tech file will ask for on a garment of this type: the measurement points, the construction checklist, sizing and protective notes.
function TemplatePanel({ typeKey, family }: { typeKey: string; family: string | null | undefined }) {
  const t = resolveTemplate(typeKey, family);
  return (
    <div className="space-y-5 border-t border-slate-100 bg-slate-50/60 px-5 py-5 text-sm">
      <p className="text-slate-600"><strong className="text-slate-800">{t.family.label}</strong>{t.modules.length > 0 && <> + {t.modules.map(m => m.label).join(', ')}</>}. {t.family.description}</p>
      {t.parts.map((part) => (
        <div key={part.key}>
          <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Measurement points{t.parts.length > 1 ? `: ${part.label}` : ''} ({part.points.length})</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-widest text-slate-400"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Point</th><th className="px-3 py-2">Measured</th><th className="px-3 py-2">How</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {part.points.map(pt => <tr key={pt.code}><td className="px-3 py-1.5 font-bold text-slate-700">{pt.code}</td><td className="px-3 py-1.5 font-semibold text-slate-800">{pt.name}</td><td className="px-3 py-1.5 text-slate-500">{pt.kind === 'flat' ? 'Flat, across' : 'Length'}</td><td className="px-3 py-1.5 text-slate-500">{pt.definition}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div>
        <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Construction checklist ({t.checklist.length})</h4>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {t.checklist.map(it => (
            <li key={it.key} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]">
              <span className="text-slate-700">{it.label}</span>
              <span className="flex shrink-0 gap-1">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${it.source === 'photo' ? 'bg-sky-50 text-sky-600' : 'bg-amber-50 text-amber-700'}`} title={it.source === 'photo' ? 'Often visible in a photo (still confirm)' : 'Needs a spec sheet, sample or supplier data'}>{it.source === 'photo' ? 'Photo' : 'Document'}</span>
                {!it.required && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">If any</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-slate-600"><strong className="text-slate-800">Sizing:</strong> {t.family.sizing.note} <strong className="text-slate-800">Drawings needed:</strong> {t.family.views.join(' and ')}.</p>
      {t.protective && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900"><strong>Protective clothing.</strong> Standards to check: {t.protective.standards.join(', ')}. {t.protective.evidence}</p>
      )}
    </div>
  );
}

// Admin screen for the garment library: add types as the product range grows, rename them, move them between categories,
// reorder them, and switch them off (hidden from the new-request form; older requests keep their type).
export default function GarmentTypesAdmin() {
  const [lib, setLib] = useState<GarmentLibraryData | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [newFamily, setNewFamily] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null); // the type whose template is shown

  const load = useCallback(async () => {
    try {
      const l = await getGarmentTypes(true);
      setLib(l);
      setNewCategory((c) => c || l.categories[0]?.key || '');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the garment types.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const call = async (url: string, method: 'POST' | 'PATCH', body: unknown): Promise<boolean> => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setToast({ text: data.error || 'Something went wrong.', type: 'error' }); return false; }
    return true;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setAdding(true);
    if (await call('/api/admin/garment-types', 'POST', { label: newLabel, category: newCategory, templateFamily: newFamily })) {
      setToast({ text: `${newLabel.trim()} added.`, type: 'success' });
      setNewLabel('');
      await load();
    }
    setAdding(false);
  };

  const change = async (key: string, body: Record<string, unknown>, done?: string) => {
    setBusyKey(key);
    if (await call(`/api/admin/garment-types/${encodeURIComponent(key)}`, 'PATCH', body)) {
      if (done) setToast({ text: done, type: 'success' });
      await load();
    }
    setBusyKey(null);
  };

  const saveName = async (key: string) => {
    if (!editLabel.trim()) return;
    await change(key, { label: editLabel }, 'Name saved.');
    setEditKey(null);
  };

  if (!lib) {
    return <div className="py-20 text-center text-slate-400">{error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="inline animate-spin" size={20} />}</div>;
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/replication" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-rivix"><ArrowLeft size={16} />Back to the queue</Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900 lg:text-2xl">Garment types</h1>
        <p className="mt-1 text-sm text-slate-500">The list people choose from when they create a replication request: a category, then a garment type. Add new types as your range grows. A type you switch off is hidden from the form, and older requests keep their type.</p>
      </div>

      {!lib.editable && (
        <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This is the built-in list. To add or change types, run <strong>dev-patch-garment-types.sql</strong> once in the Supabase SQL Editor, then refresh this page.
        </p>
      )}

      <form onSubmit={add} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="block flex-1 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">New garment type</span>
          <input className={field} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Hi-Vis Rain Jacket" maxLength={80} disabled={!lib.editable} />
        </label>
        <label className="block space-y-1 sm:w-64">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Category</span>
          <select className={field} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} disabled={!lib.editable}>
            {lib.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label className="block space-y-1 sm:w-64">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Template</span>
          <select className={field} value={newFamily} onChange={(e) => setNewFamily(e.target.value)} disabled={!lib.editable}>
            <option value="">General garment</option>
            {FAMILIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
        <button disabled={!lib.editable || adding || !newLabel.trim()} className="flex h-[42px] items-center justify-center gap-2 rounded-xl bg-rivix px-5 text-sm font-bold text-white shadow-lg shadow-rivix/30 hover:bg-rivix-dark disabled:opacity-40">
          {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add
        </button>
      </form>

      {lib.categories.map((cat) => {
        const rows = lib.types.filter((t) => t.category === cat.key).sort((a, b) => a.sort - b.sort);
        return (
          <section key={cat.key} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500">{cat.label} <span className="font-medium normal-case tracking-normal text-slate-400">({rows.length})</span></h2>
            <ul className="divide-y divide-slate-100">
              {rows.map((t, i) => (
                <li key={t.key} className={`flex flex-wrap items-center gap-3 px-5 py-3 ${t.active ? '' : 'bg-slate-50/70'}`}>
                  <div className="min-w-0 flex-1">
                    {editKey === t.key ? (
                      <div className="flex items-center gap-2">
                        <input className={field} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} maxLength={80} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveName(t.key); if (e.key === 'Escape') setEditKey(null); }} />
                        <button type="button" onClick={() => saveName(t.key)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50" aria-label="Save name"><Check size={16} /></button>
                        <button type="button" onClick={() => setEditKey(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Cancel"><X size={16} /></button>
                      </div>
                    ) : (
                      <p className={`text-sm font-semibold ${t.active ? 'text-slate-800' : 'text-slate-400'}`}>{t.label}{!t.active && <span className="ml-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Off</span>}</p>
                    )}
                  </div>
                  <select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs" value={t.category} disabled={!lib.editable || busyKey === t.key} onChange={(e) => change(t.key, { category: e.target.value }, 'Moved.')} aria-label={`Category of ${t.label}`}>
                    {lib.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs" value={familyKeyFor(t.key, t.templateFamily)} disabled={!lib.editable || busyKey === t.key} onChange={(e) => change(t.key, { templateFamily: e.target.value }, 'Template changed.')} aria-label={`Template of ${t.label}`}>
                    {FAMILIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <button type="button" onClick={() => setOpenKey(openKey === t.key ? null : t.key)} aria-expanded={openKey === t.key} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:text-rivix">
                    Template <ChevronDown size={14} className={openKey === t.key ? 'rotate-180' : ''} />
                  </button>
                  <div className="flex items-center">
                    <button type="button" disabled={!lib.editable || busyKey === t.key || i === 0} onClick={() => change(t.key, { move: 'up' })} className="rounded-lg p-2 text-slate-400 hover:text-rivix disabled:opacity-30" aria-label={`Move ${t.label} up`}><ArrowUp size={15} /></button>
                    <button type="button" disabled={!lib.editable || busyKey === t.key || i === rows.length - 1} onClick={() => change(t.key, { move: 'down' })} className="rounded-lg p-2 text-slate-400 hover:text-rivix disabled:opacity-30" aria-label={`Move ${t.label} down`}><ArrowDown size={15} /></button>
                    <button type="button" disabled={!lib.editable} onClick={() => { setEditKey(t.key); setEditLabel(t.label); }} className="rounded-lg p-2 text-slate-400 hover:text-rivix disabled:opacity-30" aria-label={`Rename ${t.label}`}><Pencil size={15} /></button>
                  </div>
                  <button type="button" disabled={!lib.editable || busyKey === t.key} onClick={() => change(t.key, { active: !t.active }, t.active ? `${t.label} switched off.` : `${t.label} switched on.`)} className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${t.active ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'} disabled:opacity-50`}>
                    {busyKey === t.key ? <Loader2 size={12} className="inline animate-spin" /> : t.active ? 'On' : 'Off'}
                  </button>
                  {openKey === t.key && <div className="-mx-5 -mb-3 mt-1 w-[calc(100%+2.5rem)]"><TemplatePanel typeKey={t.key} family={t.templateFamily} /></div>}
                </li>
              ))}
              {rows.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">No garment types in this category.</li>}
            </ul>
          </section>
        );
      })}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
