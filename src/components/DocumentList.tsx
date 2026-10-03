'use client';

import { useState } from 'react';
import { FileText, Download, Eye, Trash2, Loader2 } from 'lucide-react';
import { DocumentRow, formatBytes } from '@/lib/documents';

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

  const open = async (id: string, download = false) => {
    setBusy(id);
    setError(null);
    const err = await openDocument(id, download);
    if (err) setError(err);
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
              {' · '}{new Date(d.created_at).toLocaleDateString()}
              {d.file_size ? ` · ${formatBytes(d.file_size)}` : ''}
            </p>
          </div>
          <button
            onClick={() => open(d.id)}
            disabled={busy === d.id}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rivix text-white text-xs font-bold hover:bg-rivix-dark transition-all disabled:opacity-60 shrink-0"
          >
            {busy === d.id ? <Loader2 className="animate-spin" size={14} /> : <Eye size={14} />}
            Open
          </button>
          <button
            onClick={() => open(d.id, true)}
            disabled={busy === d.id}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:border-rivix hover:text-rivix transition-all disabled:opacity-60 shrink-0"
          >
            <Download size={14} />
            Download
          </button>
          {onDelete && (
            <button onClick={() => onDelete(d)} className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0" aria-label={`Delete ${d.title}`}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
