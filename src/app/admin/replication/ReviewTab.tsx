'use client';

import { useEffect, useState } from 'react';
import type { PersistedGarmentAIAnalysis } from '@/lib/garmentAiAnalysis';
import type { ReplicationRequest, ReplicationSpec } from '@/lib/replicationStorage';
import { suggestedTests, suggestFrenchCare, prefillSpecs } from '@/lib/techFileStandards';

type Analysis = PersistedGarmentAIAnalysis;
type Measurement = Analysis['measurements'][number];
type Seam = Analysis['construction'][number];
type Label = Analysis['labelPlacements'][number];

const emptyAnalysis = (): Analysis => ({
  analyzedAt: new Date().toISOString(), garmentClass: null, hasHood: null, productIdentification: null, overallConfidence: null,
  season: null, components: [], fabricAnalysis: null, measurements: [], bom: null, construction: [], stitchReference: [],
  labelPlacements: [], colorway: null, washCare: null,
});
const emptyFabric = { material: '', weight: '', weaveType: '', frRating: '', finish: '', shrinkage: '', confidence: 0 };
const emptyBom = { hardware: [], thread: [], labels: [], packaging: { foldDescription: '', polybagSize: '', cartonSize: '', hangtagSpec: '' } };
const emptyColor = { bodyColor: '', contrastColors: [], threadColor: '', hardwareFinish: '', reflectiveTape: '' };
const emptyCare: NonNullable<Analysis['washCare']> = { instructions: [], instructionsFr: [], specialNotes: '' };

const lines = (v: string) => v.split('\n').map(x => x.trim()).filter(Boolean);
const stable = (v: unknown) => JSON.stringify(v);

interface Props {
  rep: ReplicationRequest;
  // Saves the request; true when it worked (the page shows the reason when it did not).
  onSave: (updated: ReplicationRequest, approve: boolean) => Promise<boolean>;
}

