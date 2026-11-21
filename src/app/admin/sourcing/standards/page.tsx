'use client';
import { useCallback, useEffect, useState } from 'react';
import { STANDARD_SPEC } from '@/lib/catalog-fields';
import { SpecForm, api, asText, btnGhost, card, ErrorText } from '../ui';

type Std = Record<string, unknown> & { id: string; designation: string; checked: boolean; checked_by_email: string | null; claimCount: number; certificateCount: number };
export default function StandardsPage() {
  const [rows, setRows] = useState<Std[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => { api<{ standards: Std[] }>('/api/admin/standards').then((r) => { if (r.ok) setRows(r.data.standards); else setError(r.error); }); }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (url: string, method: string, body?: unknown) => { const r = await api(url, method, body); if (!r.ok) setError(r.error); else { setError(null); load(); } };
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">One row per edition, written in full (e.g. "EN 388:2016+A1:2018"). The import matches this text ignoring case and spaces. A claim against an unchecked standard shows "Standard not checked".</p>
      <button className="text-sm font-bold text-rivix" onClick={() => setAdding((x) => !x)}>{adding ? 'Close' : 'Add a standard'}</button>
      {adding && <div className={card}><SpecForm fields={STANDARD_SPEC} submitLabel="Add (unchecked)" onSubmit={async (v) => { const r = await api('/api/admin/standards', 'POST', v); if (!r.ok) return r.error; setAdding(false); load(); return null; }} /></div>}
      <ErrorText error={error} />
      {(rows ?? []).map((s) => (
        <div key={s.id} className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold">{s.designation}</span>
            <span className={`text-xs font-bold ${s.checked ? 'text-emerald-700' : 'text-slate-500'}`}>{s.checked ? `Checked ${asText(s.checked_on)} by ${s.checked_by_email}` : 'Not checked'}</span>
            <span className="text-xs text-slate-500">{s.claimCount} claim(s) · {s.certificateCount} certificate(s){(s.provinces as string[])?.length ? ` · accepted in ${(s.provinces as string[]).join(', ')}` : ''}</span>
            <button className={btnGhost} onClick={() => setEdit(edit === s.id ? null : s.id)}>{edit === s.id ? 'Close' : 'Edit'}</button>
            <button className={btnGhost} onClick={() => act(`/api/admin/standards/${s.id}`, 'PATCH', { checked: !s.checked })}>{s.checked ? 'Mark not checked' : 'Mark checked'}</button>
            {!s.claimCount && !s.certificateCount && <button className={btnGhost} onClick={() => window.confirm(`Delete ${s.designation}?`) && act(`/api/admin/standards/${s.id}`, 'DELETE')}>Delete</button>}
          </div>
          {edit === s.id && <SpecForm fields={STANDARD_SPEC} initial={s} submitLabel="Save" onSubmit={async (v) => { const r = await api(`/api/admin/standards/${s.id}`, 'PATCH', v); if (!r.ok) return r.error; setEdit(null); load(); return null; }} />}
        </div>
      ))}
    </div>
  );
}
