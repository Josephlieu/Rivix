'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Download, Eye, Trash2, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { DocumentRow, formatBytes } from '@/lib/documents';
import PdfPages from '@/components/PdfPages';
import { formatDate } from '@/lib/format';

interface DocumentListProps {
  documents: DocumentRow[];
  onDelete?: (doc: DocumentRow) => void;
  showOrder?: Record<string, string>; // order_id -> order number, for the all-documents list
  empty?: string;
}

// Opens a document through the server: it checks you may see the file, then
// returns a link that works for about 10 minutes.
export async function openDocument(id: string, download = false): Promise<string | null> {
  const res = await fetch(`/api/documents/${id}/file${download ? '?download=1' : ''}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) return data.error || 'Could not open the document.';
  if (download) {
    // Saves the file under its original name; doesn't depend on the browser's PDF viewer.
    const a = document.createElement('a');
    a.href = data.url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(data.url, '_blank', 'noopener');
  }
  return null;
}

export default function DocumentList({ documents, onDelete, showOrder, empty = 'No documents yet.' }: DocumentListProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [viewer, setViewer] = useState<{ doc: DocumentRow; url: string; blob: Blob; kind: 'pdf' | 'image' | 'docx' | 'other' } | null>(null);
  const [viewerError, setViewerError] = useState(false);
  const docxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Close the viewer on Escape and free the temporary file URL when it closes.
  const closeViewer = () => {
    setViewer((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
  };
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeViewer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewer]);

  // Word (.docx) files are drawn into the viewer by a small library, in the browser.
  useEffect(() => {
    if (!viewer || viewer.kind !== 'docx') return;
    let cancelled = false;
    (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        if (cancelled || !docxRef.current) return;
        docxRef.current.innerHTML = '';
        await renderAsync(viewer.blob, docxRef.current, undefined, { inWrapper: true, ignoreWidth: false, ignoreHeight: true });
      } catch {
        if (!cancelled) setViewerError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [viewer]);

  // View the file inside the page: PDFs and images are shown in a viewer window;
  // other types (Word, Excel) can't be previewed, so the window offers Download.
  const view = async (d: DocumentRow) => {
    setBusy(d.id);
    try {
      const res = await fetch(`/api/documents/${d.id}/file`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open the document.');
      const file = await fetch(data.url);
      if (!file.ok) throw new Error('Could not load the document. Please try again.');
      const blob = await file.blob();
      const type = blob.type || d.mime_type || '';
      const isDocx = type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(d.file_name || '');
      const kind = type === 'application/pdf' ? 'pdf' : type.startsWith('image/') ? 'image' : isDocx ? 'docx' : 'other';
      setViewerError(false);
      setViewer({ doc: d, url: URL.createObjectURL(blob), blob, kind });
    } catch (e: any) {
      setToast({ text: e.message || 'Could not open the document.', type: 'error' });
    }
    setBusy(null);
  };

  // Downloads in the background (no new tab, the page stays put) and says when it's done.
  const download = async (d: DocumentRow) => {
    setBusy(d.id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${d.id}/file`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not download the document.');
      const file = await fetch(data.url);
      if (!file.ok) throw new Error('The download failed. Please try again.');
      const href = URL.createObjectURL(await file.blob());
      const a = document.createElement('a');
      a.href = href;
      a.download = d.file_name || d.title;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
      setToast({ text: `Downloaded "${d.file_name || d.title}" — check your Downloads folder.`, type: 'success' });
    } catch (e: any) {
      setToast({ text: e.message || 'Could not download the document.', type: 'error' });
    }
    setBusy(null);
  };

  if (documents.length === 0) return <p className="text-sm text-slate-400">{empty}</p>;

  return (
    <div className="space-y-3">
      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
      {documents.map((d) => (
        <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4">
          <div className="p-2.5 rounded-xl bg-white text-slate-400 shrink-0"><FileText size={18} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{d.title}</p>
            <p className="text-[11px] text-slate-400 truncate">
              {d.doc_type}
              {showOrder && d.order_id && showOrder[d.order_id] ? ` · ${showOrder[d.order_id]}` : ''}
              {' · '}{formatDate(d.created_at)}
              {d.file_size ? ` · ${formatBytes(d.file_size)}` : ''}
            </p>
          </div>
          <button
            onClick={() => view(d)}
            disabled={busy === d.id}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rivix text-white text-xs font-bold hover:bg-rivix-dark transition-all disabled:opacity-60 shrink-0"
          >
            {busy === d.id ? <Loader2 className="animate-spin" size={14} /> : <Eye size={14} />}
            View
          </button>
          <button
            onClick={() => download(d)}
            disabled={busy === d.id}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:border-rivix hover:text-rivix transition-all disabled:opacity-60 shrink-0"
          >
            {busy === d.id ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            Download
          </button>
          {onDelete && (
            <button onClick={() => onDelete(d)} className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0" aria-label={`Delete ${d.title}`}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}

      {viewer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-8 bg-slate-950/70 backdrop-blur-sm" onClick={closeViewer}>
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">{viewer.doc.title}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{viewer.doc.doc_type} · {viewer.doc.file_name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => download(viewer.doc)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:border-rivix hover:text-rivix transition-all">
                  <Download size={14} />Download
                </button>
                <button onClick={closeViewer} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all" aria-label="Close viewer">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center">
              {viewer.kind === 'pdf' && !viewerError && <PdfPages blob={viewer.blob} onFail={() => setViewerError(true)} />}
              {viewer.kind === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewer.url} alt={viewer.doc.title} className="max-w-full max-h-full object-contain" />
              )}
              {viewer.kind === 'docx' && !viewerError && <div ref={docxRef} className="w-full h-full overflow-auto" />}
              {(viewer.kind === 'other' || (viewerError && (viewer.kind === 'docx' || viewer.kind === 'pdf'))) && (
                <div className="text-center p-8 space-y-2">
                  <p className="font-bold text-slate-700">{viewerError ? "This file couldn't be previewed." : "This file type can't be previewed here."}</p>
                  <p className="text-sm text-slate-500">Use Download to open it on your computer.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[80] max-w-sm flex items-start gap-3 rounded-2xl px-4 py-3 shadow-xl text-sm font-semibold animate-in fade-in slide-in-from-bottom-2 duration-150 ${
            toast.type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
