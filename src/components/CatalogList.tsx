'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import DocumentList from '@/components/DocumentList';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { catalogAsDocument, catalogFileEndpoint, type CatalogRow } from '@/lib/catalogs';

// Read-only list of RIVIX catalogs with View and Download, for customers and reps. Row security lets any signed-in
// user read the list; the files open only through short signed links from the server.
export default function CatalogList({ intro }: { intro: string }) {
  const [catalogs, setCatalogs] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabaseBrowser
        .from('catalogs')
        .select('id, title, description, file_name, file_size, mime_type, created_at, updated_at')
        .order('updated_at', { ascending: false });
      if (e) setError('Could not load the catalogs. Please try again.');
      setCatalogs((data as CatalogRow[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Catalogs</h1>
        <p className="text-slate-500">{intro}</p>
      </div>
      {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
      {!loading && !error && catalogs.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 text-center space-y-3 max-w-xl">
          <div className="mx-auto w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300"><BookOpen size={28} /></div>
          <p className="font-bold text-slate-900">No catalogs yet</p>
          <p className="text-sm text-slate-500">When RIVIX adds a catalog, it will appear here.</p>
        </div>
      )}
      {catalogs.length > 0 && (
        <div className="max-w-3xl">
          <DocumentList documents={catalogs.map(catalogAsDocument)} fileEndpoint={catalogFileEndpoint} />
        </div>
      )}
    </div>
  );
}
