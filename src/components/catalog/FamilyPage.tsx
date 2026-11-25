'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Heart, ShieldCheck, ShoppingCart, Package } from 'lucide-react';
import { ASK_REP, CERT_NOTE, MAX_SAMPLE_QTY, ONE_SIZE, OTHER_PREFIX, PRICE_ON_QUOTE, SPEC_LIMITS, minimumCheck, type Settings } from '@/lib/catalog-families';
import type { FamilyView } from '@/lib/catalog-public';

const input = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm';
const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest';

// One product family (2026-11-26). Customers: their spec, "How many do you need?" by size, Add to quote, Save, Request a
// sample. Reps: the same page, read-only. Standards: "Available certified to <standard>" plus the note that certification
// depends on the exact fabric and design, or "Ask your rep about certification".
export default function FamilyPage({ mode, backHref }: { mode: 'customer' | 'rep'; backHref: string }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [f, setF] = useState<FamilyView | null>(null);
  const [settings, setSettings] = useState<Settings>({ min_order_qty: 50, note_below_qty: 300 });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState(0);
  // The spec form.
  const [opts, setOpts] = useState<Record<string, string>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const [colour, setColour] = useState('');
  const [standard, setStandard] = useState('');
  const [branding, setBranding] = useState('');
  const [details, setDetails] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<Array<{ size: string; qty: string }>>([]);
  const [sampleQty, setSampleQty] = useState('1');
  const [sampleNote, setSampleNote] = useState('');
  const [sampling, setSampling] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/catalog/families/${id}`); const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Could not load this product.'); return; }
      setF(d.family); setSettings(d.settings); setSaved(Boolean(d.saved));
    })();
  }, [id]);

  const sizes = useMemo(() => {
    if (!f) return [];
    const base = f.typicalSizes.length ? f.typicalSizes.map((s) => ({ size: s, qty: Number(qty[s] || 0) })) : [{ size: ONE_SIZE, qty: Number(qty[ONE_SIZE] || 0) }];
    return [...base, ...extra.map((e) => ({ size: e.size.trim(), qty: Number(e.qty || 0) }))].filter((s) => s.size && s.qty > 0);
  }, [f, qty, extra]);
  const total = sizes.reduce((n, s) => n + (Number.isFinite(s.qty) ? s.qty : 0), 0);
  const min = total ? minimumCheck(total, settings) : null;

  if (error && !f) return <div className="space-y-4"><Link href={backHref} className="text-sm text-slate-500 inline-flex items-center gap-1"><ArrowLeft size={14} />Back</Link><p className="text-sm text-red-600">{error}</p></div>;
  if (!f) return <p className="text-sm text-slate-400">Loading…</p>;

  const spec = () => ({
    options: Object.fromEntries(Object.entries(opts).filter(([, v]) => v).map(([k, v]) => [k, v === '__other' ? `${OTHER_PREFIX}${other[k] ?? ''}` : v])),
    colour, standard, branding, details,
  });
  const post = async (url: string, body: unknown, method = 'POST') => {
    setBusy(true); setError(null); setDone(null);
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error || 'Something went wrong.'); return null; }
    return d;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href={backHref} className="text-sm text-slate-500 inline-flex items-center gap-1"><ArrowLeft size={14} />All products</Link>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-[4/3] bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link from our own route */}
            {f.imageIds.length ? <img src={`/api/catalog/images/${f.imageIds[image] ?? f.imageIds[0]}`} alt={f.name} className="w-full h-full object-contain" /> : <Package size={48} className="text-slate-200" />}
          </div>
          {f.imageIds.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {f.imageIds.map((img, i) => (
                <button key={img} onClick={() => setImage(i)} className={`w-16 h-16 rounded-xl overflow-hidden border ${i === image ? 'border-rivix' : 'border-slate-200'}`} aria-label={`Image ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/catalog/images/${img}`} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{f.categoryLabel}</p>
            <h1 className="text-2xl font-bold text-slate-900">{f.name} <span className="text-sm font-semibold text-slate-400">{f.code}</span></h1>
            <p className="text-sm font-semibold text-slate-500">{PRICE_ON_QUOTE}</p>
          </div>
          {f.description && <p className="text-sm text-slate-700 whitespace-pre-line">{f.description}</p>}
          {f.typicalOptions.length > 0 && (
            <div className="space-y-1">
              <p className={label}>Typical options</p>
              <ul className="text-sm text-slate-600 space-y-0.5">{f.typicalOptions.map((g) => <li key={g.label}><span className="font-semibold">{g.label}:</span> {g.choices.join(', ')}</li>)}</ul>
            </div>
          )}
          {(f.typicalSizes.length > 0 || f.typicalColours.length > 0) && (
            <div className="text-sm text-slate-600 space-y-0.5">
              {f.typicalSizes.length > 0 && <p><span className="font-semibold">Sizes:</span> {f.typicalSizes.join(', ')}</p>}
              {f.typicalColours.length > 0 && <p><span className="font-semibold">Colours:</span> {f.typicalColours.join(', ')}</p>}
            </div>
          )}
          <div className="rounded-2xl bg-slate-50 p-3 space-y-1" data-testid="certification">
            {f.standards.length ? (
              <>
                {f.standards.map((s) => <p key={s} className="text-sm font-semibold text-emerald-700 inline-flex items-center gap-1.5 w-full"><ShieldCheck size={14} />Available certified to {s}</p>)}
                <p className="text-xs text-slate-500">{CERT_NOTE}</p>
              </>
            ) : <p className="text-sm text-slate-500">{ASK_REP}</p>}
          </div>
        </div>
      </div>

      {mode === 'customer' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
          <h2 className="text-lg font-bold text-slate-900">Your spec</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {f.typicalOptions.map((g) => (
              <label key={g.label} className="space-y-1">
                <span className={label}>{g.label}</span>
                <select className={input} value={opts[g.label] ?? ''} onChange={(e) => setOpts({ ...opts, [g.label]: e.target.value })}>
                  <option value="">No preference</option>
                  {g.choices.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__other">Other (describe)</option>
                </select>
                {opts[g.label] === '__other' && <input className={input} maxLength={SPEC_LIMITS.other} placeholder={`Your ${g.label.toLowerCase()}`} value={other[g.label] ?? ''} onChange={(e) => setOther({ ...other, [g.label]: e.target.value })} />}
              </label>
            ))}
            <label className="space-y-1"><span className={label}>Colour</span>
              <input className={input} list={`colours-${f.id}`} maxLength={SPEC_LIMITS.colour} value={colour} onChange={(e) => setColour(e.target.value)} placeholder="e.g. Navy" />
              <datalist id={`colours-${f.id}`}>{f.typicalColours.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="space-y-1"><span className={label}>Standard needed</span>
              <select className={input} value={standard} onChange={(e) => setStandard(e.target.value)}>
                <option value="">Not needed, or ask my rep</option>
                {f.standards.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="space-y-1 sm:col-span-2"><span className={label}>Branding</span>
              <input className={input} maxLength={SPEC_LIMITS.branding} value={branding} onChange={(e) => setBranding(e.target.value)} placeholder="Logo on the back, 30 cm, white" />
            </label>
            <label className="space-y-1 sm:col-span-2"><span className={label}>Anything else about your spec</span>
              <textarea className={input} rows={3} maxLength={SPEC_LIMITS.details} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Fabric weight, reflective tape, pockets, closures…" />
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-slate-900">How many do you need?</h3>
            <div className="flex flex-wrap gap-3">
              {(f.typicalSizes.length ? f.typicalSizes : [ONE_SIZE]).map((s) => (
                <label key={s} className="space-y-1 w-24"><span className={label}>{s}</span>
                  <input type="number" min={0} inputMode="numeric" className={input} value={qty[s] ?? ''} onChange={(e) => setQty({ ...qty, [s]: e.target.value })} />
                </label>
              ))}
              {f.typicalSizes.length > 0 && extra.map((x, i) => (
                <div key={i} className="space-y-1 w-36">
                  <input className={input} placeholder="Size" maxLength={30} value={x.size} onChange={(e) => setExtra(extra.map((y, j) => (j === i ? { ...y, size: e.target.value } : y)))} />
                  <input type="number" min={0} className={input} placeholder="How many" value={x.qty} onChange={(e) => setExtra(extra.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))} />
                </div>
              ))}
            </div>
            {f.typicalSizes.length > 0 && <button type="button" onClick={() => setExtra([...extra, { size: '', qty: '' }])} className="text-xs font-bold text-rivix">+ Add a size</button>}
            <p className="text-sm text-slate-600">Total: <b>{total}</b> {min && !min.ok && <span className="text-red-600">· {min.error}</span>}{min && min.ok && min.note && <span className="text-amber-700">· {min.note}</span>}</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && <p className="text-sm text-emerald-700 font-semibold">{done}</p>}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy || !total || Boolean(min && !min.ok)} onClick={async () => {
              const d = await post('/api/portal/quote-cart/lines', { family_id: f.id, spec: spec(), sizes, quantity: total });
              if (d) setDone(`Added to your quote cart.${d.note ? ` ${d.note}` : ''}`);
            }} className="px-5 py-2.5 rounded-xl bg-rivix text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"><ShoppingCart size={16} />Add to quote</button>
            <button disabled={busy} onClick={async () => {
              const d = saved ? await post(`/api/portal/saved/${f.id}`, undefined, 'DELETE') : await post('/api/portal/saved', { family_id: f.id });
              if (d) setSaved(!saved);
            }} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 inline-flex items-center gap-2"><Heart size={16} className={saved ? 'fill-rivix text-rivix' : ''} />{saved ? 'Saved' : 'Save'}</button>
            <button disabled={busy} onClick={() => setSampling(!sampling)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600">Request a sample</button>
            <button onClick={() => router.push('/portal/quote')} className="px-4 py-2.5 text-sm font-bold text-slate-500">Go to quote cart</button>
          </div>
          {sampling && (
            <div className="rounded-2xl bg-slate-50 p-4 space-y-3">
              <p className="text-sm text-slate-600">Samples use the spec above. Your rep will confirm what can be sent.</p>
              <div className="flex flex-wrap gap-3">
                <label className="space-y-1 w-28"><span className={label}>Samples (1–{MAX_SAMPLE_QTY})</span><input type="number" min={1} max={MAX_SAMPLE_QTY} className={input} value={sampleQty} onChange={(e) => setSampleQty(e.target.value)} /></label>
                <label className="space-y-1 flex-1 min-w-[14rem]"><span className={label}>Note</span><input className={input} maxLength={SPEC_LIMITS.note} value={sampleNote} onChange={(e) => setSampleNote(e.target.value)} /></label>
              </div>
              <button disabled={busy} onClick={async () => {
                const d = await post('/api/portal/sample-requests', { family_id: f.id, spec: spec(), quantity: Number(sampleQty), note: sampleNote });
                if (d) { setDone('Sample request sent. You can follow it on your Requests page.'); setSampling(false); setSampleNote(''); }
              }} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">Send sample request</button>
            </div>
          )}
        </div>
      )}
      {mode === 'rep' && <p className="text-xs text-slate-400">This is what your customers see. They add products to a quote cart and submit it; it reaches you on the Requests page.</p>}
    </div>
  );
}
