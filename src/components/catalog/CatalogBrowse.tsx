'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { PRICE_ON_QUOTE } from '@/lib/catalog-families';
import type { FamilyView } from '@/lib/catalog-public';

// The catalogue list (2026-11-26), for customers (/portal/browse) and reps (/rep/browse): published families grouped by
// RIVIX category, with a search by name or code and a category filter. No prices: "Price on quote".
export default function CatalogBrowse({ basePath }: { basePath: string }) {
  const [families, setFamilies] = useState<FamilyView[] | null>(null);
  const [cats, setCats] = useState<Array<{ key: string; label: string }>>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(async () => {
      const sp = new URLSearchParams(); if (q.trim()) sp.set('q', q.trim()); if (category) sp.set('category', category);
      const r = await fetch(`/api/catalog/families?${sp}`); const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Could not load the catalogue.'); setFamilies([]); return; }
      setError(null); setFamilies(d.families || []); setCats(d.categories || []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, category]);
  const groups = useMemo(() => {
    const m = new Map<string, FamilyView[]>();
    for (const f of families ?? []) m.set(f.categoryLabel, [...(m.get(f.categoryLabel) ?? []), f]);
    return [...m.entries()];
  }, [families]);
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Browse products</h1>
        <p className="text-slate-500">RIVIX makes these to your spec. Choose a product, enter your spec, sizes and quantities, and request a quote. {PRICE_ON_QUOTE}.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or code" aria-label="Search by name or code" className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm" />
        </label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {families === null && <p className="text-sm text-slate-400">Loading…</p>}
      {families !== null && !families.length && !error && <p className="text-sm text-slate-500">Nothing matches. Try another search, or ask your rep.</p>}
      {groups.map(([label, list]) => (
        <section key={label} className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">{label}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((f) => (
              <Link key={f.id} href={`${basePath}/${f.id}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:border-rivix/30 transition-colors">
                <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link from our own route */}
                  {f.imageIds[0] ? <img src={`/api/catalog/images/${f.imageIds[0]}`} alt={f.name} className="w-full h-full object-cover" /> : <span className="text-xs text-slate-300">No image yet</span>}
                </div>
                <div className="p-4 space-y-1">
                  <p className="font-bold text-slate-900">{f.name} <span className="text-xs font-semibold text-slate-400">{f.code}</span></p>
                  {f.description && <p className="text-sm text-slate-500 line-clamp-2">{f.description}</p>}
                  <p className="text-xs font-semibold text-slate-400">{PRICE_ON_QUOTE}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
