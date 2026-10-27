'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, ArrowDown, Check, Loader2, Pencil, Plus, X } from 'lucide-react';
import Toast, { type ToastMessage } from '@/components/Toast';
import { getGarmentTypes, type GarmentLibraryData } from '@/lib/replicationStorage';

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-rivix/40 focus:outline-none focus:ring-2 focus:ring-rivix/10';

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
    if (await call('/api/admin/garment-types', 'POST', { label: newLabel, category: newCategory })) {
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
                  <div className="flex items-center">
                    <button type="button" disabled={!lib.editable || busyKey === t.key || i === 0} onClick={() => change(t.key, { move: 'up' })} className="rounded-lg p-2 text-slate-400 hover:text-rivix disabled:opacity-30" aria-label={`Move ${t.label} up`}><ArrowUp size={15} /></button>
                    <button type="button" disabled={!lib.editable || busyKey === t.key || i === rows.length - 1} onClick={() => change(t.key, { move: 'down' })} className="rounded-lg p-2 text-slate-400 hover:text-rivix disabled:opacity-30" aria-label={`Move ${t.label} down`}><ArrowDown size={15} /></button>
                    <button type="button" disabled={!lib.editable} onClick={() => { setEditKey(t.key); setEditLabel(t.label); }} className="rounded-lg p-2 text-slate-400 hover:text-rivix disabled:opacity-30" aria-label={`Rename ${t.label}`}><Pencil size={15} /></button>
                  </div>
                  <button type="button" disabled={!lib.editable || busyKey === t.key} onClick={() => change(t.key, { active: !t.active }, t.active ? `${t.label} switched off.` : `${t.label} switched on.`)} className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${t.active ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'} disabled:opacity-50`}>
                    {busyKey === t.key ? <Loader2 size={12} className="inline animate-spin" /> : t.active ? 'On' : 'Off'}
                  </button>
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
