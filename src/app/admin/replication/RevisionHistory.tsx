'use client';

import { useCallback, useEffect, useState } from 'react';
import { approvalFileLink, attachCustomerApproval, compareRevisions, getRevisions, makeRevisionPdf, revisionPdfLink, type RevisionEntry } from '@/lib/replicationStorage';
import { revisionLabel } from '@/lib/revisions';

// Task 30: the tech file's history (admin only). Every save that changed the tech file is a revision: who, when, what changed,
// the template and drawing versions it used. Approved revisions are locked and keep their PDF (with its SHA-256 fingerprint);
// the customer's approval is attached to one of them as a document. Customers never see any of this.
const short = (h: string) => `${h.slice(0, 12)}…`;
const when = (iso: string) => new Date(iso).toLocaleString();

export default function RevisionHistory({ repId, refreshKey }: { repId: string; refreshKey: string }) {
  const [list, setList] = useState<RevisionEntry[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [from, setFrom] = useState<number | ''>('');
  const [to, setTo] = useState<number | ''>('');
  const [diff, setDiff] = useState<string[] | null>(null);
  const [attachFor, setAttachFor] = useState<number | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try { const r = await getRevisions(repId); setList(r.revisions); setMissing(!!r.missing); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load the history.'); }
  }, [repId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const openLink = async (get: () => Promise<string>) => { try { window.location.href = await get(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not get the file.'); } };
  const compare = async () => {
    if (from === '' || to === '') return;
    setBusy('compare');
    try { setDiff(await compareRevisions(repId, Number(from), Number(to))); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not compare.'); }
    setBusy('');
  };
  const makePdf = async (seq: number) => {
    setBusy(`pdf${seq}`);
    try { await makeRevisionPdf(repId, seq); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not make the PDF.'); }
    setBusy('');
  };
  const attach = async (seq: number, form: HTMLFormElement) => {
    setBusy(`attach${seq}`);
    try { await attachCustomerApproval(repId, seq, new FormData(form)); setAttachFor(null); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not attach the approval.'); }
    setBusy('');
  };

  if (missing) return <p className="text-xs text-slate-500">Revision history is not set up yet (run task-30-revisions.sql).</p>;
  if (!list) return <p className="text-xs text-slate-400">Loading the history…</p>;
  const field = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rivix/30';
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] text-red-800">{error}</p>}
      {list.length === 0 && <p className="text-xs text-slate-500">No revisions yet. The first save of the tech file starts the history.</p>}
      {list.length > 1 && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs">
          <label className="space-y-1"><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Compare</span>
            <select className={field} value={from} onChange={e => setFrom(e.target.value ? Number(e.target.value) : '')}><option value="">Older…</option>{list.map(r => <option key={r.seq} value={r.seq}>#{r.seq} {revisionLabel(r)}</option>)}</select></label>
          <label className="space-y-1"><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">with</span>
            <select className={field} value={to} onChange={e => setTo(e.target.value ? Number(e.target.value) : '')}><option value="">Newer…</option>{list.map(r => <option key={r.seq} value={r.seq}>#{r.seq} {revisionLabel(r)}</option>)}</select></label>
          <button type="button" onClick={compare} disabled={from === '' || to === '' || busy === 'compare'} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Compare</button>
          {diff && <ul className="mt-1 w-full list-disc space-y-0.5 pl-5 text-slate-700">{diff.map((d, i) => <li key={i}>{d}</li>)}</ul>}
        </div>
      )}
      {list.map(r => {
        const all = open[r.seq];
        const changes = all ? r.changes : r.changes.slice(0, 4);
        return (
          <div key={r.id} className={`rounded-xl border p-3 text-xs ${r.status === 'approved' ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100 bg-white'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-800">#{r.seq} · {revisionLabel(r)} {r.status === 'approved' && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">Locked</span>}</p>
              <p className="text-slate-500">{r.by || 'unknown'} · {when(r.at)}</p>
            </div>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-slate-700">{changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
            {r.changes.length > 4 && <button type="button" onClick={() => setOpen(o => ({ ...o, [r.seq]: !all }))} className="mt-1 text-[11px] font-bold text-rivix hover:underline">{all ? 'Show less' : `Show all ${r.changes.length} changes`}</button>}
            <p className="mt-1.5 text-[11px] text-slate-500">
              Templates: {r.templateVersions.map(v => `${v.key} v${v.version}`).join(', ') || 'not recorded'}.{' '}
              Drawing: {r.drawing ? (r.drawing.parts ? r.drawing.parts.map(p => `${p.key} ${p.version ? `v${p.version}` : '(none)'}`).join(', ') : `${r.drawing.key} ${r.drawing.version ? `v${r.drawing.version}` : '(none)'}`) : 'not recorded'}.
            </p>
            {r.status === 'approved' && (
              <div className="mt-2 space-y-2 border-t border-emerald-100 pt-2">
                {r.pdf
                  ? <p className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => openLink(() => revisionPdfLink(repId, r.seq))} className="font-bold text-rivix hover:underline">Download the approved PDF</button><span className="font-mono text-[10px] text-slate-500" title={r.pdf.sha256}>SHA-256 {short(r.pdf.sha256)}</span></p>
                  : <p className="flex flex-wrap items-center gap-2 text-amber-800">No stored PDF for this revision. <button type="button" disabled={busy === `pdf${r.seq}`} onClick={() => makePdf(r.seq)} className="font-bold text-rivix hover:underline disabled:opacity-50">{busy === `pdf${r.seq}` ? 'Making…' : 'Make PDF'}</button></p>}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Customer approval</p>
                  {r.approvals.length === 0 && <p className="text-slate-500">None attached yet.</p>}
                  {r.approvals.map(a => (
                    <p key={a.id} className="text-slate-700">
                      Approved by <span className="font-bold">{a.approvedBy}</span> on {a.approvedOn}.{' '}
                      <button type="button" onClick={() => openLink(() => approvalFileLink(repId, a.id))} className="font-bold text-rivix hover:underline">{a.fileName}</button>{' '}
                      <span className="font-mono text-[10px] text-slate-500" title={a.sha256}>SHA-256 {short(a.sha256)}</span>{' '}
                      <span className="text-slate-400">(attached by {a.uploadedBy}, {when(a.at)})</span>
                      {a.note && <span className="block text-slate-500">Note: {a.note}</span>}
                    </p>
                  ))}
                  {attachFor === r.seq ? (
                    <form className="mt-2 grid gap-2 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); attach(r.seq, e.currentTarget); }}>
                      <label className="space-y-1 sm:col-span-2"><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">File (signed PDF, JPEG or PNG image, or saved email .eml / .msg; 10 MB at most)</span>
                        <input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.eml,.msg,application/pdf,image/jpeg,image/png,message/rfc822" className="block text-xs" /></label>
                      <label className="space-y-1"><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Approved by (at the customer)</span><input name="approvedBy" required maxLength={200} className={field} /></label>
                      <label className="space-y-1"><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Approved on</span><input name="approvedOn" type="date" required className={field} /></label>
                      <label className="space-y-1 sm:col-span-2"><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Note (optional)</span><input name="note" maxLength={2000} className={field} /></label>
                      <p className="text-[11px] text-slate-500 sm:col-span-2">An attached approval is kept for good and cannot be changed or removed. To correct one, attach another with a note.</p>
                      <div className="flex gap-2 sm:col-span-2">
                        <button type="submit" disabled={busy === `attach${r.seq}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busy === `attach${r.seq}` ? 'Attaching…' : 'Attach approval'}</button>
                        <button type="button" onClick={() => setAttachFor(null)} className="text-xs font-bold text-slate-500">Cancel</button>
                      </div>
                    </form>
                  ) : <button type="button" onClick={() => setAttachFor(r.seq)} className="mt-1 text-[11px] font-bold text-rivix hover:underline">+ Attach the customer&apos;s approval</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
