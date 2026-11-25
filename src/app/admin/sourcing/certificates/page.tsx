'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DOCUMENT_TYPE_LABEL, type DocumentType } from '@/lib/compliance';
import { WarningBadge, api, input, ErrorText } from '../ui';

type Row = { id: string; file_name: string; status: string; document_type: DocumentType; issuing_body: string | null; accreditation: string | null; expires_on: string | null; verified_by_email: string | null; daysToExpiry: number | null; warning: string | null; ruleStatus: string;
  product: { id: string; code: string | null; name: string }; standard: { designation: string; checked: boolean } };
export default function CertificatesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [today, setToday] = useState('');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { api<{ certificates: Row[]; today: string }>('/api/admin/certificates').then((r) => { if (r.ok) { setRows(r.data.certificates); setToday(r.data.today); } else setError(r.error); }); }, []);
  useEffect(() => { load(); }, [load]);
  const shown = (rows ?? []).filter((r) => !filter || (filter === 'uploaded' ? r.status === 'uploaded' : r.warning === filter));
  const n = (w: string) => (rows ?? []).filter((r) => r.warning === w).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Today (business day, Vancouver): {today}. Expired: <b>{n('expired')}</b> · within 30 days: <b>{n('within_30')}</b> · within 60 days: <b>{n('within_60')}</b> · awaiting verification: <b>{(rows ?? []).filter((r) => r.status === 'uploaded').length}</b></p>
      <select className={`${input} max-w-xs`} value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">All certificates</option><option value="expired">Expired</option><option value="within_30">Expiring within 30 days</option><option value="within_60">Expiring in 31 to 60 days</option><option value="uploaded">Awaiting verification</option>
      </select>
      <ErrorText error={error} />
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="p-3">Product</th><th className="p-3">Standard</th><th className="p-3">File</th><th className="p-3">Status</th><th className="p-3">Expires</th><th className="p-3">Counts as</th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={6} className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {rows !== null && !shown.length && <tr><td colSpan={6} className="p-6 text-center text-slate-400">Nothing here.</td></tr>}
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="p-3"><Link className="text-rivix font-semibold" href={`/admin/sourcing/products/${r.product.id}`}>{r.product.code ?? ''} {r.product.name}</Link></td>
                <td className="p-3">{r.standard.designation}{r.standard.checked ? '' : ' (not checked)'}</td>
                <td className="p-3">{r.file_name}<div className="text-xs font-semibold text-slate-600">{DOCUMENT_TYPE_LABEL[r.document_type] ?? r.document_type}</div>{r.issuing_body ? <div className="text-xs text-slate-500">{r.issuing_body}{r.document_type === 'accredited_lab_report' && r.accreditation ? ` · ${r.accreditation}` : ''}</div> : null}</td>
                <td className="p-3">{r.status === 'verified' ? `Verified (${r.verified_by_email})` : 'Uploaded'}</td>
                <td className="p-3 space-x-2"><span>{r.expires_on ?? '—'}</span><WarningBadge w={r.warning} days={r.daysToExpiry} /></td>
                <td className="p-3">{r.ruleStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
