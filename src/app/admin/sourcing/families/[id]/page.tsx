'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { IMAGE_BUCKET } from '@/lib/image-files';
import { MAX_IMAGES, type OptionGroup } from '@/lib/catalog-families';
import { api, btn, btnGhost, card, input, label, ErrorText } from '../../ui';

type Fam = { id: string; code: string; name: string; category: string; description: string | null; typical_options: OptionGroup[]; typical_sizes: string[]; typical_colours: string[]; sort: number; visible_to_customers: boolean; active: boolean };
type Data = {
  family: Fam; categories: Array<{ key: string; label: string }>;
  images: Array<{ id: string; file_name: string; sort: number; alt_text: string | null }>;
  standards: Array<{ id: string; designation: string; checked: boolean; shownToCustomers: boolean }>;
  products: Array<{ id: string; code: string | null; name: string; active: boolean }>;
};
type Std = { id: string; designation: string };

// One product family (2026-11-26, admin). What customers see comes only from the fields on this page; supplier products
// linked here stay admin-only and are used only to decide which standards customers may see.
export default function FamilyAdminPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [stds, setStds] = useState<Std[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<Array<{ label: string; choices: string }>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [std, setStd] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api<Data>(`/api/admin/families/${id}`).then((r) => {
      if (!r.ok) { setError(r.error); return; }
      const f = r.data.family;
      setD(r.data);
      setV({ code: f.code, name: f.name, category: f.category, description: f.description ?? '', typical_sizes: f.typical_sizes.join('; '), typical_colours: f.typical_colours.join('; '), sort: String(f.sort) });
      setGroups(f.typical_options.map((g) => ({ label: g.label, choices: g.choices.join('; ') })));
    });
  }, [id]);
  useEffect(() => { load(); api<{ standards: Std[] }>('/api/admin/standards').then((r) => r.ok && setStds(r.data.standards)); }, [load]);
  const act = async (url: string, method: string, body?: unknown) => { setBusy(true); const r = await api(url, method, body); setBusy(false); if (!r.ok) setError(r.error); else { setError(null); load(); } return r; };
  if (!d) return <ErrorText error={error ?? 'Loading…'} />;
  const f = d.family;
  const unbacked = d.standards.filter((s) => !s.shownToCustomers);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/sourcing/families" className="text-sm text-slate-500">← Families</Link>
        <h2 className="text-xl font-black">{f.code} {f.name}</h2>
        {f.visible_to_customers && f.active ? <span className="text-xs font-bold text-emerald-700">Published</span> : <span className="text-xs font-bold text-slate-400">Hidden from customers</span>}
        <button className={btn} disabled={busy} onClick={() => act(`/api/admin/families/${id}`, 'PATCH', { visible_to_customers: !f.visible_to_customers })}>{f.visible_to_customers ? 'Unpublish' : 'Publish'}</button>
        <button className={btnGhost} disabled={busy} onClick={() => act(`/api/admin/families/${id}`, 'PATCH', { active: !f.active })}>{f.active ? 'Switch off' : 'Switch on'}</button>
      </div>
      <ErrorText error={error} />

      <div className={card}>
        <h3 className="font-bold">Details customers see</h3>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={async (e) => {
          e.preventDefault();
          await act(`/api/admin/families/${id}`, 'PATCH', {
            code: v.code, name: v.name, category: v.category, description: v.description, typical_sizes: v.typical_sizes, typical_colours: v.typical_colours, sort: Number(v.sort || 0),
            typical_options: groups.filter((g) => g.label.trim()).map((g) => ({ label: g.label, choices: g.choices.split(';').map((x) => x.trim()).filter(Boolean) })),
          });
        }}>
          <label className="space-y-1"><span className={label}>Code</span><input className={input} value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} /></label>
          <label className="space-y-1"><span className={label}>Name</span><input className={input} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
          <label className="space-y-1"><span className={label}>Category</span><select className={input} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{d.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-3"><span className={label}>Description</span><textarea rows={3} className={input} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
          <label className="space-y-1"><span className={label}>Typical sizes</span><input className={input} placeholder="S; M; L; XL (blank = one size)" value={v.typical_sizes} onChange={(e) => setV({ ...v, typical_sizes: e.target.value })} /></label>
          <label className="space-y-1"><span className={label}>Typical colours</span><input className={input} placeholder="Navy; Orange" value={v.typical_colours} onChange={(e) => setV({ ...v, typical_colours: e.target.value })} /></label>
          <label className="space-y-1"><span className={label}>Sort</span><input type="number" className={input} value={v.sort} onChange={(e) => setV({ ...v, sort: e.target.value })} /></label>
          <div className="sm:col-span-2 lg:col-span-3 space-y-2">
            <span className={label}>Typical options (customers pick one per group, or describe their own)</span>
            {groups.map((g, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <input className={`${input} max-w-[12rem]`} placeholder="Fabric" value={g.label} onChange={(e) => setGroups(groups.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className={`${input} flex-1 min-w-[16rem]`} placeholder="88/12 FR cotton 7 oz; Nomex IIIA 4.5 oz" value={g.choices} onChange={(e) => setGroups(groups.map((x, j) => (j === i ? { ...x, choices: e.target.value } : x)))} />
                <button type="button" className={btnGhost} onClick={() => setGroups(groups.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            {groups.length < 12 && <button type="button" className={btnGhost} onClick={() => setGroups([...groups, { label: '', choices: '' }])}>+ Add an option group</button>}
          </div>
          <div><button className={btn} disabled={busy}>Save</button></div>
        </form>
      </div>

      <div className={card}>
        <h3 className="font-bold">Images <span className="text-xs font-normal text-slate-400">({d.images.length} of {MAX_IMAGES}; JPEG, PNG or WebP, 5 MB; metadata such as GPS is removed)</span></h3>
        <div className="flex flex-wrap gap-3">
          {d.images.map((img) => (
            <div key={img.id} className="w-40 space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link from our own route */}
              <img src={`/api/catalog/images/${img.id}`} alt={img.alt_text ?? ''} className="w-40 h-32 object-cover rounded-xl border border-slate-100" />
              <p className="text-xs text-slate-500 truncate">{img.file_name}</p>
              <button className={btnGhost} onClick={() => window.confirm('Remove this image?') && act(`/api/admin/families/${id}/images/${img.id}`, 'DELETE')}>Remove</button>
            </div>
          ))}
        </div>
        {d.images.length < MAX_IMAGES && (
          <form className="flex flex-wrap gap-3 items-end" onSubmit={async (e) => {
            e.preventDefault(); if (!file) { setError('Choose an image.'); return; }
            setBusy(true);
            const u = await api<{ path: string; token: string }>(`/api/admin/families/${id}/images/upload-url`, 'POST', { size: file.size });
            if (!u.ok) { setBusy(false); setError(u.error); return; }
            const up = await supabaseBrowser.storage.from(IMAGE_BUCKET).uploadToSignedUrl(u.data.path, u.data.token, file, { contentType: file.type || 'application/octet-stream' });
            if (up.error) { setBusy(false); setError(up.error.message); return; }
            setBusy(false);
            const r = await act(`/api/admin/families/${id}/images`, 'POST', { path: u.data.path, file_name: file.name, alt_text: alt });
            if (r.ok) { setFile(null); setAlt(''); }
          }}>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <input className={`${input} max-w-xs`} placeholder="Short description (optional)" maxLength={200} value={alt} onChange={(e) => setAlt(e.target.value)} />
            <button className={btn} disabled={busy}>{busy ? 'Uploading…' : 'Add image'}</button>
          </form>
        )}
      </div>

      <div className={card}>
        <h3 className="font-bold">Standards it can be made to</h3>
        <p className="text-xs text-slate-500">Customers see &quot;Available certified to …&quot; only while an active product linked below has a Compliant claim (third-party certificate or accredited lab report, verified and unexpired) for that exact edition.</p>
        {unbacked.length > 0 && <p className="text-xs font-semibold text-amber-700">No certified product behind: {unbacked.map((s) => s.designation).join(', ')}. Customers do not see {unbacked.length === 1 ? 'it' : 'them'}.</p>}
        {d.standards.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 text-sm border-b border-slate-100 pb-2">
            <span className="font-semibold">{s.designation}</span>
            {s.shownToCustomers ? <span className="text-xs font-bold text-emerald-700">Shown to customers</span> : <span className="text-xs font-bold text-amber-700">No certified product behind this</span>}
            <button className={btnGhost} onClick={() => act(`/api/admin/families/${id}/standards/${s.id}`, 'DELETE')}>Remove</button>
          </div>
        ))}
        <div className="flex gap-2">
          <select className={`${input} max-w-md`} value={std} onChange={(e) => setStd(e.target.value)}><option value="">Add a standard…</option>{stds.filter((s) => !d.standards.some((x) => x.id === s.id)).map((s) => <option key={s.id} value={s.id}>{s.designation}</option>)}</select>
          <button className={btnGhost} disabled={!std} onClick={async () => { await act(`/api/admin/families/${id}/standards`, 'POST', { standard_id: std }); setStd(''); }}>Add</button>
        </div>
      </div>

      <div className={card}>
        <h3 className="font-bold">Linked supplier products <span className="text-xs font-normal text-slate-400">(admin only; link them from each product&apos;s page)</span></h3>
        {!d.products.length && <p className="text-sm text-slate-400">None yet.</p>}
        {d.products.map((p) => <div key={p.id} className="text-sm"><Link className="text-rivix font-semibold" href={`/admin/sourcing/products/${p.id}`}>{p.code ?? ''} {p.name}</Link>{!p.active && <span className="text-slate-400"> (off)</span>}</div>)}
      </div>
    </div>
  );
}
