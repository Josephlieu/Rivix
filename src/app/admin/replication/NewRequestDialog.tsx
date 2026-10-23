'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { createReplication, uploadReplicationPhoto, getReplicationLookups, type ReplicationRequest } from '@/lib/replicationStorage';

const GARMENTS: ReplicationRequest['garmentType'][] = ['jacket', 'parka', 'coat', 'vest', 'pants', 'overalls', 'hoodie'];
const MAX_PHOTOS = 12;
const MAX_BYTES = 4 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Phone photos are often over the 4 MB limit. Shrink big ones to at most 1800 px (JPEG) before sending.
async function prepare(file: File): Promise<File> {
  if (file.size <= 1_500_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (blob) return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { /* fall through: the server will refuse it with a clear message if it is still too big */ }
  return file;
}

interface Props {
  role: 'admin' | 'rep';
  onClose: () => void;
  onCreated: (r: ReplicationRequest) => void;
}

// Admin enters a garment on a customer's behalf: who it is for, what it is, and photos from several angles.
export default function NewRequestDialog({ role, onClose, onCreated }: Props) {
  const [customers, setCustomers] = useState<Array<{ name: string; code: string }>>([]);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [clientName, setClientName] = useState('');
  const [productName, setProductName] = useState('');
  const [garmentType, setGarmentType] = useState<ReplicationRequest['garmentType']>('jacket');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const q = clientName.trim().toLowerCase();
  const matches = customers.filter(c => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)).slice(0, 50);
  const exact = customers.some(c => c.name.toLowerCase() === q);
  const pick = (name: string) => { setClientName(name); setListOpen(false); };

  // Suggest company names (typing a new name is fine too: customers are only a name on the request, never a link).
  // An admin also gets the sales reps to give the request to; a rep's request always belongs to that rep.
  const [reps, setReps] = useState<Array<{ id: string; name: string }>>([]);
  const [repId, setRepId] = useState('');
  const [repName, setRepName] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  useEffect(() => {
    getReplicationLookups()
      .then(l => { setCustomers(l.customers.map(name => ({ name, code: '' }))); setReps(l.reps); setRepName(l.repName); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const wrongType = picked.filter(f => !OK_TYPES.includes(f.type));
    const room = MAX_PHOTOS - files.length;
    setFiles(prev => [...prev, ...picked.filter(f => OK_TYPES.includes(f.type))].slice(0, MAX_PHOTOS));
    setError(
      wrongType.length ? 'Only JPEG, PNG or WebP photos can be added.'
      : picked.length > room ? `A request can hold up to ${MAX_PHOTOS} photos.` : ''
    );
    if (input.current) input.current.value = '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!clientName.trim() || !productName.trim()) { setError('Customer and product name are required.'); return; }
    setBusy(true); setError('');
    let created: ReplicationRequest | null = null;
    try {
      created = await createReplication({
        clientName, productName, garmentType, repId: role === 'admin' ? repId || null : undefined,
        specs: {
          fabricWeight: '', coreMaterial: '', liningMaterial: '', zippers: '', buttonsSnaps: '', safetyRating: '',
          reflectiveStriping: '', pocketsCount: '', seamConstruction: '', specialInstructions: notes.trim(), annotations: [], garmentPosted: posted,
        },
        messages: [],
      });
      let latest = created;
      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${files.length}…`);
        const f = await prepare(files[i]);
        if (f.size > MAX_BYTES) throw new Error(`"${files[i].name}" is still over 4 MB after shrinking.`);
        latest = await uploadReplicationPhoto(created.id, f);
      }
      onCreated(latest);
    } catch (err) {
      // The request itself is saved; only the photos did not all go up. Show it so nothing is lost silently.
      if (created) { onCreated(created); setError(''); window.alert(`The request was created, but a photo failed: ${err instanceof Error ? err.message : 'unknown error'}\nOpen the request and add the photos again.`); }
      else setError(err instanceof Error ? err.message : 'Could not create the request.');
      setBusy(false); setProgress('');
    }
  };

  const field = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rivix/30';
  return (
    <Modal onClose={onClose} busy={busy} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">New replication request</h2>
          <p className="text-xs text-slate-400">Enter a garment for a customer. Add photos from several angles (front, back, pockets, labels, zippers): the AI reads all of them.</p>
        </div>

        <div className="relative space-y-1" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setListOpen(false); }}>
          <label htmlFor="rep-customer" className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Customer</label>
          <div className="relative">
            <input
              id="rep-customer" className={`${field} pr-9`} value={clientName} autoComplete="off" role="combobox"
              aria-expanded={listOpen} aria-controls="rep-customer-list"
              onChange={e => { setClientName(e.target.value); setListOpen(true); setActive(0); }}
              onFocus={() => setListOpen(true)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setListOpen(true); setActive(a => Math.min(a + 1, matches.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
                else if (e.key === 'Enter' && listOpen && matches[active]) { e.preventDefault(); pick(matches[active].name); }
                else if (e.key === 'Escape' && listOpen) { e.stopPropagation(); setListOpen(false); }
              }}
              placeholder="Choose a customer or type a new name" maxLength={200} required
            />
            <button type="button" tabIndex={-1} aria-label="Show customers" onMouseDown={e => e.preventDefault()} onClick={() => { setListOpen(o => !o); document.getElementById('rep-customer')?.focus(); }}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-700">▾</button>
          </div>
          {listOpen && (
            <ul id="rep-customer-list" role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl">
              {matches.map((c, i) => (
                <li key={c.code + c.name} role="option" aria-selected={i === active}
                  onMouseDown={e => e.preventDefault()} onClick={() => pick(c.name)} onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${i === active ? 'bg-rivix/10 text-rivix' : 'text-slate-700'}`}>
                  <span className="truncate font-semibold">{c.name}</span>
                  {c.code && <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-slate-400">{c.code}</span>}
                </li>
              ))}
              {q && !exact && (
                <li role="option" aria-selected={false} onMouseDown={e => e.preventDefault()} onClick={() => pick(clientName.trim())}
                  className="cursor-pointer border-t border-slate-100 px-3 py-2 text-slate-600 hover:bg-slate-50">
                  Use “<span className="font-bold">{clientName.trim()}</span>” as a new customer name
                </li>
              )}
              {matches.length === 0 && !q && <li className="px-3 py-2 text-slate-400">No customers yet: type a name.</li>}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Product name</span>
            <input className={field} value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Winter work parka" maxLength={200} required />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Garment type</span>
            <select className={field} value={garmentType} onChange={e => setGarmentType(e.target.value as ReplicationRequest['garmentType'])}>
              {GARMENTS.map(g => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Special instructions (optional)</span>
          <textarea className={field} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything the customer asked for: colour, logo, safety rating…" maxLength={2000} />
        </label>

        {role === 'admin' ? (
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Sales rep</span>
            <select className={field} value={repId} onChange={e => setRepId(e.target.value)}>
              <option value="">Admin (handled directly)</option>
              {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <span className="text-[11px] text-slate-400">The rep who owns this request sees it and chats with you about it. The customer never sees it.</span>
          </label>
        ) : (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">This request will be yours{repName ? ` (${repName})` : ''}. The admin is notified, reviews it, and you can chat with them on the request.</p>
        )}

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#c61213]" checked={posted} onChange={e => setPosted(e.target.checked)} />
          <span><span className="font-bold">The customer is posting the garment to RIVIX.</span> <span className="text-slate-400">Leave it off if you only have photos.</span></span>
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Photos ({files.length}/{MAX_PHOTOS})</span>
            <button type="button" onClick={() => input.current?.click()} disabled={busy || files.length >= MAX_PHOTOS}
              className="text-xs font-bold text-rivix hover:underline disabled:opacity-40">+ Add photos</button>
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => addFiles(e.target.files)} />
          {files.length === 0 ? (
            <button type="button" onClick={() => input.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-8 text-sm text-slate-400 hover:border-rivix hover:text-rivix transition-colors">
              Click to choose photos (JPEG, PNG or WebP)
            </button>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {previews.map((src, i) => (
                <div key={src} className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full rounded-lg border border-slate-200 object-cover" />
                  {!busy && (
                    <button type="button" onClick={() => setFiles(f => f.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}
                      className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-slate-900 text-[10px] font-bold text-white">✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-400">Large photos are shrunk automatically. The first photo is the main one; you can change the order later.</p>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Photo checklist: tick what you have</p>
            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {['Whole garment, front', 'Whole garment, back', 'Zipper or front closure, up close', 'A pocket, up close', 'A cuff, up close', 'The inside label (care and fabric text readable)', 'A seam or hem, up close'].map(item => (
                <label key={item} className="flex items-start gap-2 text-[13px] text-slate-600">
                  <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-[#c61213]" /> {item}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">A guide only: it does not block the upload. The AI works better with close-ups of the label, the zipper and the cuff.</p>
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          {progress && <span className="mr-auto text-xs text-slate-500">{progress}</span>}
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-rivix px-5 py-2 text-sm font-bold text-white shadow-lg shadow-rivix/30 hover:bg-rivix-dark disabled:opacity-60">
            {busy ? 'Creating…' : 'Create request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
