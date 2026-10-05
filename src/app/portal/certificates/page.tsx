'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import DocumentList from '@/components/DocumentList';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { DocumentRow } from '@/lib/documents';

// Every document RIVIX has uploaded for this customer, newest month first.
// Row security means the query below only ever returns the signed-in customer's own files.
export default function CertificatesPage() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [orderNumbers, setOrderNumbers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: d }, { data: o }] = await Promise.all([
        supabaseBrowser.from('documents').select('*').order('created_at', { ascending: false }),
        supabaseBrowser.from('orders').select('id, batch_number'),
      ]);
      setDocs((d as DocumentRow[]) || []);
      setOrderNumbers(Object.fromEntries((o || []).map((x: any) => [x.id, x.batch_number])));
      setLoading(false);
    })();
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = docs.filter(
    (d) =>
      !q ||
      d.title.toLowerCase().includes(q) ||
      d.doc_type.toLowerCase().includes(q) ||
      (d.order_id && (orderNumbers[d.order_id] || '').toLowerCase().includes(q))
  );

  const groups = useMemo(() => {
    const m = new Map<string, DocumentRow[]>();
    filtered.forEach((d) => {
      const key = new Date(d.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      m.set(key, [...(m.get(key) || []), d]);
    });
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-slate-500">Certificates and files RIVIX has uploaded for your orders.</p>
        </div>
        {docs.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 focus:border-rivix outline-none transition-all w-full sm:w-64"
            />
          </div>
        )}
      </div>

      {!loading && docs.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 text-center space-y-3 max-w-xl">
          <div className="mx-auto w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
            <ShieldCheck size={28} />
          </div>
          <p className="font-bold text-slate-900">No documents yet</p>
          <p className="text-sm text-slate-500">
            When RIVIX uploads a certificate or document for one of your orders, it will appear here. If you need one, ask your sales rep.
          </p>
        </div>
      )}

      {docs.length > 0 && filtered.length === 0 && <p className="text-sm text-slate-400">No documents match your search.</p>}

      {groups.map(([month, list]) => (
        <section key={month} className="space-y-3 max-w-3xl">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">{month}</h2>
          <DocumentList documents={list} showOrder={orderNumbers} />
        </section>
      ))}
    </div>
  );
}
