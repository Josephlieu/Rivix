'use client';

// The Replication Queue: a full-width list of requests, for the two roles of this internal tool:
//  - an admin sees every request, with the sales rep who owns each and a rep filter;
//  - a sales rep sees only their own requests.
// Customers are never connected to it. Opening a request goes to its own page (.../RQ-0001).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Package, Search } from 'lucide-react';
import NewRequestDialog from './NewRequestDialog';
import { getReplications, type ReplicationRequest } from '@/lib/replicationStorage';
import { formatDate } from '@/lib/format';

const STATUS: Record<ReplicationRequest['status'], { label: string; cls: string }> = {
  received: { label: 'Received', cls: 'bg-slate-100 text-slate-600' },
  spec_mapped: { label: 'Mapped', cls: 'bg-sky-100 text-sky-700' },
  sample_production: { label: 'In production', cls: 'bg-amber-100 text-amber-700' },
  sample_shipped: { label: 'Shipped', cls: 'bg-emerald-100 text-emerald-700' },
};

// Where the specification stands: nothing yet, a draft a person has not approved, or approved.
function specState(r: ReplicationRequest): { label: string; cls: string } {
  const review = r.aiAnalysis?.review;
  if (review?.status === 'approved') return { label: `Approved${review.revision ? ` · Rev ${review.revision}` : ''}`, cls: 'bg-emerald-100 text-emerald-700' };
  if (r.aiAnalysis) return { label: 'Draft: needs review', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'Not analysed', cls: 'bg-slate-100 text-slate-500' };
}

