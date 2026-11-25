'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { CERT_BUCKET } from '@/lib/certificate-files';
import type { Plan } from '@/lib/catalog-import';
import { SUPPLIER_HEADERS, PRODUCT_HEADERS } from '@/lib/catalog-import';
import { api, btn, btnGhost, card, label, ErrorText } from '../ui';

// The import (2026-11-21): upload the Suppliers and Products CSV (one file per tab of Joseph's sheet) and the certificate
// files, see the dry run (nothing is written), then confirm. Running it twice changes nothing.
type Preview = Plan & { fingerprint: string };
export default function ImportPage() {
  const [supCsv, setSupCsv] = useState<string | undefined>();
  const [prodCsv, setProdCsv] = useState<string | undefined>();
  const [files, setFiles] = useState<File[]>([]);
  const [batch, setBatch] = useState<string | null>(null);
  const [plan, setPlan] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const readText = (f: File | undefined, set: (s: string | undefined) => void) => { if (!f) { set(undefined); return; } f.text().then(set); };
  const body = (extra: Record<string, unknown> = {}) => ({ suppliersCsv: supCsv, productsCsv: prodCsv, batch, ...extra });

  const doPreview = async () => {
    setBusy('Checking…'); setError(null); setDone(null);
    let b = batch;
    if (files.length) {
      b = b ?? crypto.randomUUID(); setBatch(b);
      for (const f of files) {
        const u = await api<{ path: string; token: string }>('/api/admin/catalog-import/upload-url', 'POST', { batch: b, file_name: f.name, size: f.size });
        if (!u.ok) { setBusy(null); setError(u.error); return; }
        const up = await supabaseBrowser.storage.from(CERT_BUCKET).uploadToSignedUrl(u.data.path, u.data.token, f, { contentType: f.type || 'application/octet-stream', upsert: true });
        if (up.error) { setBusy(null); setError(`${f.name}: ${up.error.message}`); return; }
      }
    }
    const r = await api<{ plan: Preview }>('/api/admin/catalog-import', 'POST', { ...body(), batch: b, action: 'preview' });
    setBusy(null); if (r.ok) setPlan(r.data.plan); else setError(r.error);
  };
  const addStandards = async () => {
    if (!plan || !window.confirm(`Add these ${plan.unknownStandards.length} standards to the reference as UNCHECKED? Claims against them will show "Standard not checked".`)) return;
    setBusy('Adding…');
    const r = await api<{ plan: Preview; added: string[] }>('/api/admin/catalog-import', 'POST', { ...body(), action: 'add_standards', designations: plan.unknownStandards });
    setBusy(null); if (r.ok) setPlan(r.data.plan); else setError(r.error);
  };
  const confirm = async () => {
    if (!plan) return;
    setBusy('Importing…');
    const r = await api<{ writes: number }>('/api/admin/catalog-import', 'POST', { ...body(), action: 'confirm', fingerprint: plan.fingerprint });
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setDone(`Imported: ${r.data.writes} write(s). Run the preview again to see everything as unchanged.`); setPlan(null); setBatch(null); setFiles([]);
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="text-sm text-slate-600">Export each tab of the sheet as CSV. Lists in one cell are separated by <b>;</b>. A blank cell keeps the current value. Products: one row per standard, repeating the product code. An imported standard is a claim; certificates come in as <b>uploaded</b>, never verified, and only when their file is attached here.</p>
        <p className="text-xs"><a className="text-rivix font-bold" href="/rivix_suppliers_template.csv" download>Suppliers template</a> · <a className="text-rivix font-bold" href="/rivix_products_template.csv" download>Products template</a></p>
        <details className="text-xs text-slate-500"><summary className="cursor-pointer">Exact column headers</summary><p className="mt-1"><b>Suppliers:</b> {SUPPLIER_HEADERS.join(', ')} (MOQ unit and Website are optional)</p><p className="mt-1"><b>Products:</b> {PRODUCT_HEADERS.join(', ')} (Certificate type and Lab accreditation are optional columns, but a row with a certificate file needs its type: Third-party certificate, Accredited lab report or Manufacturer declaration. Only the first two can make a standard Compliant.)</p></details>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1"><span className={label}>Suppliers CSV</span><input type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => { readText(e.target.files?.[0], setSupCsv); setPlan(null); }} /></label>
          <label className="space-y-1"><span className={label}>Products CSV</span><input type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => { readText(e.target.files?.[0], setProdCsv); setPlan(null); }} /></label>
          <label className="space-y-1"><span className={label}>Certificate files (PDF, JPEG, PNG)</span><input type="file" multiple accept="application/pdf,image/jpeg,image/png" className="text-sm" onChange={(e) => { setFiles([...(e.target.files ?? [])]); setPlan(null); }} /></label>
        </div>
        <button className={btn} disabled={!!busy || (!supCsv && !prodCsv)} onClick={doPreview}>{busy ?? 'Preview (dry run)'}</button>
      </div>
      <ErrorText error={error} />
      {done && <p className="text-sm text-emerald-700 font-semibold">{done}</p>}
      {plan && (
        <div className={card}>
          <p className="text-sm"><b>Dry run, nothing written yet.</b> {plan.summary.create} row(s) create, {plan.summary.update} update, {plan.summary.unchanged} unchanged, <span className={plan.summary.error ? 'text-red-600 font-bold' : ''}>{plan.summary.error} with errors</span>; {plan.summary.writes} write(s).</p>
          {plan.fileErrors.map((e) => <p key={e} className="text-sm text-red-600">{e}</p>)}
          {!!plan.unknownStandards.length && (
            <div className="text-sm bg-amber-50 rounded-xl p-3 space-y-2">
              <p>Unknown standards ({plan.unknownStandards.length}): {plan.unknownStandards.join('; ')}</p>
              <button className={btnGhost} disabled={!!busy} onClick={addStandards}>Add these {plan.unknownStandards.length} as unchecked standards</button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="p-2">Tab / row</th><th className="p-2">Record</th><th className="p-2">Result</th><th className="p-2">Details</th></tr></thead>
              <tbody>
                {plan.rows.map((r) => (
                  <tr key={`${r.tab}${r.row}`} className="border-t border-slate-100 align-top">
                    <td className="p-2 whitespace-nowrap">{r.tab} {r.row}</td><td className="p-2">{r.label}</td>
                    <td className={`p-2 font-bold ${r.action === 'error' ? 'text-red-600' : r.action === 'unchanged' ? 'text-slate-400' : 'text-emerald-700'}`}>{r.action}</td>
                    <td className="p-2">{[...r.errors.map((e) => `✗ ${e}`), ...r.warnings.map((w) => `! ${w}`), ...r.changes].map((x) => <div key={x}>{x}</div>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className={btn} disabled={!!busy || !plan.canConfirm || !plan.summary.writes} onClick={confirm}>{plan.canConfirm ? (plan.summary.writes ? `Confirm: make ${plan.summary.writes} write(s)` : 'Nothing to write') : 'Fix the errors first'}</button>
        </div>
      )}
    </div>
  );
}
