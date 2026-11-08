'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Loader2, AlertCircle, Pencil, RefreshCw } from 'lucide-react';
import DocumentList from '@/components/DocumentList';
import ConfirmModal from '@/components/ConfirmModal';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { DocumentRow } from '@/lib/documents';
import { CATALOG_ACCEPT, CATALOG_BUCKET, CATALOG_MIME, MAX_CATALOG_BYTES, catalogAsDocument, catalogFileEndpoint, type CatalogRow } from '@/lib/catalogs';

const input = 'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';
const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

// Admin catalog manager: upload, edit, replace and remove the PDFs signed-in customers and reps see on their
// Catalogs page. Files live in a private bucket; nobody can open them without a short signed link.
export default function AdminCatalogsPage() {
  const [catalogs, setCatalogs] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileKey, setFileKey] = useState(0);

  const [editing, setEditing] = useState<{ id: string; title: string; description: string } | null>(null);
  const [toRemove, setToRemove] = useState<DocumentRow | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);

  const load = async () => {
    const { data, error: e } = await supabaseBrowser
      .from('catalogs')
      .select('id, title, description, file_name, file_size, mime_type, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (e) setError('Could not load the catalogs.');
    setCatalogs((data as CatalogRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const checkFile = (f: File) => {
    if (f.type !== CATALOG_MIME) return 'Catalogs must be PDF files.';
    if (f.size > MAX_CATALOG_BYTES) return 'Catalogs must be 50 MB or smaller.';
    return null;
  };

  // 1) ask the server for a one-time upload link  2) send the file straight to the private bucket
  const uploadToStorage = async (f: File): Promise<string> => {
    const r1 = await fetch('/api/admin/catalogs/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_name: f.name, size: f.size, mime: f.type }) });
    const d1 = await r1.json().catch(() => ({}));
    if (!r1.ok) throw new Error(d1.error || 'Could not start the upload.');
    const up = await supabaseBrowser.storage.from(CATALOG_BUCKET).uploadToSignedUrl(d1.path, d1.token, f, { contentType: f.type });
    if (up.error) throw new Error(up.error.message || 'The upload failed.');
    return d1.path;
  };

  const addCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null); setNotice(null);
    const bad = checkFile(file);
    if (bad) { setError(bad); return; }
    setBusy('add');
    try {
      const path = await uploadToStorage(file);
      const r = await fetch('/api/admin/catalogs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, file_name: file.name, title, description }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save the catalog.');
      setNotice('Catalog added. Customers and reps can see it now.');
      setFile(null); setTitle(''); setDescription(''); setFileKey((k) => k + 1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    }
    setBusy(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy('edit' + editing.id); setError(null); setNotice(null);
    const r = await fetch(`/api/admin/catalogs/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editing.title, description: editing.description }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setError(d.error || 'Could not save.'); return; }
    setEditing(null); setNotice('Catalog updated.'); await load();
  };

  const replaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    const id = replaceId;
    setReplaceId(null);
    if (!f || !id) return;
    setError(null); setNotice(null);
    const bad = checkFile(f);
    if (bad) { setError(bad); return; }
    setBusy('replace' + id);
    try {
      const path = await uploadToStorage(f);
      const r = await fetch(`/api/admin/catalogs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, file_name: f.name }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not replace the file.');
      setNotice('File replaced. Everyone now gets the new version.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not replace the file.');
    }
    setBusy(null);
  };

  const remove = async () => {
    if (!toRemove) return;
    setBusy('remove'); setError(null); setNotice(null);
    const r = await fetch(`/api/admin/catalogs/${toRemove.id}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setError(d.error || 'Could not remove the catalog.'); return; }
    setToRemove(null); setNotice('Catalog removed.'); await load();
  };

  const rowActions = (doc: DocumentRow) => {
    const c = catalogs.find((x) => x.id === doc.id);
    if (!c) return null;
    return (
      <>
        <button
          onClick={() => setEditing({ id: c.id, title: c.title, description: c.description || '' })}
          className="p-2 text-slate-400 hover:text-rivix transition-colors shrink-0"
          aria-label={`Edit ${c.title}`}
          title="Edit title and description"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => { setReplaceId(c.id); replaceInput.current?.click(); }}
          disabled={busy === 'replace' + c.id}
          className="p-2 text-slate-400 hover:text-rivix transition-colors shrink-0 disabled:opacity-50"
          aria-label={`Replace the file of ${c.title}`}
          title="Replace the PDF"
        >
          {busy === 'replace' + c.id ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
        </button>
      </>
    );
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Catalogs</h1>
        <p className="text-slate-500">PDF catalogs shown to signed-in customers and reps on their Catalogs page. They are never public.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {notice && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
        <h3 className="font-bold text-slate-900">Current catalogs</h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <DocumentList
            documents={catalogs.map(catalogAsDocument)}
            fileEndpoint={catalogFileEndpoint}
            onDelete={setToRemove}
            renderActions={rowActions}
            empty="No catalogs yet. Upload the first one below."
          />
        )}
        <input ref={replaceInput} type="file" accept={CATALOG_ACCEPT} className="hidden" onChange={replaceFile} />

        {editing && (
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-900">Edit catalog</p>
            <div className="space-y-1.5">
              <label className={label}>Title</label>
              <input className={input} value={editing.title} maxLength={200} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className={label}>Description (optional)</label>
              <input className={input} value={editing.description} maxLength={500} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={busy === 'edit' + editing.id} className="bg-slate-950 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-rivix transition-all disabled:opacity-60">Save</button>
              <button onClick={() => setEditing(null)} className="px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={addCatalog} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
        <h3 className="font-bold text-slate-900">Add a catalog</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={label}>Title</label>
            <input className={input} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the file name" />
          </div>
          <div className="space-y-1.5">
            <label className={label}>Description (optional)</label>
            <input className={input} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="Styles, fabrics, compliance specs..." />
          </div>
        </div>
        <input key={fileKey} type="file" accept={CATALOG_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold file:text-xs hover:file:bg-slate-200" />
        <p className="text-[11px] text-slate-400 px-1">PDF only, up to 50 MB.</p>
        <button disabled={!file || busy === 'add'} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
          {busy === 'add' ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}Upload catalog
        </button>
      </form>

      <ConfirmModal
        open={toRemove !== null}
        danger
        loading={busy === 'remove'}
        title={`Remove "${toRemove?.title}"?`}
        message="Customers and reps will no longer see this catalog, and the file is deleted."
        confirmLabel="Remove catalog"
        onConfirm={remove}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