export default function ReplicationQueue({ role }: { role: 'admin' | 'rep' }) {
  const router = useRouter();
  const isAdmin = role === 'admin';
  const basePath = isAdmin ? '/admin/replication' : '/rep/replication';
  const [requests, setRequests] = useState<ReplicationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | ReplicationRequest['status']>('all');
  const [repFilter, setRepFilter] = useState('all'); // admin only: 'all', 'none' (handled directly) or a rep id

  useEffect(() => {
    getReplications()
      .then(list => { setRequests(list); setError(''); })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load the replication requests.'))
      .finally(() => setLoading(false));
  }, []);

  const open = (r: ReplicationRequest) => router.push(`${basePath}/${encodeURIComponent(r.requestCode || r.id)}`);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter(r =>
      (status === 'all' || r.status === status) &&
      (repFilter === 'all' || (repFilter === 'none' ? !r.repId : r.repId === repFilter)) &&
      (!q || [r.requestCode, r.productName, r.clientName, r.garmentType, r.repName].some(v => (v || '').toLowerCase().includes(q)))
    );
  }, [requests, search, status, repFilter]);
  const repOptions = useMemo(() => {
    const m = new Map<string, string>();
    requests.forEach(r => { if (r.repId) m.set(r.repId, r.repName || 'Unknown rep'); });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);

  const count = (s: ReplicationRequest['status']) => requests.filter(r => r.status === s).length;
  const needsReview = requests.filter(r => r.aiAnalysis?.review?.status !== 'approved' && r.status === 'received').length;
  const dash = (n: number) => (loading ? '–' : n);

  const stats: Array<{ label: string; value: number | string; hint: string; alert?: boolean }> = [
    { label: 'Active requests', value: dash(requests.length), hint: 'all requests' },
    { label: 'Waiting for review', value: dash(needsReview), hint: 'received, spec not approved', alert: needsReview > 0 },
    { label: 'In production', value: dash(count('spec_mapped') + count('sample_production')), hint: 'mapped or being made' },
    { label: 'Shipped', value: dash(count('sample_shipped')), hint: 'sample sent' },
  ];

  const filtered = !loading && requests.length > 0 && shown.length === 0;

  return (
    <div className="space-y-6 font-sans">
      {error && (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold text-red-700 hover:text-red-900" aria-label="Dismiss">✕</button>
        </div>
      )}
      {showNew && <NewRequestDialog role={role} onClose={() => setShowNew(false)} onCreated={r => open(r)} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 lg:text-2xl">Replication Queue</h1>
          <p className="mt-1 text-xs text-slate-500">{isAdmin ? 'Garments to copy, from every sales rep: photos in, factory tech file out. Customers never see this.' : 'Your garments to copy: add the photos, run the scan, and chat with the admin. Customers never see this.'}</p>
        </div>
        <button onClick={() => setShowNew(true)} className="whitespace-nowrap rounded-xl bg-rivix px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-rivix/30 transition-all hover:bg-rivix-dark">+ New request</button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(st => (
          <div key={st.label} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{st.label}</span>
            <span className={`mt-1 block text-3xl font-black ${st.alert ? 'text-rivix' : 'text-slate-900'}`}>{st.value}</span>
            <span className="text-[10px] text-slate-400">{st.hint}</span>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by number, product or customer"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-rivix/30"
            />
          </label>
          {isAdmin && (
            <select value={repFilter} onChange={e => setRepFilter(e.target.value)} aria-label="Filter by sales rep"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rivix/30">
              <option value="all">All sales reps</option>
              <option value="none">Admin (handled directly)</option>
              {repOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)} aria-label="Filter by status"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rivix/30">
            <option value="all">All statuses</option>
            {(Object.keys(STATUS) as Array<ReplicationRequest['status']>).map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="status">
            <Loader2 size={32} className="animate-spin text-rivix" />
            <p className="text-sm font-bold text-slate-700">Loading replication requests…</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Package size={32} /></div>
            <h2 className="mt-2 text-xl font-bold text-slate-800">{error ? 'Could not load requests' : 'No replication requests yet'}</h2>
            <p className="max-w-xs text-xs leading-relaxed text-slate-400">
              {error ? 'See the message above, then refresh the page.' : 'Click “New request” to enter a customer’s garment with photos. It will appear here.'}
            </p>
            {!error && <button onClick={() => setShowNew(true)} className="mt-2 rounded-xl bg-rivix px-5 py-2 text-xs font-bold text-white shadow-lg shadow-rivix/30 hover:bg-rivix-dark">+ New request</button>}
          </div>
        ) : filtered ? (
          <div className="px-6 py-14 text-center text-sm text-slate-400">
            No requests match.{' '}
            <button onClick={() => { setSearch(''); setStatus('all'); }} className="font-bold text-rivix hover:underline">Clear filters</button>
          </div>
        ) : (
          <>
            {/* wide screens: a table */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-3">Request</th>
                  <th className="px-3 py-3">Customer</th>
                  {isAdmin && <th className="px-3 py-3">Sales rep</th>}
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Specification</th>
                  <th className="px-3 py-3">Submitted</th>
                  <th className="px-5 py-3 text-right"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const st = STATUS[r.status]; const sp = specState(r);
                  return (
                    <tr key={r.id} onClick={() => open(r)} className="cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <Link href={`${basePath}/${encodeURIComponent(r.requestCode || r.id)}`} onClick={e => e.stopPropagation()} className="font-bold text-slate-900 hover:text-rivix">{r.productName}</Link>
                        <div className="text-[11px] text-slate-400">{r.requestCode} · {r.garmentType} · {r.images.length} photo{r.images.length === 1 ? '' : 's'}</div>
                      </td>
                      <td className="px-3 py-4 text-slate-700">{r.clientName}</td>
                      {isAdmin && <td className="px-3 py-4 text-slate-700">{r.repName || <span className="text-slate-400">Admin (handled directly)</span>}</td>}
                      <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${st.cls}`}>{st.label}</span></td>
                      <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${sp.cls}`}>{sp.label}</span></td>
                      <td className="px-3 py-4 text-xs text-slate-500">{formatDate(r.submissionDate)}</td>
                      <td className="px-5 py-4 text-right text-xs font-bold text-rivix">Open →</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* phones: cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {shown.map(r => {
                const st = STATUS[r.status]; const sp = specState(r);
                return (
                  <li key={r.id}>
                    <button onClick={() => open(r)} className="flex w-full flex-col gap-2 px-4 py-4 text-left hover:bg-slate-50">
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-bold text-slate-900">{r.productName}</span>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${st.cls}`}>{st.label}</span>
                      </span>
                      <span className="text-xs text-slate-500">{r.clientName} · {r.requestCode}{isAdmin ? ` · ${r.repName || 'Admin (handled directly)'}` : ''}</span>
                      <span className="flex items-center justify-between gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${sp.cls}`}>{sp.label}</span>
                        <span className="text-[11px] text-slate-400">{formatDate(r.submissionDate)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
