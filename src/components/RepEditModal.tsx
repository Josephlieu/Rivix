'use client';

import { useState } from 'react';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import Modal from '@/components/Modal';

// What the dialog needs to know about a rep. The Team list and the Rep Detail page both pass a rep in this shape.
export interface EditableRep {
  id: string;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  territory?: string | null;
  active: boolean;
  has_login: boolean;
  customer_count?: number; // shown in the warning when turning a rep off
}

interface Props {
  rep: EditableRep;
  onClose: () => void;
  onSaved: (rep: EditableRep) => void; // called after a successful save, with the rep as the server stored it
}

const inputClass = 'w-full bg-slate-50 border border-transparent rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-rivix/30 focus:outline-none focus:ring-2 focus:ring-rivix/10';
const labelClass = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

// The "Edit rep" dialog, shared by the Team list and the Rep Detail page so the two always match.
export default function RepEditModal({ rep, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: rep.name, title: rep.title || '', email: rep.email, phone: rep.phone || '', territory: rep.territory || '', active: rep.active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reps/${rep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      onSaved({ ...rep, ...data.rep });
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} busy={saving}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Edit rep</h3>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg" aria-label="Close"><X size={18} /></button>
        </div>
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="rep-name">Full name *</label>
            <input id="rep-name" required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="rep-title">Title</label>
            <input id="rep-title" className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Account Manager" />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="rep-email">Email *</label>
            <input id="rep-email" required type="email" disabled={rep.has_login} className={`${inputClass} ${rep.has_login ? 'opacity-60' : ''}`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {rep.has_login && <p className="text-xs text-slate-400 px-1">This is their login, so it can&apos;t be changed.</p>}
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="rep-phone">Phone</label>
            <input id="rep-phone" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(403) 555-0100" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className={labelClass} htmlFor="rep-territory">Province / territory</label>
            <input id="rep-territory" className={inputClass} value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} placeholder="Alberta — Calgary/Cochrane" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className={labelClass} htmlFor="rep-status">Status</label>
            <select id="rep-status" className={inputClass} value={form.active ? 'active' : 'disabled'} onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}>
              <option value="active">Active — can be assigned to customers</option>
              <option value="disabled">Disabled — can&apos;t be assigned, and can&apos;t sign in</option>
            </select>
            {!form.active && (rep.customer_count ?? 0) > 0 && (
              <p className="text-xs text-amber-600 px-1">This rep still has {rep.customer_count} customer(s). They&apos;ll keep showing this rep until you reassign them.</p>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button disabled={saving} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Save changes
          </button>
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50">Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
