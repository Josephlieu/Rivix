'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Plus, X } from 'lucide-react';
import Toast, { type ToastMessage } from '@/components/Toast';
import { validateTemplate, describeTemplateChanges, lowersCertification, CERT_WORDS, CERTIFICATION, LIMITS, METHODS, SIZING_SYSTEMS, VIEWS, type Kind, type TemplateDraft } from '@/lib/template-admin';
import { currentDrawing } from '@/lib/drawings';
import type { TemplateBody, TemplateItem, TemplatePoint } from '@/lib/template-catalog';

// Task 31: edit a template and publish the change as a NEW version (two-step admins only). The current version is never
// changed: existing tech files keep the version they were made with. Unsaved work is kept in this browser only.
interface Version { version: number; body: TemplateBody; by: string; at: string; note: string }
interface Info { key: string; kind: Kind; label: string; description: string; version: number; active: boolean; drawing: boolean; usage: { types: Array<{ key: string; label: string }>; categories: Array<{ key: string; label: string }>; kits: string[] }; context: { baseKeys: string[]; families: string[] } }
const field = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rivix/20';
const lbl = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500';
const strip = (b: TemplateBody): TemplateBody => { const { label: _l, description: _d, ...rest } = b; return rest; }; // eslint-disable-line @typescript-eslint/no-unused-vars
const move = <T,>(list: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= list.length) return list; const c = [...list]; [c[i], c[j]] = [c[j], c[i]]; return c; };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <section className="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><h2 className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</h2>{hint && <p className="text-[11px] text-slate-400">{hint}</p>}{children}</section>;
}

