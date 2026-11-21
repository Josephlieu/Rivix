'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CONTACT_SPEC, SUPPLIER_SPEC } from '@/lib/catalog-fields';
import { SpecForm, api, asText, btnGhost, card, ErrorText } from '../../ui';

type Contact = { id: string; contact_name: string | null; email: string | null; whatsapp: string | null; is_primary: boolean };
type Data = { supplier: Record<string, unknown> & { id: string; code: string; name: string; active: boolean }; contacts: Contact[]; products: Array<{ product: { id: string; code: string | null; name: string; active: boolean }; supplier_sku: string | null }> };
export default function SupplierPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const load = useCallback(() => { api<Data>(`/api/admin/suppliers/${id}`).then((r) => { if (r.ok) { setD(r.data); setKey((k) => k + 1); } else setError(r.error); }); }, [id]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <ErrorText error={error ?? 'Loading…'} />;
  const s = d.supplier;
  const act = async (url: string, method: string, body?: unknown) => { const r = await api(url, method, body); if (!r.ok) setError(r.error); else { setError(null); load(); } return r; };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/sourcing/suppliers" className="text-sm text-slate-500">← Suppliers</Link>
        <h2 className="text-xl font-black">{s.name}</h2>
        <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 rounded">{s.code}</span>
        <span className="text-xs text-slate-500">{s.active ? 'Active' : 'Inactive'}</span>
        <button className={btnGhost} onClick={() => act(`/api/admin/suppliers/${id}`, 'PATCH', { active: !s.active })}>{s.active ? 'Switch off' : 'Switch on'}</button>
        <button className={btnGhost} onClick={async () => { if (!window.confirm(`Delete ${s.name}? This cannot be undone.`)) return; const r = await api(`/api/admin/suppliers/${id}`, 'DELETE'); if (r.ok) router.push('/admin/sourcing/suppliers'); else setError(r.error); }}>Delete</button>
      </div>
      <ErrorText error={error} />
      <div className={card}>
        <h3 className="font-bold">Details</h3>
        <SpecForm key={key} fields={SUPPLIER_SPEC.filter((f) => f.column !== 'active')} initial={s} submitLabel="Save" onSubmit={async (v) => { const r = await api(`/api/admin/suppliers/${id}`, 'PATCH', v); if (!r.ok) return r.error; load(); return null; }} />
      </div>
      <div className={card}>
        <h3 className="font-bold">Contacts <span className="text-xs font-normal text-slate-400">(admin only)</span></h3>
        {d.contacts.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 text-sm border-b border-slate-100 pb-2">
            <span className="font-semibold">{c.contact_name || '—'}</span><span>{c.email}</span><span>{c.whatsapp}</span>
            {c.is_primary ? <span className="text-xs font-bold text-emerald-700">Primary</span> : <button className={btnGhost} onClick={() => act(`/api/admin/suppliers/${id}/contacts/${c.id}`, 'PATCH', { is_primary: true })}>Make primary</button>}
            <button className={btnGhost} onClick={() => window.confirm('Remove this contact?') && act(`/api/admin/suppliers/${id}/contacts/${c.id}`, 'DELETE')}>Remove</button>
          </div>
        ))}
        <SpecForm key={`c${key}`} fields={CONTACT_SPEC} submitLabel="Add contact" onSubmit={async (v) => { const r = await api(`/api/admin/suppliers/${id}/contacts`, 'POST', v); if (!r.ok) return r.error; load(); return null; }} />
      </div>
      <div className={card}>
        <h3 className="font-bold">Products supplied</h3>
        {!d.products.length && <p className="text-sm text-slate-400">None yet. Link products from the product page.</p>}
        {d.products.map((p) => <div key={p.product.id} className="text-sm"><Link className="text-rivix font-semibold" href={`/admin/sourcing/products/${p.product.id}`}>{asText(p.product.code)} {p.product.name}</Link>{p.supplier_sku ? <span className="text-slate-500"> · SKU {p.supplier_sku}</span> : null}</div>)}
      </div>
    </div>
  );
}
