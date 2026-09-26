'use client';

import { useEffect, useState } from 'react';
import { Package, ShieldCheck, FileText, Download, Loader2 } from 'lucide-react';
import { getMyProductSpecs, ProductSpecData } from '@/lib/storage';

export default function ProductSpecsPage() {
  const [specs, setSpecs] = useState<ProductSpecData[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const mySpecs = await getMyProductSpecs();
      setSpecs(mySpecs);
      setLoading(false);
    };
    load();
  }, []);

  const handleDownload = async (spec: ProductSpecData) => {
    setDownloadingId(spec.id);
    try {
      const res = await fetch(`/api/portal/product-specs/${spec.id}/file`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        alert(data.error || 'Could not open this file. Please try again.');
        return;
      }
      window.open(data.url, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Product Specifications</h1>
        <p className="text-slate-500">Technical files for your specific contracted products, managed by RIVIX.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : specs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
            <Package size={28} />
          </div>
          <p className="font-bold text-slate-900">No product specs yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Your RIVIX representative will upload technical specifications here once your contracted products are set up.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {specs.map((spec) => (
            <div
              key={spec.id}
              className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col lg:flex-row"
            >
              <div className="flex-1 p-10">
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{spec.product_name}</h3>
                    {spec.safety_standard && (
                      <p className="text-sm font-bold text-rivix uppercase tracking-widest">{spec.safety_standard}</p>
                    )}
                  </div>
                  {spec.file_url && (
                    <button
                      onClick={() => handleDownload(spec)}
                      disabled={downloadingId === spec.id}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-rivix text-white text-xs font-bold rounded-xl hover:bg-rivix-dark transition-all shrink-0 disabled:opacity-60"
                    >
                      {downloadingId === spec.id ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Download size={14} />
                      )}
                      {spec.file_label || 'Download File'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  {spec.fabric && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText size={12} />
                        Core Fabric
                      </p>
                      <p className="text-sm font-semibold text-slate-700">{spec.fabric}</p>
                    </div>
                  )}
                  {spec.safety_standard && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <ShieldCheck size={12} />
                        Safety Standard
                      </p>
                      <p className="text-sm font-semibold text-slate-700">{spec.safety_standard}</p>
                    </div>
                  )}
                </div>

                {spec.description && (
                  <div className="mt-10 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notes</p>
                    <p className="text-xs text-slate-500 leading-relaxed italic">{spec.description}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
