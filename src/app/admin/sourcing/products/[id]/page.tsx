'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CLAIM_SPEC, LINK_SPEC, PRODUCT_SPEC } from '@/lib/catalog-fields';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, type ClaimStatus, type DocumentType } from '@/lib/compliance';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { CERT_BUCKET } from '@/lib/certificate-files';
import { SpecForm, StatusBadge, WarningBadge, api, asText, btn, btnGhost, card, input, label, ErrorText } from '../../ui';

type Cert = { id: string; standard_id: string; document_type: DocumentType; issuing_body: string | null; accreditation: string | null; issued_on: string | null; expires_on: string | null; file_name: string; status: string; verified_by_email: string | null; verified_at: string | null; warning: string | null };
type Data = {
  product: Record<string, unknown> & { id: string; code: string | null; name: string; active: boolean };
  suppliers: Array<{ supplier: { id: string; code: string; name: string }; supplier_sku: string | null; moq: number | null; moq_unit: string; lead_time_days: number | null }>;
  claims: Array<{ id: string; standard_id: string; protection_type: string | null; protection_class: string | null; status: ClaimStatus; standard: { designation: string; checked: boolean } }>;
  certificates: Cert[]; today: string;
};
type Std = { id: string; designation: string; checked: boolean };
const dayDiff = (a: string | null, b: string) => (a ? Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000) : null);

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [cats, setCats] = useState<Array<{ key: string; label: string }>>([]);
  const [stds, setStds] = useState<Std[]>([]);
  const [sups, setSups] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const load = useCallback(() => { api<Data>(`/api/admin/products-catalog/${id}`).then((r) => { if (r.ok) { setD(r.data); setKey((k) => k + 1); } else setError(r.error); }); }, [id]);
  useEffect(() => {
    load();
    api<{ categories: Array<{ key: string; label: string }> }>('/api/admin/products-catalog?active=true').then((r) => r.ok && setCats(r.data.categories));
    api<{ standards: Std[] }>('/api/admin/standards').then((r) => r.ok && setStds(r.data.standards));
    api<{ suppliers: Array<{ id: string; code: string; name: string }> }>('/api/admin/suppliers?active=true').then((r) => r.ok && setSups(r.data.suppliers));
  }, [load]);
  const act = async (url: string, method: string, body?: unknown) => { const r = await api(url, method, body); if (!r.ok) setError(r.error); else { setError(null); load(); } return r; };
  if (!d) return <ErrorText error={error ?? 'Loading…'} />;
  const p = d.product;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/sourcing/products" className="text-sm text-slate-500">← Products</Link>
        <h2 className="text-xl font-black">{asText(p.code)} {p.name}</h2>
        <span className="text-xs text-slate-500">{p.active ? 'Active' : 'Inactive'}</span>
        <button className={btnGhost} onClick={() => act(`/api/admin/products-catalog/${id}`, 'PATCH', { active: !p.active })}>{p.active ? 'Switch off' : 'Switch on'}</button>
        <button className={btnGhost} onClick={async () => { if (!window.confirm(`Delete ${p.name}? This cannot be undone.`)) return; const r = await api(`/api/admin/products-catalog/${id}`, 'DELETE'); if (r.ok) router.push('/admin/sourcing/products'); else setError(r.error); }}>Delete</button>
      </div>
      <ErrorText error={error} />
      <div className={card}>
        <h3 className="font-bold">Details</h3>
        <SpecForm key={key} fields={PRODUCT_SPEC.filter((f) => f.column !== 'active')} initial={p} options={{ category: cats.map((c) => ({ value: c.key, label: c.label })) }} submitLabel="Save" onSubmit={async (v) => { const r = await api(`/api/admin/products-catalog/${id}`, 'PATCH', v); if (!r.ok) return r.error; load(); return null; }} />
      </div>

      <div className={card}>
        <h3 className="font-bold">Standards claimed</h3>
        <p className="text-xs text-slate-500">A claim is compliant only with an admin-verified, unexpired third-party certificate or accredited lab report for this product and this exact edition (today: {d.today}). A manufacturer declaration never makes it compliant.</p>
        {d.claims.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 text-sm border-b border-slate-100 pb-2">
            <span className="font-semibold">{c.standard.designation}</span><StatusBadge status={c.status} />
            <span className="text-slate-500">{[c.protection_type, c.protection_class].filter(Boolean).join(' · ')}</span>
            <button className={btnGhost} onClick={() => window.confirm('Remove this claim?') && act(`/api/admin/products-catalog/${id}/compliance/${c.id}`, 'DELETE')}>Remove</button>
          </div>
        ))}
        <ClaimForm stds={stds} onAdd={(v) => act(`/api/admin/products-catalog/${id}/compliance`, 'POST', v)} />
      </div>

      <div className={card}>
        <h3 className="font-bold">Certificates</h3>
        {d.certificates.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 text-sm border-b border-slate-100 pb-2">
            <span className="font-semibold">{stds.find((s) => s.id === c.standard_id)?.designation ?? ''}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{DOCUMENT_TYPE_LABEL[c.document_type] ?? c.document_type}</span>
            <span>{c.file_name}</span>
            <span className={c.status === 'verified' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>{c.status === 'verified' ? `Verified by ${c.verified_by_email}` : 'Uploaded (not verified)'}</span>
            <span className="text-slate-500">{c.issuing_body ? `${c.issuing_body} · ` : ''}{c.document_type === 'accredited_lab_report' && c.accreditation ? `${c.accreditation} · ` : ''}expires {c.expires_on ?? '—'}</span>
            <WarningBadge w={c.warning} days={dayDiff(c.expires_on, d.today)} />
            <button className={btnGhost} onClick={async () => { const r = await api<{ url: string }>(`/api/admin/certificates/${c.id}`); if (r.ok) window.location.assign(r.data.url); else setError(r.error); }}>Download</button>
            {c.status === 'verified'
              ? <button className={btnGhost} onClick={() => act(`/api/admin/certificates/${c.id}/unverify`, 'POST')}>Remove verification</button>
              : <button className={btnGhost} onClick={() => window.confirm('Verify: you checked this file against the product, the standard edition, the issuer and the dates?') && act(`/api/admin/certificates/${c.id}/verify`, 'POST')}>Verify</button>}
            {c.status !== 'verified' && <button className={btnGhost} onClick={() => window.confirm('Delete this certificate?') && act(`/api/admin/certificates/${c.id}`, 'DELETE')}>Delete</button>}
            <CertEdit key={`${c.id}-${key}`} cert={c} onSave={(v) => act(`/api/admin/certificates/${c.id}`, 'PATCH', v)} />
          </div>
        ))}
        <CertUpload productId={id} stds={stds} onDone={load} onError={setError} />
      </div>

      <div className={card}>
        <h3 className="font-bold">Suppliers</h3>
        {d.suppliers.map((s) => (
          <div key={s.supplier.id} className="flex flex-wrap items-center gap-3 text-sm border-b border-slate-100 pb-2">
            <Link href={`/admin/sourcing/suppliers/${s.supplier.id}`} className="text-rivix font-semibold">{s.supplier.name}</Link><span className="font-mono text-xs">{s.supplier.code}</span>
            <span className="text-slate-500">{[s.supplier_sku && `SKU ${s.supplier_sku}`, s.moq !== null && `MOQ ${s.moq} ${s.moq_unit}`, s.lead_time_days !== null && `${s.lead_time_days} days`].filter(Boolean).join(' · ')}</span>
            <button className={btnGhost} onClick={() => window.confirm('Unlink this supplier?') && act(`/api/admin/products-catalog/${id}/suppliers/${s.supplier.id}`, 'DELETE')}>Unlink</button>
          </div>
        ))}
        <LinkForm sups={sups.filter((s) => !d.suppliers.some((x) => x.supplier.id === s.id))} onAdd={(v) => act(`/api/admin/products-catalog/${id}/suppliers`, 'POST', v)} />
      </div>
    </div>
  );
}

