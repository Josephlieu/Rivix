'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import LocalDate from '@/components/LocalDate';

// Audit log (2026-11-21): read-only. Who did what to which record, when, and what changed. Admins only (the route checks the
// two-step sign-in; customers and reps have no rights on the table). Nothing on this page can change or remove a row.
type Row = {
  id: number; at: string; actor_user_id: string | null; actor_role: string; actor_email: string | null; action: string;
  record_table: string; record_id: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; route: string; note: string | null;
};
const TABLES = ['account_change_requests', 'auth.mfa_factors', 'auth.users', 'catalogs', 'documents', 'garment_categories', 'garment_types', 'order_requests', 'orders',
  'product_specs', 'rep_invites', 'replication_customer_approvals', 'replications', 'reps', 'templates'];
const input = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rivix/20';
const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));
function Changes({ before, after }: { before: Row['before']; after: Row['after'] }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  if (!keys.length) return <span className="text-slate-300">—</span>;
  return (
    <ul className="space-y-0.5">
      {keys.map((k) => (
        <li key={k} className="break-words">
          <span className="font-semibold text-slate-600">{k}</span>: {before && k in before ? <span className="text-slate-400 line-through decoration-slate-300">{show(before[k])}</span> : null}
          {before && k in before && after && k in after ? ' → ' : null}
          {after && k in after ? <span className="text-slate-800">{show(after[k])}</span> : null}
        </li>
      ))}
    </ul>
  );
}

// The start or end of a local day, as an ISO time for the route.
const dayEdge = (d: string, end: boolean) => (d ? new Date(`${d}T${end ? '23:59:59.999' : '00:00:00'}`).toISOString() : '');

type Filters = { user: string; action: string; table: string; record: string; from: string; to: string };
type Page = { rows: Row[]; total: number; pageSize: number; actions: { key: string; label: string }[] };
type Answer = { ok: true; data: Page } | { ok: false; error: string };
const EMPTY: Filters = { user: '', action: '', table: '', record: '', from: '', to: '' };

async function fetchPage(f: Filters, p: number): Promise<Answer> {
  const q = new URLSearchParams();
  if (f.user.trim()) q.set('user', f.user.trim());
  if (f.action) q.set('action', f.action);
  if (f.table) q.set('table', f.table);
  if (f.record.trim()) q.set('record', f.record.trim());
  if (f.from) q.set('from', dayEdge(f.from, false));
  if (f.to) q.set('to', dayEdge(f.to, true));
  q.set('page', String(p));
  try {
    const r = await fetch(`/api/admin/audit-log?${q}`);
    const d = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, data: d as Page } : { ok: false, error: d.error || 'Could not load the audit log.' };
  } catch {
    return { ok: false, error: 'Could not load the audit log.' };
  }
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetching is separate from showing, so state is only set once the answer arrives.
  const show = useCallback((r: Answer) => {
    if (!r.ok) setError(r.error); else { setError(null); setData(r.data); }
    setLoading(false);
  }, []);
  const load = useCallback((f: Filters, p: number) => { fetchPage(f, p).then(show); }, [show]);
  useEffect(() => { fetchPage(EMPTY, 0).then(show); }, [show]);

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const apply = (e: React.FormEvent) => { e.preventDefault(); setLoading(true); setPage(0); load(filters, 0); };
  const clear = () => { const f = EMPTY; setFilters(f); setLoading(true); setPage(0); load(f, 0); };
  const go = (p: number) => { setLoading(true); setPage(p); load(filters, p); };
  const labelOf = (a: string) => data?.actions.find((x) => x.key === a)?.label ?? a;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-rivix/10 text-rivix"><ScrollText size={22} /></div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Audit log</h1>
          <p className="text-sm text-slate-500">Every important action: who, what, which record, when and what changed. Read-only; rows are never edited or deleted. Kept 7 years.</p>
        </div>
      </div>

      <form onSubmit={apply} className="bg-white rounded-2xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
        <label className="space-y-1 lg:col-span-2"><span className={label}>User (email or id)</span><input className={input} value={filters.user} onChange={set('user')} placeholder="name@company.com" /></label>
        <label className="space-y-1"><span className={label}>Action</span>
          <select className={input} value={filters.action} onChange={set('action')}>
            <option value="">All actions</option>
            {(data?.actions ?? []).map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className={label}>Record type</span>
          <select className={input} value={filters.table} onChange={set('table')}>
            <option value="">All</option>
            {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="space-y-1 lg:col-span-2"><span className={label}>Record id</span><input className={input} value={filters.record} onChange={set('record')} placeholder="exact id or key" /></label>
        <label className="space-y-1"><span className={label}>From</span><input type="date" className={input} value={filters.from} onChange={set('from')} /></label>
        <label className="space-y-1"><span className={label}>To</span><input type="date" className={input} value={filters.to} onChange={set('to')} /></label>
        <div className="flex gap-2 lg:col-span-4 justify-end">
          <button type="button" onClick={clear} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">Clear</button>
          <button type="submit" className="px-4 py-2 rounded-xl text-sm font-bold bg-rivix text-white">Show</button>
        </div>
      </form>

      {error && <p className="flex items-center gap-2 text-sm text-red-600"><AlertCircle size={16} />{error}</p>}
      {loading && <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="animate-spin" size={16} />Loading…</p>}

      {data && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm" data-testid="audit-table">
            <thead className="bg-slate-50 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Record</th><th className="p-3">Changes</th></tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Nothing matches these filters.</td></tr>}
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 whitespace-nowrap text-slate-600"><LocalDate value={r.at} time /></td>
                  <td className="p-3"><div className="font-semibold text-slate-800 break-all">{r.actor_email || (r.actor_role === 'system' ? 'System (script)' : r.actor_user_id)}</div><div className="text-xs text-slate-400">{r.actor_role}</div></td>
                  <td className="p-3"><div className="font-semibold text-slate-800">{labelOf(r.action)}</div><div className="text-xs text-slate-400 break-all">{r.route}</div></td>
                  <td className="p-3 text-xs"><div className="text-slate-600">{r.record_table}</div><div className="text-slate-400 break-all">{r.record_id}</div></td>
                  <td className="p-3 text-xs text-slate-600"><Changes before={r.before} after={r.after} />{r.note ? <div className="mt-1 text-slate-500 italic break-words">Note: {r.note}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between p-3 border-t border-slate-100 text-xs text-slate-500">
            <span>{data.total} row{data.total === 1 ? '' : 's'}</span>
            <span className="flex items-center gap-2">
              <button type="button" disabled={page === 0} onClick={() => go(page - 1)} className="p-1 rounded disabled:opacity-30" aria-label="Previous page"><ChevronLeft size={16} /></button>
              Page {page + 1} of {pages}
              <button type="button" disabled={page + 1 >= pages} onClick={() => go(page + 1)} className="p-1 rounded disabled:opacity-30" aria-label="Next page"><ChevronRight size={16} /></button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
