'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PRODUCT_SPEC } from '@/lib/catalog-fields';
import type { ClaimStatus } from '@/lib/compliance';
import { SpecForm, StatusBadge, api, asText, card, input, ErrorText } from '../ui';

type Product = Record<string, unknown> & { id: string; code: string | null; name: string; active: boolean; claims: Record<ClaimStatus, number> };
type Data = { products: Product[]; categories: Array<{ key: string; label: string }> };
export default function ProductsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => { api<Data>('/api/admin/products-catalog').then((r) => { if (r.ok) setD(r.data); else setError(r.error); }); }, []);
  useEffect(() => { load(); }, [load]);
  const cat = (k: unknown) => d?.categories.find((c) => c.key === k)?.label ?? asText(k);
  const shown = (d?.products ?? []).filter((p) => !q.trim() || `${p.name} ${p.code ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input className={`${input} max-w-xs`} placeholder="Search name or code" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="text-sm font-bold text-rivix" onClick={() => setAdding((x) => !x)}>{adding ? 'Close' : 'New product'}</button>
      </div>
      {adding && d && (
        <div className={card}>
          <SpecForm fields={PRODUCT_SPEC.filter((f) => f.column !== 'active')} options={{ category: d.categories.map((c) => ({ value: c.key, label: c.label })) }} submitLabel="Create product" onSubmit={async (v) => {
            const r = await api('/api/admin/products-catalog', 'POST', v); if (!r.ok) return r.error; setAdding(false); load(); return null;
          }} />
        </div>
      )}
      <ErrorText error={error} />
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr><th className="p-3">Code</th><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3">Sourcing</th><th className="p-3">Standards claimed</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {d === null && <tr><td colSpan={6} className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {d !== null && !shown.length && <tr><td colSpan={6} className="p-6 text-center text-slate-400">No products yet.</td></tr>}
            {shown.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 align-top">
                <td className="p-3 font-mono text-xs">{asText(p.code)}</td>
                <td className="p-3 font-semibold"><Link className="text-rivix" href={`/admin/sourcing/products/${p.id}`}>{p.name}</Link>{p.brand ? <div className="text-xs text-slate-500">{asText(p.brand)}</div> : null}</td>
                <td className="p-3">{cat(p.category)}</td>
                <td className="p-3">{p.sourcing === 'resold_brand' ? 'Resold brand' : 'Made to spec'}</td>
                <td className="p-3 space-x-1">{(Object.entries(p.claims) as Array<[ClaimStatus, number]>).filter(([, n]) => n).map(([s, n]) => <span key={s} className="inline-flex items-center gap-1"><StatusBadge status={s} /> ×{n}</span>)}</td>
                <td className="p-3">{p.active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
