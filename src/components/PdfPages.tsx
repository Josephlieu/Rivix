'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Draws a PDF page by page onto canvases using Mozilla's PDF.js, so it looks the
// same in every browser (including phones and embedded browsers that have no
// built-in PDF viewer). The worker file lives in /public/pdf.worker.min.mjs and
// must match the installed pdfjs-dist version — copy it again after upgrading:
//   cp node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs public/
export default function PdfPages({ blob, onFail }: { blob: Blob; onFail: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ loading: boolean; pages: number; done: number }>({ loading: true, pages: 0, done: 0 });

  useEffect(() => {
    let cancelled = false;
    let pdfDoc: any = null;

    (async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const data = new Uint8Array(await blob.arrayBuffer());
        pdfDoc = await pdfjs.getDocument({ data }).promise;
        if (cancelled || !holder.current) return;

        holder.current.innerHTML = '';
        setState({ loading: false, pages: pdfDoc.numPages, done: 0 });

        const width = Math.max(280, (holder.current.clientWidth || 800) - 32);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);

        for (let n = 1; n <= pdfDoc.numPages; n++) {
          const page = await pdfDoc.getPage(n);
          if (cancelled || !holder.current) return;
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale: scale * ratio });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
          canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
          canvas.className = 'bg-white shadow-md rounded-md mx-auto mb-4 max-w-full';
          holder.current.appendChild(canvas);

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('no canvas');
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          if (!cancelled) setState((s) => ({ ...s, done: n }));
        }
      } catch {
        if (!cancelled) onFail();
      }
    })();

    return () => {
      cancelled = true;
      try { pdfDoc?.destroy(); } catch { /* already gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  return (
    <div className="w-full h-full overflow-auto p-4">
      {state.loading && (
        <div className="py-20 text-center text-slate-400"><Loader2 className="animate-spin inline" size={22} /></div>
      )}
      <div ref={holder} />
      {!state.loading && state.pages > 1 && state.done < state.pages && (
        <p className="text-center text-xs text-slate-400 pb-4">Loading page {state.done + 1} of {state.pages}…</p>
      )}
    </div>
  );
}