function ClaimForm({ stds, onAdd }: { stds: Std[]; onAdd: (v: Record<string, unknown>) => Promise<unknown> }) {
  const [sid, setSid] = useState('');
  return (
    <div className="space-y-2">
      <label className="space-y-1 block max-w-md"><span className={label}>Standard (exact edition)</span>
        <select className={input} value={sid} onChange={(e) => setSid(e.target.value)}><option value="">Choose…</option>{stds.map((s) => <option key={s.id} value={s.id}>{s.designation}{s.checked ? '' : ' (not checked)'}</option>)}</select>
      </label>
      {sid && <SpecForm fields={CLAIM_SPEC} submitLabel="Claim this standard" onSubmit={async (v) => { await onAdd({ ...v, standard_id: sid }); setSid(''); return null; }} />}
    </div>
  );
}
function LinkForm({ sups, onAdd }: { sups: Array<{ id: string; code: string; name: string }>; onAdd: (v: Record<string, unknown>) => Promise<unknown> }) {
  const [sid, setSid] = useState('');
  return (
    <div className="space-y-2">
      <label className="space-y-1 block max-w-md"><span className={label}>Link a supplier</span>
        <select className={input} value={sid} onChange={(e) => setSid(e.target.value)}><option value="">Choose…</option>{sups.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</select>
      </label>
      {sid && <SpecForm fields={LINK_SPEC} submitLabel="Link supplier" onSubmit={async (v) => { await onAdd({ ...v, supplier_id: sid }); setSid(''); return null; }} />}
    </div>
  );
}
type CertFields = { document_type: string; issuing_body: string; accreditation: string; issued_on: string; expires_on: string };
const blankCert: CertFields = { document_type: '', issuing_body: '', accreditation: '', issued_on: '', expires_on: '' };
/** The fields an admin types for a certificate (upload and edit share them). Accreditation shows for lab reports only. */
function CertFieldInputs({ v, setV }: { v: CertFields; setV: (v: CertFields) => void }) {
  return (
    <>
      <label className="space-y-1"><span className={label}>Document type</span><select className={input} value={v.document_type} onChange={(e) => setV({ ...v, document_type: e.target.value, accreditation: e.target.value === 'accredited_lab_report' ? v.accreditation : '' })}><option value="">Choose…</option>{DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>)}</select></label>
      <label className="space-y-1"><span className={label}>{v.document_type === 'manufacturer_declaration' ? 'Issued by (manufacturer)' : 'Issued by'}</span><input className={input} maxLength={200} value={v.issuing_body} onChange={(e) => setV({ ...v, issuing_body: e.target.value })} /></label>
      {v.document_type === 'accredited_lab_report' && <label className="space-y-1"><span className={label}>Lab accreditation (optional)</span><input className={input} maxLength={300} placeholder="ISO/IEC 17025, SCC #…" value={v.accreditation} onChange={(e) => setV({ ...v, accreditation: e.target.value })} /></label>}
      <label className="space-y-1"><span className={label}>Issued / expires</span><div className="flex gap-1"><input type="date" className={input} value={v.issued_on} onChange={(e) => setV({ ...v, issued_on: e.target.value })} /><input type="date" className={input} value={v.expires_on} onChange={(e) => setV({ ...v, expires_on: e.target.value })} /></div></label>
    </>
  );
}
function CertEdit({ cert, onSave }: { cert: Cert; onSave: (v: CertFields) => Promise<{ ok: boolean }> }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<CertFields>({ document_type: cert.document_type, issuing_body: cert.issuing_body ?? '', accreditation: cert.accreditation ?? '', issued_on: cert.issued_on ?? '', expires_on: cert.expires_on ?? '' });
  if (!open) return <button className={btnGhost} onClick={() => setOpen(true)}>Edit details</button>;
  return (
    <form className="w-full grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end" onSubmit={async (e) => {
      e.preventDefault();
      if (cert.status === 'verified' && !window.confirm('Changing a verified certificate removes the verification; it must be verified again. Continue?')) return;
      const r = await onSave(v); if (r.ok) setOpen(false);
    }}>
      <CertFieldInputs v={v} setV={setV} />
      <div className="flex gap-2"><button className={btn}>Save</button><button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}
function CertUpload({ productId, stds, onDone, onError }: { productId: string; stds: Std[]; onDone: () => void; onError: (e: string | null) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [std, setStd] = useState('');
  const [v, setV] = useState<CertFields>(blankCert);
  const [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end" onSubmit={async (e) => {
      e.preventDefault(); if (!file || !std) { onError('Choose the file and the standard.'); return; }
      if (!v.document_type) { onError('Choose the document type.'); return; }
      setBusy(true);
      const u = await api<{ path: string; token: string }>('/api/admin/certificates/upload-url', 'POST', { file_name: file.name, size: file.size });
      if (!u.ok) { setBusy(false); onError(u.error); return; }
      const up = await supabaseBrowser.storage.from(CERT_BUCKET).uploadToSignedUrl(u.data.path, u.data.token, file, { contentType: file.type || 'application/octet-stream' });
      if (up.error) { setBusy(false); onError(up.error.message); return; }
      const r = await api('/api/admin/certificates', 'POST', { path: u.data.path, product_id: productId, file_name: file.name, standard_id: std, ...v });
      setBusy(false); if (!r.ok) { onError(r.error); return; }
      onError(null); setFile(null); setStd(''); setV(blankCert); onDone();
    }}>
      <label className="space-y-1"><span className={label}>File (PDF, JPEG, PNG)</span><input type="file" accept="application/pdf,image/jpeg,image/png" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <label className="space-y-1"><span className={label}>Standard</span><select className={input} value={std} onChange={(e) => setStd(e.target.value)}><option value="">Choose…</option>{stds.map((s) => <option key={s.id} value={s.id}>{s.designation}</option>)}</select></label>
      <CertFieldInputs v={v} setV={setV} />
      <button className={btn} disabled={busy}>{busy ? 'Uploading…' : 'Upload certificate'}</button>
    </form>
  );
}
