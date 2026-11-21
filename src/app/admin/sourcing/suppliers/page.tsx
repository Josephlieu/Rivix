'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SUPPLIER_SPEC } from '@/lib/catalog-fields';
import { SpecForm, api, asText, card, input, ErrorText } from '../ui';

type Supplier = Record<string, unknown> & { id: string; code: string; name: string; active: boolean; productCount: number };
export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => { api<{ suppliers: Supplier[] }>('/api/admin/suppliers').then((r) => { if (r.ok) setRows(r.data.suppliers); else setError(r.error); }); }, []);
  useEffect(() => { load(); }, [load]);
  const shown = (rows ?? []).filter((s) => !q.trim() || `${s.name} ${s.code}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input className={`${input} max-w-xs`} placeholder="Search name or code" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="text-sm font-bold text-rivix" onClick={() => setAdding((x) => !x)}>{adding ? 'Close' : 'New supplier'}</button>
      </div>
      {adding && (
        <div className={card}>
          <SpecForm fields={SUPPLIER_SPEC.filter((f) => f.column !== 'active')} submitLabel="Create supplier" onSubmit={async (v) => {
            const r = await api('/api/admin/suppliers', 'POST', v); if (!r.ok) return r.error; setAdding(false); load(); return null;
          }} />
        </div>
      )}
      <ErrorText error={error} />
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr><th className="p-3">Code</th><th className="p-3">Supplier</th><th className="p-3">Country</th><th className="p-3">Categories</th><th className="p-3">MOQ</th><th className="p-3">Lead time</th><th className="p-3">Products</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {rows === null && <tr><td colSpan={8} className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {rows !== null && !shown.length && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No suppliers yet.</td></tr>}
            {shown.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="p-3 font-mono text-xs">{s.code}</td>
                <td className="p-3 font-semibold"><Link className="text-rivix" href={`/admin/sourcing/suppliers/${s.id}`}>{s.name}</Link></td>
                <td className="p-3">{asText(s.country)}</td>
                <td className="p-3">{asText(s.categories)}</td>
                <td className="p-3">{s.moq === null ? '' : `${asText(s.moq)} ${asText(s.moq_unit)}`}</td>
                <td className="p-3">{s.lead_time_days === null ? '' : `${asText(s.lead_time_days)} days`}</td>
                <td className="p-3">{s.productCount}</td>
                <td className="p-3">{s.active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
