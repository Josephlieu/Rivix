'use client';
import { useEffect, useState } from 'react';
import { api, btn, card, input, label, ErrorText } from '../ui';

type S = { min_order_qty: number; note_below_qty: number; updated_at?: string; updated_by_email?: string | null };
// Catalogue settings (2026-11-26): the customer minimum per line (1 to 50; never block above 50) and the gentle-note level.
export default function CatalogSettingsPage() {
  const [s, setS] = useState<S | null>(null);
  const [v, setV] = useState({ min_order_qty: '', note_below_qty: '' });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { api<{ settings: S }>('/api/admin/catalog-settings').then((r) => { if (r.ok) { setS(r.data.settings); setV({ min_order_qty: String(r.data.settings.min_order_qty), note_below_qty: String(r.data.settings.note_below_qty) }); } else setError(r.error); }); }, []);
  if (!s) return <ErrorText error={error ?? 'Loading…'} />;
  return (
    <div className={card}>
      <h3 className="font-bold">Customer minimum</h3>
      <p className="text-sm text-slate-600">Per product line in a quote cart. Below the minimum is refused; below the note level the customer sees a gentle note that small runs can cost more. The minimum can be 1 to 50.</p>
      <form className="grid gap-3 sm:grid-cols-3 items-end" onSubmit={async (e) => {
        e.preventDefault(); setSaved(false);
        const r = await api<{ settings: S }>('/api/admin/catalog-settings', 'PATCH', { min_order_qty: Number(v.min_order_qty), note_below_qty: Number(v.note_below_qty) });
        if (!r.ok) { setError(r.error); return; }
        setError(null); setS(r.data.settings); setSaved(true);
      }}>
        <label className="space-y-1"><span className={label}>Minimum per line</span><input type="number" min={1} max={50} className={input} value={v.min_order_qty} onChange={(e) => setV({ ...v, min_order_qty: e.target.value })} /></label>
        <label className="space-y-1"><span className={label}>Gentle note below</span><input type="number" min={1} className={input} value={v.note_below_qty} onChange={(e) => setV({ ...v, note_below_qty: e.target.value })} /></label>
        <button className={btn}>Save</button>
      </form>
      <ErrorText error={error} />
      {saved && <p className="text-sm text-emerald-700">Saved.</p>}
      {s.updated_by_email && <p className="text-xs text-slate-400">Last changed by {s.updated_by_email}.</p>}
    </div>
  );
}
