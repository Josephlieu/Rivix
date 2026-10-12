'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, Check, AlertCircle, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { Criterion, MAX_CRITERIA, DEFAULT_CRITERIA, DEFAULT_HIRING_FOR } from '@/lib/hiring-criteria';
import { saveHiringSettings, HiringSettings } from '@/lib/hiringStorage';
import { DEFAULT_COMPANY_CONTEXT, DEFAULT_SCORING_GUIDE, MAX_CONTEXT_CHARS, MAX_GUIDE_CHARS, backgroundBlock } from '@/lib/hiring-prompts';

const inputClass =
  'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 focus:border-rivix outline-none font-medium placeholder:text-slate-300';

// Edit what candidates are scored on: category names, what to look for, weights (must total 100%),
// and the one line that tells the resume reader who we are hiring.
export default function CriteriaEditor({
  criteria,
  hiringFor,
  companyContext,
  scoringGuide,
  onSaved,
  onClose,
}: {
  criteria: Criterion[];
  hiringFor: string;
  companyContext: string;
  scoringGuide: string;
  onSaved: (s: HiringSettings) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Criterion[]>(criteria.map((c) => ({ ...c })));
  const [who, setWho] = useState(hiringFor);
  const [context, setContext] = useState(companyContext);
  const [guide, setGuide] = useState(scoringGuide);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => Math.round(rows.reduce((n, r) => n + (Number(r.weight) || 0), 0) * 100) / 100, [rows]);
  const valid =
    rows.length > 0 && rows.every((r) => r.label.trim()) && Math.abs(total - 100) < 0.01 &&
    context.length <= MAX_CONTEXT_CHARS && guide.length <= MAX_GUIDE_CHARS;

  // Exactly the background and categories the AI will be given (plus fixed technical rules added by the system).
  const preview = useMemo(
    () => backgroundBlock(
      { companyContext: context, scoringGuide: guide },
      rows.filter((r) => r.label.trim()).map((r, n) => `${n + 1}. ${r.label.trim()}${r.description.trim() ? ': ' + r.description.trim() : ''}`).join('\n')
    ),
    [context, guide, rows]
  );

  const update = (i: number, patch: Partial<Criterion>) => setRows((prev) => prev.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const splitEvenly = () => {
    const each = Math.floor((100 / rows.length) * 100) / 100;
    setRows((prev) => prev.map((r, n) => ({ ...r, weight: n === prev.length - 1 ? Math.round((100 - each * (prev.length - 1)) * 100) / 100 : each })));
  };
  const addRow = () => setRows((prev) => [...prev, { id: `new_${Date.now()}`, label: '', description: '', weight: 0 }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, n) => n !== i));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveHiringSettings({ criteria: rows.map((r) => ({ ...r, weight: Number(r.weight) || 0 })), hiringFor: who, companyContext: context, scoringGuide: guide });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} busy={saving} maxWidth="max-w-3xl">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Scoring criteria</h3>
            <p className="text-xs text-slate-500 mt-1">
              What every candidate is scored on. The resume reader uses these same categories, so write what you
              want it to look for in the description.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Who are we hiring?</label>
          <input className={inputClass} value={who} maxLength={300} onChange={(e) => setWho(e.target.value)} placeholder={DEFAULT_HIRING_FOR} />
        </div>

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.id} className="grid grid-cols-12 gap-3 items-start bg-slate-50/60 border border-slate-100 rounded-2xl p-3">
              <div className="col-span-12 sm:col-span-4 space-y-1 min-w-0">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Category</label>
                <input className={inputClass} value={r.label} maxLength={60} onChange={(e) => update(i, { label: e.target.value })} placeholder="e.g. Existing Rolodex" />
              </div>
              <div className="col-span-8 sm:col-span-5 space-y-1 min-w-0">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">What to look for</label>
                <textarea className={`${inputClass} resize-y`} rows={3} value={r.description} maxLength={300} onChange={(e) => update(i, { description: e.target.value })} placeholder="Describe what a strong candidate shows" />
              </div>
              <div className="col-span-4 sm:col-span-3 space-y-1 min-w-0">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Weight %</label>
                <div className="flex items-center gap-1">
                  <input className={inputClass} type="number" min={0} max={100} step={0.01} value={r.weight} onChange={(e) => update(i, { weight: e.target.value === '' ? 0 : Number(e.target.value) })} />
                  <button type="button" onClick={() => removeRow(i)} disabled={rows.length <= 1} className="p-2 text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-300" aria-label={`Remove ${r.label || 'category'}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={addRow} disabled={rows.length >= MAX_CRITERIA} className="inline-flex items-center gap-1.5 text-xs font-bold text-rivix bg-rivix/10 hover:bg-rivix/20 px-3 py-2 rounded-lg disabled:opacity-40">
              <Plus size={14} /> Add category
            </button>
            <button type="button" onClick={splitEvenly} className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg">Split evenly</button>
            <button type="button" onClick={() => { setRows(DEFAULT_CRITERIA.map((c) => ({ ...c }))); setWho(DEFAULT_HIRING_FOR); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-2">Reset to sales defaults</button>
          </div>
          <span className={`text-xs font-black px-3 py-1.5 rounded-full ${Math.abs(total - 100) < 0.01 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            Total {total}% {Math.abs(total - 100) < 0.01 ? '✓' : '— must be 100%'}
          </span>
        </div>

        <div className="space-y-4 border-t border-slate-100 pt-5">
          <div>
            <h4 className="text-sm font-bold text-slate-900">What the AI knows about RIVIX</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              The AI has no memory, so this text is sent with <strong>every</strong> resume it reads and every set of
              interview questions it writes. The more specific it is, the more consistent the scores and questions.
              Do not put passwords or any candidate&apos;s personal details here.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="ce-context" className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">About RIVIX and this hire</label>
              <button type="button" onClick={() => setContext(DEFAULT_COMPANY_CONTEXT)} className="text-[11px] font-bold text-slate-400 hover:text-rivix">Reset to the draft</button>
            </div>
            <textarea id="ce-context" rows={9} className={`${inputClass} resize-y leading-relaxed`} value={context} onChange={(e) => setContext(e.target.value)} />
            <p className={`text-[11px] px-1 text-right ${context.length > MAX_CONTEXT_CHARS ? 'text-red-600 font-bold' : 'text-slate-400'}`}>{context.length} / {MAX_CONTEXT_CHARS}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="ce-guide" className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">How to score (what strong, middling and weak look like)</label>
              <button type="button" onClick={() => setGuide(DEFAULT_SCORING_GUIDE)} className="text-[11px] font-bold text-slate-400 hover:text-rivix">Reset to the draft</button>
            </div>
            <textarea id="ce-guide" rows={6} className={`${inputClass} resize-y leading-relaxed`} value={guide} onChange={(e) => setGuide(e.target.value)} />
            <p className={`text-[11px] px-1 text-right ${guide.length > MAX_GUIDE_CHARS ? 'text-red-600 font-bold' : 'text-slate-400'}`}>{guide.length} / {MAX_GUIDE_CHARS}</p>
          </div>

          <details className="rounded-2xl border border-slate-100 bg-slate-50/60">
            <summary className="cursor-pointer select-none px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-700">See what the AI is told</summary>
            <div className="px-4 pb-4 space-y-2">
              <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-600 bg-white border border-slate-100 rounded-xl p-3 max-h-72 overflow-y-auto font-mono">{`The job: ${who || '(not set)'}\n\n${preview}`}</pre>
              <p className="text-[11px] text-slate-400">Fixed rules are added automatically and cannot be edited here: the answer format, ignoring any instructions hidden inside a resume, never asking about protected characteristics (age, family, religion, ethnicity, disability and so on), and never quoting internal scores to a candidate.</p>
            </div>
          </details>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Candidates you have already scored keep their scores. A category with no score shows as
          &ldquo;Not scored&rdquo; and is left out of that candidate&rsquo;s total until you score it. New resumes uploaded
          from now on are scored on these categories.
        </p>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3" role="alert">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={save} disabled={!valid || saving} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Save criteria
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
