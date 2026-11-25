'use client';

import { useCallback, useEffect, useState } from 'react';
import LocalDate from '@/components/LocalDate';
import SpecText from '@/components/catalog/SpecText';
import type { Spec } from '@/lib/catalog-families';

type Sample = {
  id: string; familyCode: string; familyName: string; spec: Partial<Spec>; quantity: number; note: string | null; status: 'open' | 'sent' | 'declined';
  decidedBy: string | null; decidedAt: string | null; declineReason: string | null; createdAt: string; company?: string; customerCode?: string;
};

// Sample requests (2026-11-26). `endpoint` decides whose: /api/portal/sample-requests (the customer's own, no actions),
// /api/rep/sample-requests (the rep's own customers) or /api/admin/sample-requests (everyone). Reps and admins can mark an
// open one sent, or decline it with a reason. Everything the customer typed is shown as plain text.
export default function SampleRequests({ endpoint, canDecide, title = 'Sample requests' }: { endpoint: string; canDecide: boolean; title?: string }) {
  const [rows, setRows] = useState<Sample[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(endpoint); const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'Could not load the sample requests.'); setRows([]); return; }
    setRows(d.samples || []);
  }, [endpoint]);
  useEffect(() => { load(); }, [load]);
  const decide = async (id: string, action: 'sent' | 'decline') => {
    setBusy(true); setError(null);
    const r = await fetch(`/api/sample-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error || 'Could not save.'); return; }
    if (d.auditWarning) window.alert(d.auditWarning);
    setDeclining(null); setReason(''); load();
  };
  return (
    <section className="space-y-3" data-testid="sample-requests">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows === null && <p className="text-sm text-slate-400">Loading…</p>}
      {rows !== null && !rows.length && <p className="text-sm text-slate-400">No sample requests.</p>}
      {(rows ?? []).map((s) => (
        <div key={s.id} className={`rounded-2xl border p-4 space-y-2 ${s.status === 'open' ? 'border-amber-100 bg-white' : 'border-slate-100 bg-slate-50/40'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-slate-900">
              {s.company ? <>{s.company} <span className="text-xs font-semibold text-slate-400">{s.customerCode}</span> · </> : null}
              {s.familyName} <span className="text-xs font-semibold text-slate-400">{s.familyCode}</span>: {s.quantity} sample{s.quantity === 1 ? '' : 's'}
            </p>
            <span className="text-[11px] text-slate-400"><LocalDate value={s.createdAt} time /></span>
          </div>
          <SpecText spec={s.spec} className="text-xs text-slate-500" />
          {s.note && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 whitespace-pre-line break-words">Note: {s.note}</p>}
          {s.status === 'open' && <p className="text-xs font-semibold text-amber-700">Waiting for the sales rep or RIVIX</p>}
          {s.status === 'sent' && <p className="text-xs font-semibold text-emerald-700">Sent{s.decidedAt ? <> on <LocalDate value={s.decidedAt} /></> : null}</p>}
          {s.status === 'declined' && <p className="text-xs font-semibold text-red-600 break-words">Declined{s.declineReason ? `: ${s.declineReason}` : ''}</p>}
          {canDecide && s.status === 'open' && (declining === s.id ? (
            <div className="flex flex-wrap items-center gap-2">
              <input autoFocus maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (the customer sees this)" className="flex-1 min-w-[12rem] px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm" />
              <button onClick={() => decide(s.id, 'decline')} disabled={busy || !reason.trim()} className="px-4 py-2 rounded-xl border border-red-100 bg-white text-red-600 text-xs font-bold disabled:opacity-50">Decline</button>
              <button onClick={() => { setDeclining(null); setReason(''); }} className="px-3 py-2 text-xs font-bold text-slate-500">Cancel</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => decide(s.id, 'sent')} disabled={busy} className="px-4 py-2 rounded-xl bg-rivix text-white text-xs font-bold disabled:opacity-50">Mark sent</button>
              <button onClick={() => setDeclining(s.id)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold">Decline…</button>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