export default function TemplateEditor() {
  const { key } = useParams<{ key: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<number | null>(null);
  const store = `rivix-template-draft:${key}`;

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/templates/${encodeURIComponent(key)}`, { cache: 'no-store' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error || 'Could not load the template.'); return; }
    setInfo(j.template); setVersions(j.versions);
    const cur: Version = j.versions[0];
    let saved: { base: number; draft: TemplateDraft } | null = null;
    try { saved = JSON.parse(localStorage.getItem(store) || 'null'); } catch { saved = null; }
    setDraft(saved && saved.base === j.template.version ? saved.draft : { label: j.template.label, description: j.template.description, body: strip(cur.body) });
  }, [key, store]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (draft && info) { try { localStorage.setItem(store, JSON.stringify({ base: info.version, draft })); } catch { /* this browser does not keep drafts */ } } }, [draft, info, store]);

  const current = versions[0];
  const curDraft: TemplateDraft | null = info && current ? { label: info.label, description: info.description, body: strip(current.body) } : null;
  const checked = useMemo(() => (info && draft ? validateTemplate(info.kind, draft, info.context) : null), [info, draft]);
  const changes = useMemo(() => (checked?.ok && curDraft ? describeTemplateChanges(curDraft, checked.draft) : []), [checked, curDraft]);
  const lowering = !!(current && draft && lowersCertification(current.body.certification, draft.body.certification));
  const drawing = info?.kind === 'family' ? currentDrawing(key) : null;
  const offDrawing = drawing && draft ? draft.body.points.filter((p) => !drawing.callouts.some((c) => c.code === p.code)).map((p) => p.code) : [];

  if (!info || !draft) return <div className="py-20 text-center text-slate-400">{error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="inline animate-spin" size={20} />}</div>;
  const b = draft.body;
  const setB = (patch: Partial<TemplateBody>) => setDraft({ ...draft, body: { ...b, ...patch } });
  const setPoint = (i: number, p: Partial<TemplatePoint>) => setB({ points: b.points.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setItem = (i: number, p: Partial<TemplateItem>) => setB({ items: b.items.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const isKit = !!b.composedOf;

  const publish = async () => {
    setBusy(true);
    const res = await fetch(`/api/admin/templates/${encodeURIComponent(key)}/versions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: draft.label, description: draft.description, body: draft.body, note, baseVersion: info.version, certificationReason: reason }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setToast({ text: j.error || 'Could not publish.', type: 'error' }); return; }
    try { localStorage.removeItem(store); } catch { /* nothing kept */ }
    setNote(''); setReason('');
    setToast({ text: j.warning || `Version ${j.version} published. Existing tech files keep their version.`, type: j.warning ? 'error' : 'success' });
    await load();
  };

  return (
    <div className="space-y-4 pb-24">
      <Link href="/admin/replication/templates" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-rivix"><ArrowLeft size={16} />All templates</Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900">{info.label} <span className="font-mono text-sm font-normal text-slate-400">{info.key} · version {info.version}{!info.active && ' · off'}</span></h1>
        <p className="mt-1 text-sm text-slate-500">Used by: {[...info.usage.types.map((t) => t.label), ...info.usage.categories.map((c) => `category ${c.label}`), ...info.usage.kits.map((k) => `set ${k}`)].join(', ') || 'nothing yet'}. Changes are published as version {info.version + 1}; version {info.version} stays as it is for the tech files made with it.</p>
        {info.kind === 'family' && <p className="mt-1 text-sm text-slate-500">{drawing ? `Drawing available (version ${drawing.version}).${offDrawing.length ? ` Not on the drawing yet: ${offDrawing.join(', ')}.` : ''}` : 'Drawing not available yet: tech files show "Drawing not available yet" until one is added.'}</p>}
      </div>

      <Section title="Name">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1"><span className={lbl}>Name</span><input className={field} value={draft.label} maxLength={LIMITS.name} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
          <label className="space-y-1"><span className={lbl}>Description</span><input className={field} value={draft.description} maxLength={LIMITS.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        </div>
      </Section>

      {info.kind === 'family' && !isKit && (
        <Section title={`Measurement points (${b.points.length}/${LIMITS.points})`} hint="Codes are unique (A, B, ... AA, A1). The order is the order of the measurement table and of the numbers on the drawing.">
          {b.points.map((p, i) => (
            <div key={i} className="grid grid-cols-[3.5rem_1fr_2fr_7rem_auto] items-center gap-1.5">
              <input aria-label={`Code ${i + 1}`} className={field} value={p.code} maxLength={3} onChange={(e) => setPoint(i, { code: e.target.value.toUpperCase() })} />
              <input aria-label={`Name ${i + 1}`} className={field} value={p.name} maxLength={LIMITS.label} onChange={(e) => setPoint(i, { name: e.target.value })} />
              <input aria-label={`How to measure ${i + 1}`} className={field} value={p.howToMeasure} maxLength={LIMITS.howToMeasure} onChange={(e) => setPoint(i, { howToMeasure: e.target.value })} />
              <select aria-label={`Measured ${i + 1}`} className={field} value={p.method} onChange={(e) => setPoint(i, { method: e.target.value as TemplatePoint['method'] })}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
              <span className="flex"><button type="button" aria-label="Up" onClick={() => setB({ points: move(b.points, i, -1) })} className="p-1 text-slate-400"><ArrowUp size={13} /></button><button type="button" aria-label="Down" onClick={() => setB({ points: move(b.points, i, 1) })} className="p-1 text-slate-400"><ArrowDown size={13} /></button><button type="button" aria-label="Remove" onClick={() => setB({ points: b.points.filter((_, j) => j !== i) })} className="p-1 text-slate-400 hover:text-red-600"><X size={13} /></button></span>
            </div>
          ))}
          <button type="button" onClick={() => setB({ points: [...b.points, { code: '', name: '', howToMeasure: '', method: 'flat' }] })} className="flex items-center gap-1 text-xs font-bold text-rivix"><Plus size={13} /> Add a point</button>
        </Section>
      )}

      <Section title={`Fields (${b.items.length}/${LIMITS.items})`} hint="Spec fields (materials, components) and construction items, in tech file order. Keys are unique lowercase words with dashes. Photo = often visible in a photo; document = needs a spec sheet or sample.">
        {b.items.map((it, i) => (
          <div key={i} className="grid grid-cols-[9rem_1fr_7rem_6.5rem_auto_auto] items-center gap-1.5">
            <input aria-label={`Key ${i + 1}`} className={`${field} font-mono`} value={it.key} maxLength={40} onChange={(e) => setItem(i, { key: e.target.value.toLowerCase() })} />
            <input aria-label={`Label ${i + 1}`} className={field} value={it.label} maxLength={LIMITS.label} onChange={(e) => setItem(i, { label: e.target.value })} />
            <select aria-label={`Section ${i + 1}`} className={field} value={it.section} onChange={(e) => setItem(i, { section: e.target.value as TemplateItem['section'] })}><option value="spec">Spec field</option><option value="construction">Construction</option></select>
            <select aria-label={`Source ${i + 1}`} className={field} value={it.source} onChange={(e) => setItem(i, { source: e.target.value as TemplateItem['source'] })}><option value="photo">Photo</option><option value="document">Document</option></select>
            <label className="flex items-center gap-1 text-[11px] text-slate-600"><input type="checkbox" checked={it.required} onChange={(e) => setItem(i, { required: e.target.checked })} />Required</label>
            <span className="flex"><button type="button" aria-label="Up" onClick={() => setB({ items: move(b.items, i, -1) })} className="p-1 text-slate-400"><ArrowUp size={13} /></button><button type="button" aria-label="Down" onClick={() => setB({ items: move(b.items, i, 1) })} className="p-1 text-slate-400"><ArrowDown size={13} /></button><button type="button" aria-label="Remove" onClick={() => setB({ items: b.items.filter((_, j) => j !== i) })} className="p-1 text-slate-400 hover:text-red-600"><X size={13} /></button></span>
          </div>
        ))}
        <button type="button" onClick={() => setB({ items: [...b.items, { key: '', label: '', section: 'spec', source: 'photo', required: false }] })} className="flex items-center gap-1 text-xs font-bold text-rivix"><Plus size={13} /> Add a field</button>
      </Section>

      {info.kind === 'family' && (
        <Section title="Sizing, drawing views and parts">
          <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <label className="space-y-1"><span className={lbl}>Sizing system</span><select className={field} value={b.sizing?.system ?? 'custom'} onChange={(e) => setB({ sizing: { system: e.target.value as NonNullable<TemplateBody['sizing']>['system'], note: b.sizing?.note ?? '' } })}>{SIZING_SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="space-y-1"><span className={lbl}>Sizing note</span><input className={field} value={b.sizing?.note ?? ''} maxLength={LIMITS.sizingNote} onChange={(e) => setB({ sizing: { system: b.sizing?.system ?? 'custom', note: e.target.value } })} /></label>
          </div>
          <div className="flex flex-wrap gap-3">{VIEWS.map((v) => <label key={v} className="flex items-center gap-1 text-xs text-slate-700"><input type="checkbox" checked={b.views.includes(v)} onChange={(e) => setB({ views: e.target.checked ? [...b.views, v] : b.views.filter((x) => x !== v) })} />{v}</label>)}</div>
          {isKit && <div><span className={lbl}>Parts of this set</span><div className="mt-1 flex flex-wrap gap-3">{info.context.families.map((f) => <label key={f} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={b.composedOf!.includes(f)} onChange={(e) => setB({ composedOf: e.target.checked ? [...b.composedOf!, f] : b.composedOf!.filter((x) => x !== f) })} />{f}</label>)}</div></div>}
        </Section>
      )}

      <Section title="Certification and protective information" hint="Certified equipment: the tech file describes it and never claims compliance. Lowering the level needs a reason and alerts every admin.">
        <label className="block space-y-1 sm:w-72"><span className={lbl}>Certification level</span><select className={field} value={b.certification} onChange={(e) => setB({ certification: e.target.value as TemplateBody['certification'] })}>{CERTIFICATION.map((c) => <option key={c} value={c}>{CERT_WORDS[c]}</option>)}</select></label>
        <label className="block space-y-1"><span className={lbl}>Confirmed standards to check (one per line; only after the compliance person has confirmed them)</span><textarea className={field} rows={2} value={(b.protective?.standards ?? []).join('\n')} onChange={(e) => setB({ protective: { standards: e.target.value.split('\n'), evidence: b.protective?.evidence ?? '' } })} /></label>
        <label className="block space-y-1"><span className={lbl}>Evidence needed (shown with the standards)</span><textarea className={field} rows={2} maxLength={LIMITS.evidence} value={b.protective?.evidence ?? ''} onChange={(e) => setB({ protective: { standards: b.protective?.standards ?? [], evidence: e.target.value } })} /></label>
        <div className="space-y-1"><span className={lbl}>Standards to verify (candidates, each with its source link)</span>
          {(b.standardCandidates ?? []).map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_10rem_auto] gap-1.5">
              <input aria-label={`Standard ${i + 1}`} className={field} value={c.standard} onChange={(e) => setB({ standardCandidates: b.standardCandidates!.map((x, j) => (j === i ? { ...x, standard: e.target.value } : x)) })} />
              <input aria-label={`Link ${i + 1}`} className={field} value={c.link} placeholder="https://" onChange={(e) => setB({ standardCandidates: b.standardCandidates!.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)) })} />
              <input aria-label={`Applies to ${i + 1}`} className={field} value={c.appliesTo ?? ''} placeholder="applies to (optional)" onChange={(e) => setB({ standardCandidates: b.standardCandidates!.map((x, j) => (j === i ? { ...x, appliesTo: e.target.value || undefined } : x)) })} />
              <button type="button" aria-label="Remove" onClick={() => setB({ standardCandidates: b.standardCandidates!.filter((_, j) => j !== i) })} className="p-1 text-slate-400 hover:text-red-600"><X size={13} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setB({ standardCandidates: [...(b.standardCandidates ?? []), { standard: '', link: '', status: 'to-verify' }] })} className="flex items-center gap-1 text-xs font-bold text-rivix"><Plus size={13} /> Add a standard to verify</button>
        </div>
        <label className="block space-y-1"><span className={lbl}>Notes shown with the template (one per line; scope limits, what not to claim)</span><textarea className={field} rows={2} value={(b.notes ?? []).join('\n')} onChange={(e) => setB({ notes: e.target.value.split('\n') })} /></label>
      </Section>

      <Section title="Publish">
        {checked && !checked.ok && <ul role="alert" className="list-disc space-y-0.5 rounded-lg border border-red-200 bg-red-50 py-2 pl-7 pr-3 text-xs text-red-800">{checked.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        {checked?.ok && <div className="text-xs text-slate-700"><span className="font-bold">What will change in version {info.version + 1}:</span>{changes.length ? <ul className="mt-1 list-disc pl-5">{changes.map((c) => <li key={c}>{c}</li>)}</ul> : <span className="text-slate-400"> nothing yet.</span>}</div>}
        <label className="block space-y-1"><span className={lbl}>Change note (why; recorded with the version)</span><input className={field} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /></label>
        {lowering && <label className="block space-y-1"><span className={`${lbl} text-red-700`}>Reason for lowering the certification level ({CERT_WORDS[current!.body.certification]} → {CERT_WORDS[b.certification]}). Every admin is alerted.</span><input className={field} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} /></label>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !checked?.ok || !changes.length || note.trim().length < 3 || (lowering && reason.trim().length < 10)} onClick={publish} className="rounded-xl bg-rivix px-5 py-2 text-xs font-bold text-white disabled:opacity-40">{busy ? 'Publishing…' : `Publish version ${info.version + 1}`}</button>
          <button type="button" disabled={busy} onClick={() => { try { localStorage.removeItem(store); } catch { /* nothing kept */ } setDraft(curDraft); setNote(''); setReason(''); }} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">Discard my changes</button>
        </div>
      </Section>

      <Section title="Versions" hint="Every version is kept exactly as published; tech files made with it keep it.">
        {versions.map((v) => (
          <div key={v.version} className="border-t border-slate-100 pt-2 text-xs first:border-0 first:pt-0">
            <p><span className="font-bold">Version {v.version}</span>{v.version === info.version && ' (current)'} · {v.by || 'seed'} · {new Date(v.at).toLocaleString()} <button type="button" onClick={() => setShown(shown === v.version ? null : v.version)} className="ml-2 font-bold text-rivix">{shown === v.version ? 'Hide' : 'View'}</button></p>
            {v.note && <p className="text-slate-500">{v.note}</p>}
            {shown === v.version && <p className="mt-1 text-slate-600">{v.body.points.map((p) => `${p.code} ${p.name}`).join('; ') || 'No measurement points'}. Fields: {v.body.items.map((i) => i.label).join('; ') || 'none'}. Certification: {CERT_WORDS[v.body.certification]}.</p>}
          </div>
        ))}
      </Section>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