const input = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rivix/30';
const label = 'text-[10px] font-bold uppercase tracking-widest text-slate-500';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5">
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">{title}</h3>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ name, value, onChange, wide }: { name: string; value: string; onChange: (v: string) => void; wide?: boolean }) {
  return (
    <label className={`block space-y-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className={label}>{name}</span>
      <input className={input} value={value} onChange={e => onChange(e.target.value)} maxLength={500} />
    </label>
  );
}

function ListBox({ name, hint, value, onChange }: { name: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  // Keep what is being typed (including empty lines) while editing; split into lines when saving into the draft.
  const [text, setText] = useState(value.join('\n'));
  useEffect(() => { if (stable(lines(text)) !== stable(value)) setText(value.join('\n')); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="block space-y-1">
      <span className={label}>{name}</span>
      <textarea className={input} rows={4} value={text} onChange={e => { setText(e.target.value); onChange(lines(e.target.value)); }} />
      {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
    </label>
  );
}

export default function ReviewTab({ rep, onSave }: Props) {
  const fromRep = () => ({ specs: { ...rep.specs } as ReplicationSpec, analysis: (rep.aiAnalysis ? structuredClone(rep.aiAnalysis) : emptyAnalysis()) as Analysis });
  const [draft, setDraft] = useState(fromRep);
  const [saving, setSaving] = useState<'' | 'save' | 'approve'>('');
  const [problem, setProblem] = useState('');
  // "dirty" = the person has typed something that is not saved yet. It is measured against what this form last loaded
  // or saved (the baseline), never against the newest copy from the server, so a new scan result is not mistaken for edits.
  const draftKey = (d: { specs: ReplicationSpec; analysis: Analysis }) => stable({ s: d.specs, a: { ...d.analysis, review: undefined, analyzedAt: undefined } });
  const [baseline, setBaseline] = useState(() => draftKey(draft));
  const dirty = draftKey(draft) !== baseline;
  const incomingKey = draftKey(fromRep());
  useEffect(() => {
    if (incomingKey === baseline) return; // nothing new from outside
    if (draftKey(draft) === incomingKey) { setBaseline(incomingKey); return; } // our own save came back
    if (!dirty) { setDraft(fromRep()); setBaseline(incomingKey); setProblem(''); } // new data from outside (a scan): load it
    // otherwise keep the unsaved edits
  }, [incomingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const a = draft.analysis;
  const setA = (patch: Partial<Analysis>) => setDraft(d => ({ ...d, analysis: { ...d.analysis, ...patch } }));
  const setSpec = (k: keyof ReplicationSpec, v: string) => setDraft(d => ({ ...d, specs: { ...d.specs, [k]: v } }));
  const fabric = a.fabricAnalysis || emptyFabric;
  const bom = a.bom || emptyBom;
  const color = a.colorway || emptyColor;
  const care = a.washCare || emptyCare;
  const artwork = a.artwork || [];
  const testing = a.testing || [];
  const [frNote, setFrNote] = useState('');
  const [specNote, setSpecNote] = useState('');
  const review = rep.aiAnalysis?.review;
  const approved = review?.status === 'approved';

  const rowInput = (v: string | number, on: (s: string) => void, cls = '') => (
    <input className={`${input} ${cls}`} value={String(v ?? '')} onChange={e => on(e.target.value)} maxLength={300} />
  );
  const updateRow = <K extends 'measurements' | 'construction' | 'labelPlacements'>(key: K, i: number, patch: Partial<Analysis[K][number]>) =>
    setA({ [key]: a[key].map((r, j) => (j === i ? { ...r, ...patch } : r)) } as Partial<Analysis>);
  const removeRow = (key: 'measurements' | 'construction' | 'labelPlacements', i: number) =>
    setA({ [key]: a[key].filter((_, j) => j !== i) } as Partial<Analysis>);

  const problems = (): string => {
    if (a.measurements.length === 0) return 'Add at least one measurement before approving.';
    if (a.measurements.some(m => !m.pom.trim() || !m.description.trim())) return 'Every measurement needs a point code and a description.';
    return '';
  };

  const run = async (approve: boolean) => {
    const p = approve ? problems() : '';
    setProblem(p);
    if (p) return;
    setSaving(approve ? 'approve' : 'save');
    const ok = await onSave({ ...rep, specs: draft.specs, aiAnalysis: { ...draft.analysis, review: undefined } }, approve);
    setSaving('');
    void ok; // the saved copy comes back through the sync effect above
  };

  const addMeasurement = () => setA({ measurements: [...a.measurements, { pom: '', description: '', xs: '', s: '', m: '', l: '', xl: '', tolerance: '' }] });
  const addSeam = () => setA({ construction: [...a.construction, { location: '', seamType: '', stitchType: '', spiTop: 0, spiBottom: 0, seamAllowance: '', notes: '' }] });
  const addLabel = () => setA({ labelPlacements: [...a.labelPlacements, { type: '', location: '', attachment: '', dimensions: '', material: '' }] });

  const specFields: Array<[keyof ReplicationSpec, string]> = [
    ['safetyRating', 'Safety rating'], ['coreMaterial', 'Base material'], ['liningMaterial', 'Lining'], ['fabricWeight', 'Fabric weight'],
    ['zippers', 'Zippers'], ['buttonsSnaps', 'Buttons / snaps'], ['reflectiveStriping', 'Reflective striping'], ['pocketsCount', 'Pockets'],
    ['seamConstruction', 'Seam construction'],
  ];

  return (
    <div className="space-y-5">
      {/* status bar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 ${approved ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div>
          <p className={`text-xs font-black uppercase tracking-widest ${approved ? 'text-emerald-700' : 'text-amber-700'}`}>{approved ? 'Approved' : 'Draft: not approved yet'}</p>
          <p className="text-[11px] text-slate-600">
            {approved
              ? `Checked by ${review?.approvedBy || 'an admin'}${review?.approvedAt ? ` on ${new Date(review.approvedAt).toLocaleDateString()}` : ''}. Changing anything below makes it a draft again.`
              : 'The AI’s numbers are guesses from photos. Check every value against the real garment, correct it, then approve. A request can only move past “Received” once approved.'}
          </p>
        </div>
        {dirty && <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-rivix">Unsaved changes</span>}
      </div>

      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900"><span className="font-bold">The AI can make mistakes.</span> Check every value carefully, especially the safety standard (use the one the customer asked for), fabric and weight, and measurements.</p>

      {!rep.aiAnalysis && (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">The AI analysis has not been run for this request. Run it on the “AI Garment Analysis” tab to get a first draft, or fill in the values below by hand.</p>
      )}

      <Section title="Basic specification" hint="What the customer’s garment is made of. Shown on the Client Spec Review tab.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {specFields.map(([k, name]) => <Field key={k} name={name} value={String(draft.specs[k] ?? '')} onChange={v => setSpec(k, v)} />)}
          <Field wide name="Special instructions" value={draft.specs.specialInstructions || ''} onChange={v => setSpec('specialInstructions', v)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => {
            const { specs, filled } = prefillSpecs(draft.specs, draft.analysis);
            setDraft(d => ({ ...d, specs }));
            setSpecNote(filled ? `Filled ${filled} empty field${filled > 1 ? 's' : ''} from the AI analysis. Check them against the garment.` : rep.aiAnalysis ? 'Nothing to fill: every field the AI can answer already has a value (or the AI found nothing for the empty ones).' : 'Run the AI analysis first, or fill these in by hand.');
          }} className="text-xs font-bold text-rivix hover:underline">Fill empty fields from the AI analysis</button>
          {specNote && <span className="text-[11px] text-slate-500">{specNote}</span>}
        </div>
      </Section>

      <Section title="Fabric">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field name="Material" value={fabric.material} onChange={v => setA({ fabricAnalysis: { ...fabric, material: v } })} />
          <Field name="Weight" value={fabric.weight} onChange={v => setA({ fabricAnalysis: { ...fabric, weight: v } })} />
          <Field name="Weave" value={fabric.weaveType} onChange={v => setA({ fabricAnalysis: { ...fabric, weaveType: v } })} />
          <Field name="Flame-resistance rating" value={fabric.frRating} onChange={v => setA({ fabricAnalysis: { ...fabric, frRating: v } })} />
          <Field name="Finish" value={fabric.finish || ''} onChange={v => setA({ fabricAnalysis: { ...fabric, finish: v } })} />
          <Field name="Shrinkage" value={fabric.shrinkage || ''} onChange={v => setA({ fabricAnalysis: { ...fabric, shrinkage: v } })} />
        </div>
      </Section>

      <Section title="Colours" hint="Pantone references are best (for example PANTONE 19-4052 TCX).">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field name="Body colour" value={color.bodyColor} onChange={v => setA({ colorway: { ...color, bodyColor: v } })} />
          <Field name="Thread colour" value={color.threadColor} onChange={v => setA({ colorway: { ...color, threadColor: v } })} />
          <Field name="Hardware finish" value={color.hardwareFinish} onChange={v => setA({ colorway: { ...color, hardwareFinish: v } })} />
          <Field name="Reflective tape" value={color.reflectiveTape} onChange={v => setA({ colorway: { ...color, reflectiveTape: v } })} />
          <Field wide name="Contrast colours (separate with commas)" value={color.contrastColors.join(', ')} onChange={v => setA({ colorway: { ...color, contrastColors: v.split(',').map(x => x.trim()).filter(Boolean) } })} />
        </div>
      </Section>

      <Section title="Measurements (inches, flat on the half)" hint="The AI cannot take real measurements from a photo: measure the physical garment and correct these.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400">
                <th className="w-16 pb-2">Point</th><th className="pb-2">Description</th>
                {['XS', 'S', 'M', 'L', 'XL'].map(s => <th key={s} className="w-16 pb-2 text-center">{s}</th>)}
                <th className="w-20 pb-2 text-center">Tol. ±</th><th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {a.measurements.map((m: Measurement, i) => (
                <tr key={i}>
                  <td className="pr-1 pb-1.5">{rowInput(m.pom, v => updateRow('measurements', i, { pom: v }))}</td>
                  <td className="pr-1 pb-1.5">{rowInput(m.description, v => updateRow('measurements', i, { description: v }))}</td>
                  {(['xs', 's', 'm', 'l', 'xl'] as const).map(k => <td key={k} className="pr-1 pb-1.5">{rowInput(m[k], v => updateRow('measurements', i, { [k]: v }), 'text-center')}</td>)}
                  <td className="pr-1 pb-1.5">{rowInput(m.tolerance, v => updateRow('measurements', i, { tolerance: v }), 'text-center')}</td>
                  <td className="pb-1.5"><button type="button" onClick={() => removeRow('measurements', i)} aria-label="Remove row" className="text-slate-400 hover:text-red-600">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addMeasurement} className="text-xs font-bold text-rivix hover:underline">+ Add measurement</button>
      </Section>

      <Section title="Bill of materials" hint="One item per line.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ListBox name="Hardware" value={bom.hardware} onChange={v => setA({ bom: { ...bom, hardware: v } })} />
          <ListBox name="Thread" value={bom.thread} onChange={v => setA({ bom: { ...bom, thread: v } })} />
          <ListBox name="Labels" value={bom.labels} onChange={v => setA({ bom: { ...bom, labels: v } })} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field name="Fold" value={bom.packaging.foldDescription} onChange={v => setA({ bom: { ...bom, packaging: { ...bom.packaging, foldDescription: v } } })} />
          <Field name="Polybag size" value={bom.packaging.polybagSize} onChange={v => setA({ bom: { ...bom, packaging: { ...bom.packaging, polybagSize: v } } })} />
          <Field name="Carton size" value={bom.packaging.cartonSize} onChange={v => setA({ bom: { ...bom, packaging: { ...bom.packaging, cartonSize: v } } })} />
          <Field name="Hangtag" value={bom.packaging.hangtagSpec || ''} onChange={v => setA({ bom: { ...bom, packaging: { ...bom.packaging, hangtagSpec: v } } })} />
        </div>
      </Section>

      <Section title="Seams and construction">
        <div className="space-y-3">
          {a.construction.map((c: Seam, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-6">
              <Field name="Location" value={c.location} onChange={v => updateRow('construction', i, { location: v })} />
              <Field name="Seam type" value={c.seamType} onChange={v => updateRow('construction', i, { seamType: v })} />
              <Field name="Stitch" value={c.stitchType} onChange={v => updateRow('construction', i, { stitchType: v })} />
              <Field name="Stitches per inch" value={String(c.spiTop ?? '')} onChange={v => updateRow('construction', i, { spiTop: Number(v) || 0, spiBottom: Number(v) || 0 })} />
              <Field name="Seam allowance" value={c.seamAllowance} onChange={v => updateRow('construction', i, { seamAllowance: v })} />
              <div className="flex items-end justify-end"><button type="button" onClick={() => removeRow('construction', i)} className="text-xs font-bold text-slate-400 hover:text-red-600">Remove</button></div>
              <Field wide name="Notes" value={c.notes} onChange={v => updateRow('construction', i, { notes: v })} />
            </div>
          ))}
        </div>
        <button type="button" onClick={addSeam} className="text-xs font-bold text-rivix hover:underline">+ Add seam</button>
      </Section>

      <Section title="Labels" hint="Care and brand labels: type, where, how attached, size, material.">
        <div className="space-y-3">
          {a.labelPlacements.map((l: Label, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-6">
              <Field name="Type" value={l.type} onChange={v => updateRow('labelPlacements', i, { type: v })} />
              <Field name="Location" value={l.location} onChange={v => updateRow('labelPlacements', i, { location: v })} />
              <Field name="Attachment" value={l.attachment} onChange={v => updateRow('labelPlacements', i, { attachment: v })} />
              <Field name="Size" value={l.dimensions} onChange={v => updateRow('labelPlacements', i, { dimensions: v })} />
              <Field name="Material" value={l.material} onChange={v => updateRow('labelPlacements', i, { material: v })} />
              <div className="flex items-end justify-end"><button type="button" onClick={() => removeRow('labelPlacements', i)} className="text-xs font-bold text-slate-400 hover:text-red-600">Remove</button></div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addLabel} className="text-xs font-bold text-rivix hover:underline">+ Add label</button>
      </Section>

      <Section title="Wash and care" hint="English and French (Canadian labels need both).">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ListBox name="Care instructions (English)" hint="One per line." value={care.instructions} onChange={v => setA({ washCare: { ...care, instructions: v } })} />
          <ListBox name="Instructions de lavage (français)" hint="One per line, same order as the English." value={care.instructionsFr || []} onChange={v => setA({ washCare: { ...care, instructionsFr: v } })} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => {
            const { fr, missing } = suggestFrenchCare(care.instructions);
            setA({ washCare: { ...care, instructionsFr: fr } });
            setFrNote(missing ? `${missing} line${missing > 1 ? 's' : ''} had no standard translation: write ${missing > 1 ? 'them' : 'it'} by hand (blank line${missing > 1 ? 's' : ''} left).` : 'All lines translated from the standard care phrases. Check them before approving.');
          }} className="text-xs font-bold text-rivix hover:underline">Fill French from standard care phrases</button>
          {frNote && <span className="text-[11px] text-slate-500">{frNote}</span>}
        </div>
        <label className="block space-y-1">
          <span className={label}>Special notes</span>
          <textarea className={input} rows={2} value={care.specialNotes} onChange={e => setA({ washCare: { ...care, specialNotes: e.target.value } })} />
        </label>
        <Field name="Country of origin (printed on the label, for example Canada)" value={a.origin || ''} onChange={v => setA({ origin: v })} wide />
      </Section>

      <Section title="Artwork" hint="Logos and prints: what, where, how big, how applied.">
        <div className="space-y-3">
          {artwork.map((x, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-5">
              <Field name="Artwork" value={x.name} onChange={v => setA({ artwork: artwork.map((r, j) => (j === i ? { ...r, name: v } : r)) })} />
              <Field name="Placement" value={x.placement} onChange={v => setA({ artwork: artwork.map((r, j) => (j === i ? { ...r, placement: v } : r)) })} />
              <Field name="Size" value={x.size} onChange={v => setA({ artwork: artwork.map((r, j) => (j === i ? { ...r, size: v } : r)) })} />
              <Field name="Method" value={x.method} onChange={v => setA({ artwork: artwork.map((r, j) => (j === i ? { ...r, method: v } : r)) })} />
              <div className="flex items-end justify-end"><button type="button" onClick={() => setA({ artwork: artwork.filter((_, j) => j !== i) })} className="text-xs font-bold text-slate-400 hover:text-red-600">Remove</button></div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setA({ artwork: [...artwork, { name: '', placement: '', size: '', method: '' }] })} className="text-xs font-bold text-rivix hover:underline">+ Add artwork</button>
      </Section>

      <Section title="Testing" hint="Tests the factory's fabric and garments must pass. One per line.">
        <ListBox name="Tests" value={testing} onChange={v => setA({ testing: v })} />
        <button type="button" onClick={() => {
          const merged = [...testing, ...suggestedTests(a, draft.specs.safetyRating).filter(t => !testing.includes(t))];
          setA({ testing: merged });
        }} className="text-xs font-bold text-rivix hover:underline">Add the standard tests for this garment</button>
        <p className="text-[10px] text-slate-400">The standard list is a starting point (it adds hi-vis and flame-resistance tests when the garment looks like it needs them). Confirm it with the testing lab: the tech file says so.</p>
      </Section>

      {problem && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{problem}</p>}

      <div className="sticky bottom-3 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <span className="mr-auto text-[11px] text-slate-500">Stitch types and detected components are not editable here yet.</span>
        <button type="button" onClick={() => run(false)} disabled={!!saving || !dirty} className="rounded-xl border border-slate-200 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
          {saving === 'save' ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={() => run(true)} disabled={!!saving || (approved && !dirty)} className="rounded-xl bg-rivix px-5 py-2 text-xs font-bold text-white shadow-lg shadow-rivix/30 hover:bg-rivix-dark disabled:opacity-40">
          {saving === 'approve' ? 'Approving…' : approved && dirty ? 'Save and re-approve' : approved ? 'Approved ✓' : 'Approve specification'}
        </button>
      </div>
    </div>
  );
}
