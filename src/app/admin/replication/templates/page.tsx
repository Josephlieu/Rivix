'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Loader2 } from 'lucide-react';
import Toast, { type ToastMessage } from '@/components/Toast';
import { CERT_WORDS } from '@/lib/template-admin';
import type { CertificationLevel } from '@/lib/template-catalog';

// Task 31: the templates (two-step admins only). Each one: its kind, current version, where it is used, whether it has a
// drawing. Templates are copied, then changed by publishing a new version; never edited in place, never deleted (switched off).
interface Row { key: string; kind: 'base' | 'family' | 'module'; label: string; description: string; version: number; active: boolean; drawing: boolean; certification?: CertificationLevel; usage: { types: Array<{ key: string; label: string }>; categories: Array<{ key: string; label: string }>; kits: string[] } }
interface Change { id: string; kind: string; key: string; action: string; changes: string[]; note: string; by: string; at: string }
const KIND: Record<Row['kind'], string> = { family: 'Garment and product templates', module: 'Add-ons', base: 'Base templates (fields every product in a category gets)' };
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rivix/20';

export default function TemplatesAdmin() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [log, setLog] = useState<Change[]>([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [from, setFrom] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([fetch('/api/admin/templates', { cache: 'no-store' }), fetch('/api/admin/catalog-changes', { cache: 'no-store' })]);
    const tj = await t.json().catch(() => ({})), cj = await c.json().catch(() => ({}));
    if (!t.ok) { setError(tj.error || 'Could not load the templates.'); return; }
    setRows(tj.templates); setLog(cj.changes ?? []); setError('');
  }, []);
  useEffect(() => { load(); }, [load]);

  const copy = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('copy');
    const res = await fetch('/api/admin/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromKey: from, label: name }) });
    const j = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) { setToast({ text: j.error || 'Could not copy the template.', type: 'error' }); return; }
    router.push(`/admin/replication/templates/${encodeURIComponent(j.key)}`);
  };
  const toggle = async (r: Row) => {
    setBusy(r.key);
    const res = await fetch(`/api/admin/templates/${encodeURIComponent(r.key)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !r.active }) });
    const j = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) setToast({ text: j.error || 'Could not change it.', type: 'error' });
    else { setToast({ text: j.warning || (r.active ? `${r.label} switched off.` : `${r.label} switched on.`), type: j.warning ? 'error' : 'success' }); await load(); }
  };

  if (!rows) return <div className="py-20 text-center text-slate-400">{error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="inline animate-spin" size={20} />}</div>;
  return (
    <div className="space-y-6">
      <Link href="/admin/replication/garment-types" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-rivix"><ArrowLeft size={16} />Back to garment types</Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900 lg:text-2xl">Templates</h1>
        <p className="mt-1 text-sm text-slate-500">What a tech file asks for, by product. To change a template, publish a new version: existing tech files keep the version they were made with. A new template starts as a copy of an existing one. Nothing is ever deleted; a template that is off is not offered for new product types. Every change is in the change log below.</p>
      </div>

      <form onSubmit={copy} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="block space-y-1 sm:w-72"><span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Copy this template</span>
          <select className={field} value={from} onChange={(e) => setFrom(e.target.value)} required><option value="">Choose…</option>{rows.map((r) => <option key={r.key} value={r.key}>{r.label} ({r.kind === 'module' ? 'add-on' : r.kind}, v{r.version})</option>)}</select></label>
        <label className="block flex-1 space-y-1"><span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Name of the new template</span><input className={field} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Long winter parka" /></label>
        <button disabled={busy === 'copy' || !from || !name.trim()} className="flex h-[38px] items-center justify-center gap-2 rounded-xl bg-rivix px-5 text-sm font-bold text-white disabled:opacity-40"><Copy size={15} /> Copy and edit</button>
      </form>

      {(['family', 'module', 'base'] as const).map((kind) => (
        <section key={kind} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500">{KIND[kind]}</h2>
          <ul className="divide-y divide-slate-100">
            {rows.filter((r) => r.kind === kind).map((r) => {
              const used = r.usage.types.length + r.usage.categories.length + r.usage.kits.length;
              return (
                <li key={r.key} className={`flex flex-wrap items-center gap-3 px-5 py-3 text-sm ${r.active ? '' : 'bg-slate-50/70 text-slate-400'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.label} <span className="font-mono text-[11px] font-normal text-slate-400">{r.key} · v{r.version}</span>{!r.active && <span className="ml-2 text-[11px] font-bold uppercase tracking-widest">Off</span>}</p>
                    <p className="text-[12px] text-slate-500">
                      {used ? `Used by ${[r.usage.types.length && `${r.usage.types.length} product type${r.usage.types.length > 1 ? 's' : ''}`, r.usage.categories.length && `${r.usage.categories.length} categor${r.usage.categories.length > 1 ? 'ies' : 'y'}`, r.usage.kits.length && `${r.usage.kits.length} set${r.usage.kits.length > 1 ? 's' : ''}`].filter(Boolean).join(', ')}` : 'Not used yet'}
                      {r.kind === 'family' && <> · {r.drawing ? 'Drawing available' : 'Drawing not available yet'}</>}
                      {r.certification && <> · {CERT_WORDS[r.certification]}</>}
                    </p>
                  </div>
                  <Link href={`/admin/replication/templates/${encodeURIComponent(r.key)}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-rivix hover:text-rivix">Open</Link>
                  <button type="button" disabled={busy === r.key} onClick={() => toggle(r)} className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${r.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'} disabled:opacity-50`}>{r.active ? 'On' : 'Off'}</button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="space-y-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Change log</h2>
        {log.length === 0 && <p className="text-sm text-slate-400">No changes recorded yet.</p>}
        {log.map((c) => (
          <div key={c.id} className="border-t border-slate-100 pt-2 text-[13px] first:border-0 first:pt-0">
            <p><span className="font-bold text-slate-800">{c.kind === 'type' ? 'Product type' : c.kind === 'category' ? 'Category' : 'Template'} {c.key}</span>: {c.action} <span className="text-slate-400">· {c.by} · {new Date(c.at).toLocaleString()}</span></p>
            {c.changes.length > 0 && <ul className="list-disc pl-5 text-slate-600">{c.changes.slice(0, 8).map((x, i) => <li key={i}>{x}</li>)}{c.changes.length > 8 && <li>…and {c.changes.length - 8} more</li>}</ul>}
            {c.note && <p className="whitespace-pre-wrap text-slate-500">Note: {c.note}</p>}
          </div>
        ))}
      </section>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
