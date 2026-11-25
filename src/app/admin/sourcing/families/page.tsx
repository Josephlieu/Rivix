'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, btn, card, input, label, ErrorText } from '../ui';

type Fam = { id: string; code: string; name: string; category: string; visible_to_customers: boolean; active: boolean; images: number; products: number };
// Product families (2026-11-26): what customers browse. A new family is hidden until it is published on its page.
export default function FamiliesPage() {
  const [rows, setRows] = useState<Fam[] | null>(null);
  const [cats, setCats] = useState<Array<{ key: string; label: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({ code: '', name: '', category: '' });
  const load = useCallback(() => { api<{ families: Fam[]; categories: Array<{ key: string; label: string }> }>('/api/admin/families').then((r) => { if (r.ok) { setRows(r.data.families); setCats(r.data.categories); } else setError(r.error); }); }, []);
  useEffect(() => { load(); }, [load]);
  const label_ = (k: string) => cats.find((c) => c.key === k)?.label ?? k;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Families are what customers see in Browse products: a description, images, typical options and the standards a family can be made to. Supplier products stay here, linked to a family from the product page.</p>
      <div className={card}>
        <h3 className="font-bold">New family</h3>
        <form className="grid gap-3 sm:grid-cols-4 items-end" onSubmit={async (e) => {
          e.preventDefault();
          const r = await api<{ family: { id: string } }>('/api/admin/families', 'POST', v);
          if (!r.ok) { setError(r.error); return; }
          setError(null); setV({ code: '', name: '', category: '' }); load();
        }}>
          <label className="space-y-1"><span className={label}>Code</span><input className={input} placeholder="FR-COV" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} /></label>
          <label className="space-y-1"><span className={label}>Name</span><input className={input} placeholder="FR coverall" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
          <label className="space-y-1"><span className={label}>Category</span><select className={input} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}><option value="">Choose…</option>{cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          <button className={btn}>Create (hidden)</button>
        </form>
      </div>
      <ErrorText error={error} />
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="p-3">Family</th><th className="p-3">Category</th><th className="p-3">Customers</th><th className="p-3">Images</th><th className="p-3">Products</th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {rows !== null && !rows.length && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No families yet.</td></tr>}
            {(rows ?? []).map((f) => (
              <tr key={f.id} className="border-t border-slate-100">
                <td className="p-3"><Link className="text-rivix font-semibold" href={`/admin/sourcing/families/${f.id}`}>{f.code} {f.name}</Link>{!f.active && <span className="ml-2 text-xs text-slate-400">(off)</span>}</td>
                <td className="p-3">{label_(f.category)}</td>
                <td className="p-3">{f.visible_to_customers && f.active ? <span className="text-emerald-700 font-bold">Published</span> : <span className="text-slate-400">Hidden</span>}</td>
                <td className="p-3">{f.images}</td>
                <td className="p-3">{f.products}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
