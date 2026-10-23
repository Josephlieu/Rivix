'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import type { ReplicationRequest } from '@/lib/replicationStorage';
import { formatDate } from '@/lib/format';

const CARRIERS = ['DHL Express', 'Canada Post', 'Purolator', 'UPS', 'FedEx', 'Other'];

interface Props {
  rep: ReplicationRequest;
  trackingUrl: (carrier?: string, number?: string) => string;
  // Saves the request; true when it worked (the page shows the reason when it did not).
  onSave: (updated: ReplicationRequest) => Promise<boolean>;
}

const input = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rivix/30';
const label = 'mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400';

// The parcel the customer posts to RIVIX with the real garment. Admins log it (the customer page is off).
export default function InboundParcelCard({ rep, trackingUrl, onSave }: Props) {
  const logged = !!rep.clientTrackingNumber;
  const receivedAt = rep.specs.inboundReceivedAt;
  const [editing, setEditing] = useState(false);
  const [carrier, setCarrier] = useState(rep.clientTrackingCarrier || 'Canada Post');
  const [number, setNumber] = useState(rep.clientTrackingNumber || '');
  const [busy, setBusy] = useState(false);

  const save = async (patch: Partial<ReplicationRequest>, specsPatch?: Partial<ReplicationRequest['specs']>) => {
    setBusy(true);
    const ok = await onSave({ ...rep, ...patch, specs: { ...rep.specs, ...specsPatch } });
    setBusy(false);
    return ok;
  };

  const saveParcel = async () => {
    if (!number.trim()) return;
    // A different tracking number is a different parcel, so it is no longer "received".
    const changed = number.trim() !== rep.clientTrackingNumber;
    if (await save({ clientTrackingCarrier: carrier, clientTrackingNumber: number.trim() }, changed ? { inboundReceivedAt: undefined } : undefined)) setEditing(false);
  };
  const remove = async () => {
    if (!window.confirm('Remove the inbound parcel details?')) return;
    if (await save({ clientTrackingCarrier: undefined, clientTrackingNumber: undefined }, { inboundReceivedAt: undefined })) { setNumber(''); setEditing(false); }
  };

  const form = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label} htmlFor="in-carrier">Carrier</label>
          <select id="in-carrier" className={input} value={carrier} onChange={e => setCarrier(e.target.value)}>
            {CARRIERS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="in-number">Tracking code</label>
          <input id="in-number" className={input} value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. 1234567890" maxLength={120} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={saveParcel} disabled={busy || !number.trim()} className="flex-1 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-40">
          {busy ? 'Saving…' : logged ? 'Save changes' : 'Save parcel'}
        </button>
        {logged && <button onClick={() => { setEditing(false); setCarrier(rep.clientTrackingCarrier || 'Canada Post'); setNumber(rep.clientTrackingNumber || ''); }} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>}
      </div>
    </div>
  );

  if (!logged) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-widest text-amber-800">No inbound parcel logged</h4>
            <p className="text-[13px] leading-relaxed text-amber-700">If the customer is posting the real garment to RIVIX, log the carrier and tracking code here. If you only have photos, you can ignore this.</p>
          </div>
        </div>
        {form}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Carrier</span>
          <span className="font-black text-slate-700">{rep.clientTrackingCarrier}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Tracking code</span>
          <span className="font-mono font-bold text-slate-700">{rep.clientTrackingNumber}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Status</span>
          {receivedAt
            ? <span className="flex items-center gap-1 font-black text-emerald-700"><CheckCircle size={12} /> Received {formatDate(receivedAt)}</span>
            : <span className="font-black text-amber-700">On its way</span>}
        </div>
        <a href={trackingUrl(rep.clientTrackingCarrier, rep.clientTrackingNumber)} target="_blank" rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-center text-xs font-bold text-white transition-all hover:bg-slate-800">
          Track the parcel <ExternalLink size={12} />
        </a>
      </div>
      {editing ? form : (
        <div className="flex flex-wrap gap-2">
          {receivedAt
            ? <button onClick={() => save({}, { inboundReceivedAt: undefined })} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Undo “received”</button>
            : <button onClick={() => save({}, { inboundReceivedAt: new Date().toISOString() })} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40">Mark as received</button>}
          <button onClick={() => setEditing(true)} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Edit</button>
          <button onClick={remove} disabled={busy} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-red-600">Remove</button>
        </div>
      )}
    </div>
  );
}
