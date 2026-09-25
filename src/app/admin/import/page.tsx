'use client';

import { useState } from 'react';
import { FileUp, CheckCircle2, AlertCircle, Loader2, Table, ArrowRight, ShieldCheck } from 'lucide-react';
import Papa from 'papaparse';
import { saveOrders, OrderData } from '@/lib/storage';

export default function AdminImport() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'processing' | 'success'>('upload');
  const [data, setData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setData(results.data);
          setStep('mapping');
        },
      });
    }
  };

  const handleImport = async () => {
    if (data.length === 0) return;
    setImporting(true);

    try {
      const mappedData: OrderData[] = data.map((row: any, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        batch_number: row.batch_number || `B-${Date.now()}-${i}`,
        client_name: row.client_name || 'Pacific Mining Co.',
        product_name: row.product_name || 'ArcticShield Coverall',
        quantity: parseInt(row.quantity) || 100,
        material: row.material || '65% Poly / 35% Cotton Heavy Twill 320 GSM',
        origin: row.origin || 'Partner Facility',
        order_date: row.order_date || new Date().toLocaleDateString(),
        ship_date: row.ship_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        status: 'In Production',
        certs_generated: false,
        safety_standard: row.safety_standard || 'CSA Z96-15 Class 3',
        inspector_name: row.inspector_name || 'RIVIX QC Team'
      }));

      await saveOrders(mappedData);
      setImporting(false);
      setStep('success');
    } catch (err) {
      console.error(err);
      setImporting(false);
      alert('Error importing to Supabase. Check console for details.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Batch Data Import</h1>
        <p className="text-slate-500">Bulk upload manufacturing data and technical specifications.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {step === 'upload' && (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-rivix/10 text-rivix rounded-full flex items-center justify-center mx-auto mb-6">
              <FileUp size={40} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Upload Production CSV</h2>
            <p className="text-slate-500 text-sm mb-8 max-w-md mx-auto">
              Select your manufacturing CSV file. Ensure it includes batch numbers, product specs, and client names.
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="inline-flex items-center gap-2 bg-rivix text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all cursor-pointer"
            >
              Select File
            </label>
            <div className="mt-8 pt-8 border-t border-slate-50">
               <a href="/rivix_import_template.csv" download className="text-xs font-bold text-slate-400 hover:text-rivix transition-colors flex items-center justify-center gap-1">
                 Download Template CSV
               </a>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Table className="text-slate-400" />
                <div>
                  <h3 className="font-bold text-slate-900">Data Review</h3>
                  <p className="text-xs text-slate-500">{data.length} rows detected in file</p>
                </div>
              </div>
              <button 
                onClick={handleImport}
                disabled={importing}
                className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {importing ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                {importing ? 'Processing...' : 'Complete Import'}
              </button>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 font-bold text-slate-500 text-xs">Batch No.</th>
                    <th className="px-6 py-3 font-bold text-slate-500 text-xs">Product</th>
                    <th className="px-6 py-3 font-bold text-slate-500 text-xs">Client</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      <td className="px-6 py-3 font-medium text-slate-700">{row.batch_number || 'Auto-gen'}</td>
                      <td className="px-6 py-3 text-slate-500">{row.product_name || 'Generic'}</td>
                      <td className="px-6 py-3 text-slate-500">{row.client_name || 'Default'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="p-12 text-center animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Import Successful</h2>
            <p className="text-slate-500 text-sm mb-8">
              {data.length} production batches have been securely uploaded to Supabase and are now available in the portal.
            </p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => setStep('upload')}
                className="px-6 py-3 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all"
              >
                Import More
              </button>
              <button 
                onClick={() => window.location.href = '/admin'}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-rivix transition-all shadow-lg shadow-slate-900/10"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 flex gap-4">
        <AlertCircle className="text-amber-600 shrink-0" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <p className="font-bold mb-1 uppercase tracking-wider">Cloud Synchronization Enabled</p>
          Data imported here is instantly mirrored to the client-facing portal. Ensure all technical specifications (Safety Standard, Inspector) are accurate as they will be embedded into official certificates.
        </div>
      </div>
    </div>
  );
}
