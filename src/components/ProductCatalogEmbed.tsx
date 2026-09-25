'use client';

import { Download, FileText } from 'lucide-react';
import { PRODUCT_CATALOG_PDF, PRODUCT_CATALOG_TITLE } from '@/lib/productCatalog';

interface ProductCatalogEmbedProps {
  title?: string;
  description?: string;
}

export function ProductCatalogEmbed({
  title = PRODUCT_CATALOG_TITLE,
  description = 'Full manufacturing catalog — styles, fabrics, compliance specs, and production capabilities.',
}: ProductCatalogEmbedProps) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 bg-rivix/10 text-rivix rounded-xl shrink-0">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
        <a
          href={PRODUCT_CATALOG_PDF}
          download
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rivix text-white text-xs font-bold rounded-xl hover:bg-rivix-dark transition-all shrink-0"
        >
          <Download size={14} />
          Download PDF
        </a>
      </div>
      <div className="bg-slate-100 p-2 sm:p-4">
        <iframe
          src={`${PRODUCT_CATALOG_PDF}#toolbar=1&navpanes=0&view=FitH`}
          title={title}
          className="w-full h-[70vh] min-h-[420px] sm:min-h-[560px] bg-white rounded-xl border border-slate-200"
        />
      </div>
    </div>
  );
}
