'use client';

import { useState } from 'react';
import { Loader2, Check, AlertCircle, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { Candidate, saveCandidate } from '@/lib/hiringStorage';

const inputClass =
  'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 focus:border-rivix outline-none font-medium placeholder:text-slate-300';
const labelClass = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

// Edit a candidate's details by hand (the resume reader fills these in, but it can get things wrong or
// miss them). Scores, notes, status and the resume PDF are not touched here.
export default function CandidateEditor({
  candidate,
  onSaved,
  onClose,
}: {
  candidate: Candidate;
  onSaved: (c: Candidate) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: candidate.name,
    role: candidate.role,
    experience: candidate.experience,
    currentCompany: candidate.currentCompany,
    email: candidate.email,
    phone: candidate.phone,
    location: candidate.location || '',
    competitor: candidate.competitor,
    background: candidate.background,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { setError('A candidate needs a name.'); return; }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError('That email address does not look right.'); return; }

    setSaving(true);
    setError(null);
    try {
      const saved = await saveCandidate({
        ...candidate,
        ...form,
        name,
        avatar: name.substring(0, 2).toUpperCase(), // initials follow the name
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Nothing was changed.');
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} busy={saving} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Edit candidate details</h3>
            <p className="text-xs text-slate-500 mt-1">Scores, notes, stage and the resume file are not changed here.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="cd-name">Full name *</label>
            <input id="cd-name" required className={inputClass} maxLength={200} value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="cd-role">Most recent job title</label>
            <input id="cd-role" className={inputClass} maxLength={200} value={form.role} onChange={(e) => set({ role: e.target.value })} placeholder="Senior Account Executive" />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="cd-company">Current / last company</label>
            <input id="cd-company" className={inputClass} maxLength={200} value={form.currentCompany} onChange={(e) => set({ currentCompany: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="cd-exp">Experience</label>
            <input id="cd-exp" className={inputClass} maxLength={100} value={form.experience} onChange={(e) => set({ experience: e.target.value })} placeholder="12 years" />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="cd-email">Email</label>
            <input id="cd-email" type="email" className={inputClass} maxLength={200} value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="cd-phone">Phone</label>
            <input id="cd-phone" className={inputClass} maxLength={60} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className={labelClass} htmlFor="cd-loc">Location</label>
            <input id="cd-loc" className={inputClass} maxLength={200} value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder="City, Province (e.g. Edmonton, Alberta)" />
          </div>
          <label className="sm:col-span-2 flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 cursor-pointer">
            <input type="checkbox" checked={form.competitor} onChange={(e) => set({ competitor: e.target.checked })} className="h-4 w-4 accent-[#c61213]" />
            <span className="text-sm text-slate-600"><strong className="text-slate-900">Works at (or came from) a competitor</strong> such as UniFirst, Cintas or Aramark</span>
          </label>
          <div className="space-y-1.5 sm:col-span-2">
            <label className={labelClass} htmlFor="cd-bg">Professional background</label>
            <textarea id="cd-bg" rows={7} className={`${inputClass} resize-y`} maxLength={8000} value={form.background} onChange={(e) => set({ background: e.target.value })} />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3" role="alert">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button disabled={saving} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Save details
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50">Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
