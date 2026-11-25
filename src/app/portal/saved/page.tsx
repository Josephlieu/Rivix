'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { PRICE_ON_QUOTE } from '@/lib/catalog-families';
import type { FamilyView } from '@/lib/catalog-public';

// The customer's saved list (2026-11-26): their own saved families that are still published.
export default function SavedPage() {
  const [rows, setRows] = useState<FamilyView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch('/api/portal/saved'); const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'Could not load your saved list.'); setRows([]); return; }
    setRows(d.families || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Saved</h1>
        <p className="text-slate-500">Products you saved for later. {PRICE_ON_QUOTE}.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows === null && <p className="text-sm text-slate-400">Loading…</p>}
      {rows !== null && !rows.length && !error && <p className="text-sm text-slate-500">Nothing saved yet. <Link className="text-rivix font-semibold" href="/portal/browse">Browse products</Link>.</p>}
      <div className="space-y-2">
        {(rows ?? []).map((f) => (
          <div key={f.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-3">
            <Link href={`/portal/browse/${f.id}`} className="font-bold text-slate-900">{f.name} <span className="text-xs font-semibold text-slate-400">{f.code}</span> <span className="block text-xs font-normal text-slate-500">{f.categoryLabel}</span></Link>
            <button onClick={async () => { const r = await fetch(`/api/portal/saved/${f.id}`, { method: 'DELETE' }); if (r.ok) load(); else setError('Could not remove it.'); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 inline-flex items-center gap-1"><Heart size={14} className="fill-rivix text-rivix" />Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
