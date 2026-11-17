'use client';

// The Client Spec Review tab's right column (moved as is out of ReplicationDetail.tsx, 2026-11-18, so it can be drawn in a
// test): the "Physical Spec Review" note and the specs panel. Gloves, footwear and PPE show their own template's fields
// (template-display.ts); clothing shows the apparel fields as before.
import { Cpu } from 'lucide-react';
import type { ReplicationRequest } from '@/lib/replicationStorage';
import type { ResolvedTemplate } from '@/lib/template-catalog';
import { normalizeAnalysis } from '@/lib/analysis-shape';
import { isProduct, physicalReviewNote, showSpecField, templateFieldRows } from '@/lib/template-display';

type Hotspot = { id: string; title: string; description: string };
export interface SpecReviewPanelProps {
  selectedRep: ReplicationRequest;
  isAdmin: boolean;
  template: ResolvedTemplate | null;
  activeHotspot: Hotspot | null;
  setActiveHotspot: (h: Hotspot | null) => void;
  setActiveTab: (t: 'specs' | 'ai_analysis' | 'review' | 'tracking' | 'chat') => void;
}

export default function SpecReviewPanel({ selectedRep, isAdmin, template, activeHotspot, setActiveHotspot, setActiveTab }: SpecReviewPanelProps) {
  const sp = selectedRep.specs;
  const apparel: Array<{ key: string; label: string; value?: string }> = [
    { key: 'coreMaterial', label: 'Base Material', value: sp.coreMaterial },
    { key: 'liningMaterial', label: 'Lining', value: sp.liningMaterial },
    { key: 'fabricWeight', label: 'Fabric Weight', value: sp.fabricWeight },
    { key: 'zippers', label: 'Zippers', value: sp.zippers },
    { key: 'buttonsSnaps', label: 'Buttons / Snaps', value: sp.buttonsSnaps },
    { key: 'reflectiveStriping', label: 'Reflective Striping', value: sp.reflectiveStriping },
    { key: 'pocketsCount', label: 'Pockets', value: sp.pocketsCount },
    { key: 'seamConstruction', label: 'Seam Construction', value: sp.seamConstruction },
  ];
  // Clothing: the apparel fields, as before. Gloves, footwear and PPE: the template's own fields with the saved values and
  // their state, then any apparel field that already holds a value (never hidden).
  const product = template && isProduct(template);
  const rows: Array<{ label: string; value?: string; state?: string | null }> = product
    ? [
      { label: 'Safety Compliance', value: sp.safetyRating },
      ...templateFieldRows(template, normalizeAnalysis(selectedRep.aiAnalysis)),
      ...apparel.filter(r => showSpecField(template, r.key, r.value)),
      { label: 'Special Instructions', value: sp.specialInstructions },
    ]
    : [{ label: 'Safety Compliance', value: sp.safetyRating }, ...apparel, { label: 'Special Instructions', value: sp.specialInstructions }];
  return (
    <div className="lg:col-span-5 space-y-6">

      {activeHotspot ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 relative text-white">
          <button 
            onClick={() => setActiveHotspot(null)}
            className="absolute top-3 right-3 text-slate-400 hover:text-white font-bold text-xs"
          >
            ✕
          </button>
          <span className="text-[8px] font-black uppercase tracking-widest text-rivix bg-rivix/20 px-2.5 py-1 rounded-full inline-block">Hotspot Coordinates</span>
          <h4 className="text-sm font-bold mt-1 text-white">{activeHotspot.title}</h4>
          <p className="text-xs text-slate-400 leading-relaxed">{activeHotspot.description}</p>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-start gap-3">
          <Cpu size={18} className="text-rivix shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Physical Spec Review</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {physicalReviewNote(selectedRep, template)}
            </p>
          </div>
        </div>
      )}

      {/* Material checklist Table (admin only: tech files are prepared by RIVIX admin) */}
      {isAdmin ? (
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest text-slate-500">{product ? `${template.family.label} specs` : 'Apparel Specs'}</h3>
        </div>

        <div className="divide-y divide-slate-100 text-xs p-5 space-y-4">
          {rows.map((row, i) => (
            <div key={`${i}-${row.label}`} className="grid grid-cols-2 gap-1 pt-3 first:pt-0">
              <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">{row.label}</span>
              {row.value?.trim()
                ? <span className="font-semibold text-slate-700">{row.value}{row.state && <span className="block text-[10px] font-normal text-slate-400">{row.state}</span>}</span>
                : <span className="italic text-slate-300">Not filled in yet</span>}
            </div>
          ))}
          <div className="pt-3">
            <button onClick={() => setActiveTab('review')} className="text-[11px] font-bold text-rivix hover:underline">
              Fill in or correct these on the Review &amp; Approve tab →
            </button>
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-2" role="note">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Tech file</h3>
          <p className="text-sm font-semibold text-slate-800">The tech file is prepared by RIVIX admin.</p>
          <p className="text-[13px] leading-relaxed text-slate-500">
            {selectedRep.techFile?.status === 'approved'
              ? `It has been approved${selectedRep.techFile.revision ? ` (revision ${selectedRep.techFile.revision})` : ''}.`
              : selectedRep.techFile?.status === 'draft' ? 'A draft is being checked by the admin.' : 'Add clear photos of the front, back, inside label and close-ups. The admin takes it from there.'}
            {' '}Questions or extra details for the admin go in the Team chat.
          </p>
        </div>
      )}

    </div>
  );
}
