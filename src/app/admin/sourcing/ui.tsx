'use client';
// Supplier and product records (2026-11-21): shared pieces for the admin Sourcing pages. Every page reads and writes
// through the admin routes (two-step admins only); nothing here talks to the database directly.
import { useState } from 'react';
import type { FieldSpec } from '@/lib/catalog-fields';
import { CLAIM_LABEL, type ClaimStatus } from '@/lib/compliance';

export const input = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rivix/20';
export const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';
export const btn = 'px-4 py-2 rounded-xl text-sm font-bold bg-rivix text-white disabled:opacity-40';
export const btnGhost = 'px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40';
export const card = 'bg-white rounded-2xl border border-slate-200 p-4 space-y-3';

export type Answer<T> = { ok: true; data: T } | { ok: false; error: string };
export async function api<T = Record<string, unknown>>(url: string, method = 'GET', body?: unknown): Promise<Answer<T>> {
  try {
    const r = await fetch(url, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: (d as { error?: string }).error || `The request failed (${r.status}).` };
    if ((d as { auditWarning?: string }).auditWarning) window.alert((d as { auditWarning: string }).auditWarning);
    return { ok: true, data: d as T };
  } catch {
    return { ok: false, error: 'The request failed. Check the connection and try again.' };
  }
}

/** A value as text in a form (lists as "a; b"). */
export const asText = (v: unknown) => (v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));

/** A form built from a field spec. `extra` adds fields the spec does not describe (e.g. the category list). */
export function SpecForm({ fields, initial, onSubmit, submitLabel, options = {} }: {
  fields: FieldSpec[]; initial?: Record<string, unknown>; submitLabel: string;
  options?: Record<string, Array<{ value: string; label: string }>>;
  onSubmit: (values: Record<string, string>) => Promise<string | null>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.column, asText(initial?.[f.column])])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setValues((x) => ({ ...x, [k]: v }));
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      const changed = initial ? Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== asText(initial[k]))) : values;
      const err = await onSubmit(changed); setBusy(false); setError(err);
    }}>
      {fields.map((f) => {
        const k = f.kind, opts = options[f.column];
        const control = opts ? (
          <select className={input} value={values[f.column]} onChange={(e) => set(f.column, e.target.value)}>
            <option value="">—</option>
            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : k.t === 'bool' ? (
          <select className={input} value={values[f.column]} onChange={(e) => set(f.column, e.target.value)}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select>
        ) : k.t === 'enum' ? (
          <select className={input} value={values[f.column]} onChange={(e) => set(f.column, e.target.value)}><option value="">—</option>{k.values.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select>
        ) : k.t === 'date' ? (
          <input type="date" className={input} value={values[f.column]} onChange={(e) => set(f.column, e.target.value)} />
        ) : (k.t === 'text' && k.max > 500) ? (
          <textarea className={input} rows={2} value={values[f.column]} onChange={(e) => set(f.column, e.target.value)} />
        ) : (
          <input className={input} value={values[f.column]} onChange={(e) => set(f.column, e.target.value)} placeholder={k.t === 'list' || k.t === 'provinces' ? 'separate with ;' : ''} />
        );
        return <label key={f.column} className="space-y-1"><span className={label}>{f.label}{k.t === 'text' && k.required ? ' *' : ''}</span>{control}</label>;
      })}
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
        <button className={btn} disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

const TONE: Record<ClaimStatus, string> = { compliant: 'bg-emerald-50 text-emerald-700', expired: 'bg-red-50 text-red-700', certificate_needed: 'bg-amber-50 text-amber-800', standard_not_checked: 'bg-slate-100 text-slate-600' };
export const StatusBadge = ({ status }: { status: ClaimStatus }) => <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${TONE[status]}`}>{CLAIM_LABEL[status]}</span>;
export const WarningBadge = ({ w, days }: { w: string | null; days: number | null }) => !w ? null : (
  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${w === 'expired' ? 'bg-red-50 text-red-700' : w === 'within_30' ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-800'}`}>
    {w === 'expired' ? `Expired ${days !== null ? `${-days} day(s) ago` : ''}` : `Expires in ${days} day(s)`}
  </span>
);
export const ErrorText = ({ error }: { error: string | null }) => (error ? <p className="text-sm text-red-600">{error}</p> : null);
