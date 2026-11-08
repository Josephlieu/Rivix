'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileUp, CheckCircle2, AlertCircle, Loader2, Table, ArrowRight, XCircle } from 'lucide-react';
import Papa from 'papaparse';
import { IMPORT_COLUMNS, REQUIRED_COLUMNS, MAX_IMPORT_ROWS, normalizeHeader } from '@/lib/order-import';

type Result = { line: number; ok: boolean; batch_number: string; customer?: string; reason?: string };
type Report = { results: Result[]; ok: number; imported: number; skipped: number; ignored: string[] };

// Admin CSV order import: choose a file, see every row marked OK or why it will be skipped (checked by the server),
// then import only the OK rows. Blank cells stay blank; nothing is made up.
export default function AdminImport() {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (r: Record<string, string>[], h: string[], dryRun: boolean): Promise<Report | null> => {
    const res = await fetch('/api/admin/orders/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: r, headers: h, dryRun }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || 'The import failed.'); return null; }
    return data as Report;
  };

  const reset = () => { setStep('upload'); setRows([]); setHeaders([]); setReport(null); setError(null); setFileName(''); };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // choosing the same file again still triggers a preview
    if (!file) return;
    setError(null); setFileName(file.name); setBusy(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy', // fully blank lines are not rows
      complete: async (parsed) => {
        const h = parsed.meta.fields || [];
        const data = parsed.data;
        if (!data.length) { setError('The file has no rows.'); setBusy(false); return; }
        if (data.length > MAX_IMPORT_ROWS) { setError(`A file can have at most ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`); setBusy(false); return; }
        const preview = await send(data, h, true);
        setBusy(false);
        if (!preview) return;
        setRows(data); setHeaders(h); setReport(preview); setStep('preview');
      },
      error: () => { setError('Could not read that file. Save it as CSV and try again.'); setBusy(false); },
    });
  };

  const handleImport = async () => {
    setBusy(true); setError(null);
    const done = await send(rows, headers, false); // the server checks every row again before saving
    setBusy(false);
    if (!done) return;
    setReport(done); setStep('done');
  };

  const skippedList = (report?.results || []).filter((r) => !r.ok);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import orders from CSV</h1>
        <p className="text-slate-500">Each row becomes one order for an existing customer. Blank cells stay blank.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-2xl px-4 py-3 flex items-start gap-2">
          <AlertCircle size={18} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {step === 'upload' && (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-rivix/10 text-rivix rounded-full flex items-center justify-center mx-auto mb-6">
              {busy ? <Loader2 className="animate-spin" size={40} /> : <FileUp size={40} />}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Choose a CSV file</h2>
            <p className="text-slate-500 text-sm mb-8 max-w-md mx-auto">
              You will see every row checked before anything is saved.
            </p>
            <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" id="csv-upload" disabled={busy} />
            <label htmlFor="csv-upload" className={`inline-flex items-center gap-2 bg-rivix text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
              {busy ? 'Checking...' : 'Select file'}
            </label>
            <div className="mt-8 pt-8 border-t border-slate-50 space-y-3 text-left max-w-xl mx-auto text-xs text-slate-500 leading-relaxed">
              <p><span className="font-bold text-slate-700">Columns:</span> {IMPORT_COLUMNS.join(', ')}.</p>
              <p><span className="font-bold text-slate-700">Required:</span> {REQUIRED_COLUMNS.join(', ')}. The customer code is on the Clients page. Quantity is a whole number above 0.</p>
              <p>Leave batch_number blank to have the portal number the order (ORD-0001, ...). Dates are YYYY-MM-DD. status is one of the order stages; blank or unknown means Order Received.</p>
              <a href="/rivix_import_template.csv" download className="inline-block font-bold text-slate-400 hover:text-rivix transition-colors">Download the template CSV</a>
            </div>
          </div>
        )}

        {step === 'preview' && report && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Table className="text-slate-400" />
                <div>
                  <h3 className="font-bold text-slate-900">Check before importing</h3>
                  <p className="text-xs text-slate-500">{fileName}: {report.results.length} rows, {report.ok} OK, {report.skipped} will be skipped</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={reset} disabled={busy} className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-50">Choose another file</button>
                <button onClick={handleImport} disabled={busy || report.ok === 0} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-40">
                  {busy ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                  {busy ? 'Importing...' : `Import ${report.ok} row${report.ok === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
            {report.ignored.length > 0 && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">These columns are not imported and will be ignored: {report.ignored.join(', ')}.</p>}

            <div className="border border-slate-100 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs">Line</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs">Batch no.</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs">Product</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs">Customer</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.results.map((r) => {
                    const raw = rows[r.line - 2] || {};
                    const product = Object.entries(raw).find(([k]) => normalizeHeader(k) === 'product_name')?.[1];
                    return (
                      <tr key={r.line} className={r.ok ? '' : 'bg-red-50/40'}>
                        <td className="px-4 py-3 text-slate-400">{r.line}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{r.batch_number || <span className="text-slate-400">numbered on import</span>}</td>
                        <td className="px-4 py-3 text-slate-500">{product || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{r.customer || '—'}</td>
                        <td className="px-4 py-3">
                          {r.ok
                            ? <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs"><CheckCircle2 size={14} />OK</span>
                            : <span className="inline-flex items-start gap-1 text-red-600 font-semibold text-xs"><XCircle size={14} className="shrink-0 mt-px" />{r.reason}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 'done' && report && (
          <div className="p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">{report.imported} imported, {report.skipped} skipped</h2>
              <p className="text-slate-500 text-sm">The imported orders are now on the Orders page and visible to each customer and their rep.</p>
            </div>
            {skippedList.length > 0 && (
              <div className="text-left max-w-xl mx-auto bg-slate-50 rounded-2xl p-4 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-700 mb-1">Skipped lines (fix them and import those rows again):</p>
                {skippedList.map((r) => <p key={r.line}>Line {r.line}{r.batch_number ? ` (${r.batch_number})` : ''}: {r.reason}</p>)}
              </div>
            )}
            <div className="flex justify-center gap-4">
              <button onClick={reset} className="px-6 py-3 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all">Import another file</button>
              <Link href="/admin/orders" className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-rivix transition-all">Go to Orders</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
