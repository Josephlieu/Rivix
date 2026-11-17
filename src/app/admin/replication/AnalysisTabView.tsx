'use client';

// The AI analysis tab's display, moved AS IS out of ReplicationDetail.tsx (2026-11-17) so it can be rendered on its own: with
// data passed in as props, a test can draw it for every category, and the page wraps it in an error boundary. ReplicationDetail
// keeps the data, the state and the actions and passes them in under the same names; the markup below is unchanged.
import type { Dispatch, SetStateAction } from 'react';
import TypeCheckPanel from './TypeCheckPanel';
import { isTypeConfirmed } from '@/lib/type-check';
import { outstandingConfirmations } from '@/lib/garmentAiAnalysis';
import type { ReplicationRequest } from '@/lib/replicationStorage';
import type { ResolvedTemplate } from '@/lib/template-catalog';
import { isProduct, itemWord, measurementFootnote, sizeColumns, sizeRange } from '@/lib/template-display';
import { ShieldCheck, CheckCircle, FileText, AlertCircle, ScanLine, Zap, Eye, Layers, Target, Activity, Sparkles, Camera, Sliders, BookOpen } from 'lucide-react';

// AI Analysis Types
export interface AIDetectedComponent {
  id: string;
  type: 'zipper' | 'snap' | 'button' | 'seam' | 'pocket' | 'reflective' | 'fabric' | 'collar' | 'cuff' | 'knee_pad' | 'hood' | 'vent' | 'drawcord' | 'closure' | 'reinforcement';
  label: string;
  confidence: number;
  location: string;
  details?: string;
  x: number;
  y: number;
}

export interface AIMeasurement {
  pom: string;
  description: string;
  xs: string;
  s: string;
  m: string;
  l: string;
  xl: string;
  tolerance: string;
}

export interface AIConstruction {
  location: string;
  seamType: string;
  stitchType: string;
  spiTop: number;
  spiBottom: number;
  seamAllowance: string;
  notes: string;
}

export interface AIStitchRef {
  code: string;
  name: string;
  machineType: string;
  defaultSpi: number;
  usage: string;
}

export interface AILabelPlacement {
  type: string;
  location: string;
  attachment: string;
  dimensions: string;
  material: string;
}

export interface AIColorway {
  bodyColor: string;
  contrastColors: string[];
  threadColor: string;
  hardwareFinish: string;
  reflectiveTape: string;
}

export interface AIWashCare {
  instructions: string[];
  specialNotes: string;
}

export interface AIBOM {
  hardware: string[];
  thread: string[];
  labels: string[];
  packaging: {
    foldDescription: string;
    polybagSize: string;
    cartonSize: string;
    hangtagSpec?: string;
  };
}

export interface AIAnalysisResult {
  status: 'idle' | 'scanning' | 'complete';
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  progress: number;
  components: AIDetectedComponent[];
  detectedSoFar: AIDetectedComponent[]; // progressively revealed during scan
  fabricAnalysis: {
    material: string;
    weight: string;
    weaveType: string;
    frRating: string;
    finish?: string;
    shrinkage?: string;
    confidence: number;
  } | null;
  wireframeGenerated: boolean;
  garmentClass: string | null;
  overallConfidence: number | null;
  season: string | null;
  measurements: AIMeasurement[];
  bom: AIBOM | null;
  construction: AIConstruction[];
  stitchReference: AIStitchRef[];
  labelPlacements: AILabelPlacement[];
  colorway: AIColorway | null;
  washCare: AIWashCare | null;
}

// The generic on-screen sketch is not drawn from the photo (it showed bib overalls for a coverall). Hidden until real drawings per garment type exist (milestone M4).
export const SHOW_GENERIC_SKETCH = false;

export const AI_SCAN_STEPS = [
  { label: 'Initializing Computer Vision Model...', duration: 800 },
  { label: 'Analyzing Fabric Texture & Weave Pattern...', duration: 1400 },
  { label: 'Detecting Hardware Components (Snaps, Zippers, Buttons)...', duration: 1800 },
  { label: 'Mapping Seam Construction & Stitch Patterns...', duration: 1500 },
  { label: 'Identifying Safety Compliance Markers...', duration: 1200 },
  { label: 'Extracting Reflective Striping Geometry...', duration: 1000 },
  { label: 'Generating Technical CAD Wireframe...', duration: 2000 },
  { label: 'Cross-referencing NFPA 2112 / CSA Z96 Standards...', duration: 900 },
];

/** A saved scan (already through normalizeAnalysis) as the tab shows it: moved as is from ReplicationDetail's getAIAnalysis. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function analysisResultFromSaved(saved: Record<string, any>): AIAnalysisResult {
  return {
    status: 'complete',
    currentStep: AI_SCAN_STEPS.length,
    totalSteps: AI_SCAN_STEPS.length,
    stepLabel: 'Analysis Complete — Components Mapped to Blueprint',
    progress: 100,
    components: saved.components || [],
    detectedSoFar: saved.components || [],
    fabricAnalysis: saved.fabricAnalysis || null,
    wireframeGenerated: true,
    garmentClass: saved.garmentClass || null,
    overallConfidence: saved.overallConfidence ?? null,
    season: saved.season || null,
    measurements: saved.measurements || [],
    bom: saved.bom || null,
    construction: saved.construction || [],
    stitchReference: saved.stitchReference || [],
    labelPlacements: saved.labelPlacements || [],
    colorway: saved.colorway || null,
    washCare: saved.washCare || null,
  };
}

export interface AnalysisTabViewProps {
  selectedRep: ReplicationRequest;
  getAIAnalysis: (repId: string) => AIAnalysisResult;
  isAdmin: boolean;
  building: boolean;
  handleDownload: () => void | Promise<void>;
  handleStartAIAnalysis: (repId: string, garmentType: string) => void | Promise<void>;
  setActiveTab: (t: 'specs' | 'ai_analysis' | 'review' | 'tracking' | 'chat') => void;
  setError: (message: string) => void;
  setReplications: Dispatch<SetStateAction<ReplicationRequest[]>>;
  setSelectedRep: Dispatch<SetStateAction<ReplicationRequest | null>>;
  /** The request's template (the shared lookup), or null when it could not be read: then the tab reads as for clothing. */
  template?: ResolvedTemplate | null;
}

export default function AnalysisTabView({ selectedRep, getAIAnalysis, isAdmin, building, handleDownload, handleStartAIAnalysis, setActiveTab, setError, setReplications, setSelectedRep, template = null }: AnalysisTabViewProps) {
  // 2026-11-18: gloves, footwear and PPE (template-display.ts): their sizes, words and notes. Clothing reads as before.
  const product = isProduct(template);
              const analysis = getAIAnalysis(selectedRep.id);
              // The size columns and the measurement note: the template's sizes (saved size run, else the template's own).
              const sizing = { sizeRun: selectedRep.aiAnalysis?.sizeRun, measurements: analysis.measurements };
              const cols = sizeColumns(sizing, template);
              const componentTypeIcon = (type: string) => {
                switch(type) {
                  case 'zipper': return '⚡';
                  case 'snap': return '🔘';
                  case 'button': return '⏺';
                  case 'seam': return '🧵';
                  case 'pocket': return '👝';
                  case 'reflective': return '✨';
                  case 'fabric': return '🧶';
                  case 'collar': return '👔';
                  case 'cuff': return '🔗';
                  case 'knee_pad': return '🦿';
                  default: return '📍';
                }
              };
              const componentTypeColor = (type: string) => {
                switch(type) {
                  case 'zipper': return 'bg-amber-100 text-amber-700 border-amber-200';
                  case 'snap': return 'bg-sky-100 text-sky-700 border-sky-200';
                  case 'button': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
                  case 'seam': return 'bg-rose-100 text-rose-700 border-rose-200';
                  case 'pocket': return 'bg-teal-100 text-teal-700 border-teal-200';
                  case 'reflective': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
                  case 'fabric': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
                  case 'collar': return 'bg-purple-100 text-purple-700 border-purple-200';
                  case 'cuff': return 'bg-orange-100 text-orange-700 border-orange-200';
                  case 'knee_pad': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
                  default: return 'bg-slate-100 text-slate-700 border-slate-200';
                }
              };

              return (
                <div className="space-y-6">
                  {/* AI Analysis Header */}
                  <div className="bg-gradient-to-r from-violet-50 via-indigo-50 to-purple-50 border border-violet-100 rounded-3xl p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-violet-100 text-violet-600 rounded-2xl shrink-0">
                          <ScanLine size={24} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">AI garment analysis</h3>
                          <p className="text-sm text-slate-600 mt-1 leading-relaxed max-w-xl">Reads the customer's photos and drafts the tech file. It only describes what it can see; anything else is left blank for you to confirm.</p>
                        </div>
                      </div>
                      {analysis.status === 'idle' && (
                        <button
                          onClick={() => handleStartAIAnalysis(selectedRep.id, selectedRep.garmentType)}
                          disabled={!isTypeConfirmed(selectedRep)}
                          title={isTypeConfirmed(selectedRep) ? undefined : 'Confirm the product type first (below).'}
                          className="disabled:cursor-not-allowed disabled:opacity-50 bg-violet-600 text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-violet-700 transition-all flex items-center gap-2 shrink-0 active:scale-95 shadow-lg shadow-violet-200"
                        >
                          <Zap size={14} /> Run AI Scan
                        </button>
                      )}
                      {analysis.status === 'complete' && (
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold">
                            <CheckCircle size={14} /> Analysis complete
                          </div>
                          <button
                            onClick={() => handleStartAIAnalysis(selectedRep.id, selectedRep.garmentType)}
                            disabled={!isTypeConfirmed(selectedRep)}
                            className="disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 active:scale-95"
                            title="Scan the photos again. This replaces the current draft and any corrections."
                          >
                            <Zap size={13} /> Run again
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Task 28, step 1: the product type is confirmed before the scan (the form's type is only a starting guess). */}
                    {analysis.status !== 'scanning' && (
                      <TypeCheckPanel
                        rep={selectedRep}
                        onNote={setError}
                        onUpdated={(saved) => { setReplications(prev => prev.map(r => (r.id === saved.id ? saved : r))); setSelectedRep(cur => (cur && cur.id === saved.id ? saved : cur)); }}
                      />
                    )}

                    {/* Scanning Progress — Visual Garment Scan */}
                    {analysis.status === 'scanning' && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Live Scan Visual (7 cols) — garment silhouette with sweep line + bounding boxes */}
                        <div className="lg:col-span-7 bg-slate-950 rounded-3xl p-6 relative overflow-hidden border border-slate-800 shadow-inner min-h-[420px] flex flex-col items-center justify-center">
                          <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                            <div className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-pulse" />
                            <span className="text-[12px] font-black text-violet-300 uppercase tracking-widest">Live Scan</span>
                          </div>
                          <div className="absolute top-4 right-4 text-[12px] font-black text-emerald-300 uppercase tracking-widest bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 z-10">
                            {analysis.detectedSoFar.length} components found
                          </div>

                          {/* Garment silhouette with scan overlay */}
                          <svg viewBox="0 0 400 600" className="w-full h-full max-h-[380px] select-none">
                            <defs>
                              <pattern id="scan-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth="1"/>
                              </pattern>
                              <linearGradient id="scanLineGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(139,92,246,0)" />
                                <stop offset="40%" stopColor="rgba(139,92,246,0.6)" />
                                <stop offset="50%" stopColor="rgba(167,139,250,1)" />
                                <stop offset="60%" stopColor="rgba(139,92,246,0.6)" />
                                <stop offset="100%" stopColor="rgba(139,92,246,0)" />
                              </linearGradient>
                            </defs>

                            <rect width="100%" height="100%" fill="url(#scan-grid)" rx="24" />

                            {/* Dim garment outline (pre-scan state) */}
                            {selectedRep.garmentType === 'overalls' ? (
                              <>
                                <rect x="135" y="65" width="20" height="75" rx="3" fill="none" stroke="rgba(139,92,246,0.25)" strokeWidth="1.5" />
                                <rect x="245" y="65" width="20" height="75" rx="3" fill="none" stroke="rgba(139,92,246,0.25)" strokeWidth="1.5" />
                                <path d="M 120 135 L 280 135 L 295 240 L 305 240 L 295 560 L 230 560 L 215 330 L 185 330 L 170 560 L 105 560 L 95 240 L 105 240 Z"
                                  fill="rgba(139,92,246,0.04)" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4,4" />
                              </>
                            ) : (
                              <>
                                <path d="M 145 130 C 145 60, 255 60, 255 130 Z" fill="none" stroke="rgba(139,92,246,0.25)" strokeWidth="1.5" />
                                <rect x="120" y="130" width="160" height="290" rx="12" fill="rgba(139,92,246,0.04)" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" strokeDasharray="4,4" />
                                <path d="M 120 135 L 55 290 L 85 300 L 120 190 Z" fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" strokeDasharray="4,4" />
                                <path d="M 280 135 L 345 290 L 315 300 L 280 190 Z" fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" strokeDasharray="4,4" />
                              </>
                            )}

                            {/* Scanning sweep line — moves top to bottom */}
                            <rect x="70" y="0" width="260" height="40" fill="url(#scanLineGrad)" opacity="0.8">
                              <animate attributeName="y" values="0;580;0" dur="3s" repeatCount="indefinite" />
                            </rect>

                            {/* Horizontal scan lines left/right of sweep */}
                            <line x1="60" y1="0" x2="60" y2="600" stroke="rgba(139,92,246,0.15)" strokeWidth="1">
                              <animate attributeName="y1" values="0;580;0" dur="3s" repeatCount="indefinite" />
                              <animate attributeName="y2" values="40;600;40" dur="3s" repeatCount="indefinite" />
                            </line>
                            <line x1="340" y1="0" x2="340" y2="600" stroke="rgba(139,92,246,0.15)" strokeWidth="1">
                              <animate attributeName="y1" values="0;580;0" dur="3s" repeatCount="indefinite" />
                              <animate attributeName="y2" values="40;600;40" dur="3s" repeatCount="indefinite" />
                            </line>

                            {/* Progressively revealed detection bounding boxes */}
                            {analysis.detectedSoFar.map((comp, i) => {
                              const cx = (comp.x / 100) * 400;
                              const cy = (comp.y / 100) * 600;
                              const boxW = comp.type === 'seam' ? 80 : comp.type === 'reflective' ? 120 : comp.type === 'fabric' ? 70 : 50;
                              const boxH = comp.type === 'seam' ? 60 : comp.type === 'knee_pad' ? 70 : comp.type === 'reflective' ? 25 : 40;
                              const boxColor = comp.type === 'zipper' ? 'rgba(245,158,11,0.7)' 
                                : comp.type === 'snap' || comp.type === 'button' ? 'rgba(99,102,241,0.7)'
                                : comp.type === 'seam' ? 'rgba(244,63,94,0.6)'
                                : comp.type === 'pocket' ? 'rgba(20,184,166,0.7)'
                                : comp.type === 'reflective' ? 'rgba(250,204,21,0.7)'
                                : comp.type === 'knee_pad' ? 'rgba(6,182,212,0.7)'
                                : 'rgba(139,92,246,0.7)';
                              const fillColor = boxColor.replace(/[\d.]+\)$/, '0.08)');

                              return (
                                <g key={comp.id} className="animate-[fadeIn_0.5s_ease-out]">
                                  {/* Bounding box */}
                                  <rect 
                                    x={cx - boxW/2} y={cy - boxH/2} 
                                    width={boxW} height={boxH} 
                                    rx="4" 
                                    fill={fillColor}
                                    stroke={boxColor}
                                    strokeWidth="1.5"
                                    strokeDasharray="3,2"
                                  />
                                  {/* Corner brackets */}
                                  <path d={`M ${cx-boxW/2} ${cy-boxH/2+8} L ${cx-boxW/2} ${cy-boxH/2} L ${cx-boxW/2+8} ${cy-boxH/2}`} fill="none" stroke={boxColor} strokeWidth="2" />
                                  <path d={`M ${cx+boxW/2} ${cy-boxH/2+8} L ${cx+boxW/2} ${cy-boxH/2} L ${cx+boxW/2-8} ${cy-boxH/2}`} fill="none" stroke={boxColor} strokeWidth="2" />
                                  <path d={`M ${cx-boxW/2} ${cy+boxH/2-8} L ${cx-boxW/2} ${cy+boxH/2} L ${cx-boxW/2+8} ${cy+boxH/2}`} fill="none" stroke={boxColor} strokeWidth="2" />
                                  <path d={`M ${cx+boxW/2} ${cy+boxH/2-8} L ${cx+boxW/2} ${cy+boxH/2} L ${cx+boxW/2-8} ${cy+boxH/2}`} fill="none" stroke={boxColor} strokeWidth="2" />
                                  {/* Label */}
                                  <rect x={cx - boxW/2} y={cy - boxH/2 - 16} width={Math.min(comp.label.length * 5.5 + 20, 140)} height="14" rx="3" fill="rgba(15,23,42,0.85)" />
                                  <text x={cx - boxW/2 + 4} y={cy - boxH/2 - 6} fill={boxColor} fontSize="7" fontFamily="monospace" fontWeight="bold">
                                    {comp.label.substring(0, 22)}
                                  </text>
                                  {/* Confidence badge */}
                                  <rect x={cx + boxW/2 - 28} y={cy - boxH/2 - 16} width="28" height="14" rx="3" fill="rgba(16,185,129,0.9)" />
                                  <text x={cx + boxW/2 - 24} y={cy - boxH/2 - 6} fill="white" fontSize="7" fontFamily="monospace" fontWeight="bold">
                                    {comp.confidence}%
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>

                        {/* Right panel — live detection feed (5 cols) */}
                        <div className="lg:col-span-5 space-y-4">
                          {/* Progress */}
                          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-violet-100 p-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-violet-500 rounded-full animate-pulse" />
                                <span className="text-xs font-bold text-violet-700">Processing...</span>
                              </div>
                              <span className="text-xs font-black text-violet-600">{analysis.progress}%</span>
                            </div>
                            <div className="w-full bg-violet-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${analysis.progress}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Activity size={12} className="text-violet-500 animate-pulse" />
                              <span className="text-[14px] text-violet-600 font-semibold">{analysis.stepLabel}</span>
                            </div>
                            {analysis.progress >= 85 && (
                              <p className="text-[13px] text-violet-500">Waiting for the AI to answer. This can take up to a minute for large photos: please keep this page open.</p>
                            )}
                            <div className="flex items-center gap-1 mt-1">
                              {AI_SCAN_STEPS.map((_, idx) => (
                                <div key={idx} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                  idx < analysis.currentStep ? 'bg-violet-500' : idx === analysis.currentStep ? 'bg-violet-300 animate-pulse' : 'bg-violet-100'
                                }`} />
                              ))}
                            </div>
                          </div>

                          {/* Live detection feed — components appearing as found */}
                          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                            <div className="bg-violet-50 px-5 py-3 border-b border-violet-100 flex items-center justify-between">
                              <h3 className="text-[13px] font-black text-violet-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Target size={12} /> Live Detection Feed
                              </h3>
                              <span className="text-[12px] font-bold text-violet-500 animate-pulse">Scanning...</span>
                            </div>
                            <div className="max-h-[280px] overflow-y-auto">
                              {analysis.detectedSoFar.length === 0 ? (
                                <div className="p-8 text-center">
                                  <ScanLine size={24} className="text-violet-300 mx-auto animate-pulse" />
                                  <p className="text-[13px] text-slate-400 mt-2 font-semibold">Waiting for detections...</p>
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-50">
                                  {analysis.detectedSoFar.map((comp) => (
                                    <div key={comp.id} className="px-4 py-3 flex items-center gap-3 animate-[fadeIn_0.4s_ease-out]">
                                      <span className="text-sm">{componentTypeIcon(comp.type)}</span>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold text-slate-800 block truncate">{comp.label}</span>
                                        <span className="text-[12px] text-slate-400 truncate block">{comp.location}</span>
                                      </div>
                                      <span className={`text-[12px] font-black px-1.5 py-0.5 rounded-full border ${componentTypeColor(comp.type)}`}>
                                        {comp.type.replace('_', ' ')}
                                      </span>
                                      <span className="text-[12px] font-black text-emerald-600">{comp.confidence}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status: how much is still open, and the way on to the Review tab */}
                  {analysis.status === 'complete' && (() => {
                    const open = outstandingConfirmations(selectedRep.aiAnalysis).length;
                    return (
                      <div role="note" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${open ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                        <div className="flex items-start gap-3">
                          <AlertCircle size={18} className={`mt-0.5 shrink-0 ${open ? 'text-amber-600' : 'text-emerald-600'}`} />
                          <p className={`text-sm leading-relaxed ${open ? 'text-amber-900' : 'text-emerald-900'}`}>
                            {open
                              ? <><b>{open} item{open > 1 ? 's' : ''} still need confirmation.</b> This is a draft from photos: blank means the AI could not see it. Confirm each item on the Review tab.</>
                              : <b>Everything is confirmed. Check the draft once more, then approve it.</b>}
                          </p>
                        </div>
                        {isAdmin && <button onClick={() => setActiveTab('review')} className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800">Review and approve →</button>}
                      </div>
                    );
                  })()}

                  {/* AI Results Grid — only show when analysis is complete */}
                  {analysis.status === 'complete' && (
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-clip flex flex-col">
                      {/* Tech Pack Header */}
                      <div className="bg-slate-900 text-white p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-xl font-black tracking-tight text-white">TECH PACK: AI DRAFT</h2>
                            <span className="bg-violet-500/20 text-[13px] font-bold px-2.5 py-0.5 rounded-sm uppercase tracking-widest text-violet-300 border border-violet-500/30 flex items-center gap-1.5">
                              <Sparkles size={10} /> AI Inferred Spec
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-3 mt-5 text-xs">
                            <div><span className="text-slate-400 block text-[12px] uppercase tracking-wider mb-0.5">Brand</span> <span className="font-semibold text-slate-200">{selectedRep.clientName}</span></div>
                            <div><span className="text-slate-400 block text-[12px] uppercase tracking-wider mb-0.5">Style</span> <span className="font-semibold text-slate-200">{selectedRep.garmentType.toUpperCase()}</span></div>
                            <div><span className="text-slate-400 block text-[12px] uppercase tracking-wider mb-0.5">Date</span> <span className="font-semibold text-slate-200">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                            <div><span className="text-slate-400 block text-[12px] uppercase tracking-wider mb-0.5">Size Range</span> <span className="font-semibold text-slate-200">{sizeRange(sizing, template)}</span></div>
                            {analysis.season && <div><span className="text-slate-400 block text-[12px] uppercase tracking-wider mb-0.5">Season</span> <span className="font-semibold text-slate-200">{analysis.season}</span></div>}
                          </div>
                        </div>
                        {isAdmin && (                        <button
                          onClick={handleDownload}
                          disabled={building}
                          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-bold text-xs px-6 py-3 rounded-lg flex items-center gap-2.5 transition-all shadow-lg shadow-emerald-500/20 shrink-0"
                        >
                          {building ? (
                            <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> BUILDING...</>
                          ) : (
                            <><FileText size={14} /> DOWNLOAD TECH FILE (PDF)</>
                          )}
                        </button>)}
                      </div>

                      {/* Tech Pack Body - Two Columns */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 bg-slate-50">
                        {/* Left: Technical Flat Sketch & POM Callouts */}
                        <div className="lg:col-span-5 bg-white p-6 lg:p-8 border-r border-slate-200 flex flex-col">
                          <div className="lg:sticky lg:top-24 flex flex-col">
                          <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4 flex items-center justify-between">
                            Garment photos
                            <span className="text-xs font-normal text-slate-400">{selectedRep.images?.length || 0} uploaded</span>
                          </h3>

                          {SHOW_GENERIC_SKETCH ? (
                          <div className="relative w-full bg-white border border-slate-300 rounded-sm overflow-hidden flex flex-col shadow-sm">
                            {/* Title Block */}
                            <div className="bg-slate-50 border-b border-slate-300 px-4 py-2 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">STYLE: {analysis.garmentClass?.toUpperCase() || selectedRep.garmentType.toUpperCase()}</span>
                                <span className="text-[11px] text-slate-400">|</span>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">SAMPLE SIZE: M</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {analysis.overallConfidence || 95}% CONFIDENCE
                                </span>
                              </div>
                            </div>

                            {/* SVG Flat Sketch */}
                            <svg viewBox="0 0 700 520" className="w-full select-none" style={{ background: '#fff' }}>
                              {/* Grid */}
                              <defs>
                                <pattern id="tp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                                </pattern>
                              </defs>
                              <rect width="700" height="520" fill="url(#tp-grid)" />

                              {/* Labels */}
                              <text x="175" y="22" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="bold" fontFamily="Arial, sans-serif" letterSpacing="2">FRONT VIEW</text>
                              <text x="525" y="22" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="bold" fontFamily="Arial, sans-serif" letterSpacing="2">BACK VIEW</text>

                              {(() => {
                                // AI classification takes priority over client-submitted garmentType
                                const aiClass = (analysis.garmentClass || '').toLowerCase();
                                const isOveralls = aiClass.includes('overall') || aiClass.includes('coverall') ||
                                  (!aiClass && selectedRep.garmentType === 'overalls');
                                const isPants = aiClass.includes('pant') || aiClass.includes('trouser') ||
                                  (!aiClass && selectedRep.garmentType === 'pants');
                                const isVest = aiClass.includes('vest') || aiClass.includes('gilet') ||
                                  (!aiClass && selectedRep.garmentType === 'vest');

                                if (isOveralls) {
                                  return (
                                    <>
                                      {/* ========== FRONT OVERALLS ========== */}
                                      <g transform="translate(175, 270)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        {/* Shoulder straps */}
                                        <path d="M -30,-210 L -25,-145" />
                                        <path d="M -20,-210 L -15,-145" />
                                        <path d="M 30,-210 L 25,-145" />
                                        <path d="M 20,-210 L 15,-145" />
                                        {/* Buckles */}
                                        <rect x="-34" y="-215" width="18" height="10" rx="2" strokeWidth="1.2" />
                                        <rect x="16" y="-215" width="18" height="10" rx="2" strokeWidth="1.2" />
                                        <line x1="-34" y1="-210" x2="-16" y2="-210" strokeWidth="0.8" />
                                        <line x1="16" y1="-210" x2="34" y2="-210" strokeWidth="0.8" />
                                        {/* Bib */}
                                        <path d="M -50,-145 L 50,-145 L 55,-70 L -55,-70 Z" />
                                        {/* Bib pocket */}
                                        <rect x="-30" y="-130" width="25" height="25" rx="2" strokeWidth="1" />
                                        <rect x="5" y="-130" width="25" height="25" rx="2" strokeWidth="1" />
                                        {/* Center front zip */}
                                        <line x1="0" y1="-145" x2="0" y2="80" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,2" />
                                        {/* Waist */}
                                        <path d="M -75,-70 L 75,-70" strokeWidth="1.5" />
                                        {/* Main body */}
                                        <path d="M -75,-70 L -80,80 L -65,220 L -15,220 L -8,80 L 8,80 L 15,220 L 65,220 L 80,80 L 75,-70" />
                                        {/* Cargo pockets */}
                                        <rect x="-72" y="-20" width="35" height="40" rx="3" strokeWidth="1" />
                                        <path d="M -72,-20 L -37,-20 L -40,-12 L -69,-12 Z" strokeWidth="0.8" />
                                        <rect x="37" y="-20" width="35" height="40" rx="3" strokeWidth="1" />
                                        <path d="M 37,-20 L 72,-20 L 69,-12 L 40,-12 Z" strokeWidth="0.8" />
                                        {/* Knee pad areas */}
                                        <rect x="-62" y="110" width="42" height="55" rx="6" strokeWidth="1" strokeDasharray="4,2" />
                                        <rect x="20" y="110" width="42" height="55" rx="6" strokeWidth="1" strokeDasharray="4,2" />
                                        <text x="-41" y="142" textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="Arial">KNEE PAD</text>
                                        <text x="41" y="142" textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="Arial">KNEE PAD</text>
                                        {/* Hi-vis bands */}
                                        <rect x="-78" y="-55" width="156" height="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        <rect x="-63" y="185" width="45" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        <rect x="18" y="185" width="45" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        {/* Inner leg seam */}
                                        <line x1="-8" y1="80" x2="-15" y2="220" strokeWidth="0.6" strokeDasharray="2,3" stroke="#94a3b8" />
                                        <line x1="8" y1="80" x2="15" y2="220" strokeWidth="0.6" strokeDasharray="2,3" stroke="#94a3b8" />
                                      </g>

                                      {/* ========== BACK OVERALLS ========== */}
                                      <g transform="translate(525, 270)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        {/* Shoulder straps */}
                                        <path d="M -30,-210 L -25,-145" />
                                        <path d="M -20,-210 L -15,-145" />
                                        <path d="M 30,-210 L 25,-145" />
                                        <path d="M 20,-210 L 15,-145" />
                                        {/* Cross straps */}
                                        <path d="M -25,-185 L 25,-165" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,2" />
                                        <path d="M 25,-185 L -25,-165" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,2" />
                                        {/* Back panel */}
                                        <path d="M -50,-145 L 50,-145 L 55,-70 L -55,-70 Z" />
                                        {/* CB seam */}
                                        <line x1="0" y1="-145" x2="0" y2="-70" strokeWidth="0.6" strokeDasharray="2,3" stroke="#94a3b8" />
                                        {/* Waist */}
                                        <path d="M -75,-70 L 75,-70" strokeWidth="1.5" />
                                        {/* Main body */}
                                        <path d="M -75,-70 L -80,80 L -65,220 L -15,220 L -8,80 L 8,80 L 15,220 L 65,220 L 80,80 L 75,-70" />
                                        {/* Back pockets */}
                                        <rect x="-55" y="-55" width="30" height="28" rx="2" strokeWidth="1" />
                                        <rect x="25" y="-55" width="30" height="28" rx="2" strokeWidth="1" />
                                        {/* Hi-vis bands */}
                                        <rect x="-78" y="-55" width="156" height="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        <rect x="-63" y="185" width="45" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        <rect x="18" y="185" width="45" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        {/* Knee pads */}
                                        <rect x="-62" y="110" width="42" height="55" rx="6" strokeWidth="1" strokeDasharray="4,2" />
                                        <rect x="20" y="110" width="42" height="55" rx="6" strokeWidth="1" strokeDasharray="4,2" />
                                      </g>
                                    </>
                                  );
                                }

                                if (isPants) {
                                  return (
                                    <>
                                      {/* ========== FRONT PANTS ========== */}
                                      <g transform="translate(175, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        {/* Waistband */}
                                        <path d="M -65,-200 L 65,-200 L 68,-185 L -68,-185 Z" />
                                        <line x1="0" y1="-200" x2="0" y2="-185" strokeWidth="0.8" />
                                        {/* Belt loops */}
                                        {[-50, -25, 25, 50].map(x => <rect key={x} x={x-3} y={-205} width="6" height="22" rx="1" strokeWidth="0.8" />)}
                                        {/* Fly */}
                                        <path d="M 0,-185 C 5,-140 5,-130 0,-120" strokeWidth="1.2" />
                                        {/* Main body */}
                                        <path d="M -68,-185 L -72,30 L -55,220 L -10,220 L -5,30 L 5,30 L 10,220 L 55,220 L 72,30 L 68,-185" />
                                        {/* Front pockets */}
                                        <path d="M -68,-175 C -55,-165 -40,-185 -30,-185" strokeWidth="1" />
                                        <path d="M 68,-175 C 55,-165 40,-185 30,-185" strokeWidth="1" />
                                        {/* Crease lines */}
                                        <line x1="-32" y1="-100" x2="-32" y2="210" strokeWidth="0.5" strokeDasharray="6,4" stroke="#cbd5e1" />
                                        <line x1="32" y1="-100" x2="32" y2="210" strokeWidth="0.5" strokeDasharray="6,4" stroke="#cbd5e1" />
                                      </g>

                                      {/* ========== BACK PANTS ========== */}
                                      <g transform="translate(525, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        <path d="M -65,-200 L 65,-200 L 68,-185 L -68,-185 Z" />
                                        <line x1="0" y1="-200" x2="0" y2="-185" strokeWidth="0.8" />
                                        {[-50, -25, 25, 50].map(x => <rect key={x} x={x-3} y={-205} width="6" height="22" rx="1" strokeWidth="0.8" />)}
                                        {/* CB seam */}
                                        <path d="M 0,-185 L 0,-120" strokeWidth="0.8" strokeDasharray="2,3" stroke="#94a3b8" />
                                        <path d="M -68,-185 L -72,30 L -55,220 L -10,220 L -5,30 L 5,30 L 10,220 L 55,220 L 72,30 L 68,-185" />
                                        {/* Back yoke */}
                                        <path d="M -68,-170 C -20,-155 20,-155 68,-170" strokeWidth="1" strokeDasharray="3,2" />
                                        {/* Back pockets */}
                                        <rect x="-48" y="-130" width="28" height="30" rx="2" strokeWidth="1" />
                                        <rect x="20" y="-130" width="28" height="30" rx="2" strokeWidth="1" />
                                        <line x1="-32" y1="-100" x2="-32" y2="210" strokeWidth="0.5" strokeDasharray="6,4" stroke="#cbd5e1" />
                                        <line x1="32" y1="-100" x2="32" y2="210" strokeWidth="0.5" strokeDasharray="6,4" stroke="#cbd5e1" />
                                      </g>
                                    </>
                                  );
                                }

                                if (isVest) {
                                  return (
                                    <>
                                      {/* ========== FRONT VEST ========== */}
                                      <g transform="translate(175, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        <path d="M -25,-205 C -20,-220 20,-220 25,-205" strokeWidth="2" />
                                        <path d="M -25,-205 C -30,-195 -35,-195 -40,-200 L -30,-210 Z" strokeWidth="1.2" />
                                        <path d="M 25,-205 C 30,-195 35,-195 40,-200 L 30,-210 Z" strokeWidth="1.2" />
                                        <line x1="-40" y1="-200" x2="-70" y2="-185" strokeWidth="1.8" />
                                        <line x1="40" y1="-200" x2="70" y2="-185" strokeWidth="1.8" />
                                        <path d="M -55,-185 L -55,105 L 55,105 L 55,-185" />
                                        <path d="M -70,-185 L -55,-185" strokeWidth="1.2" />
                                        <path d="M 70,-185 L 55,-185" strokeWidth="1.2" />
                                        {/* Armholes */}
                                        <path d="M -70,-185 C -70,-120 -55,-105 -55,-105" strokeWidth="1.2" />
                                        <path d="M 70,-185 C 70,-120 55,-105 55,-105" strokeWidth="1.2" />
                                        <line x1="0" y1="-205" x2="0" y2="105" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,2" />
                                        <rect x="-3" y="-195" width="6" height="8" rx="1" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.8" />
                                        <rect x="-45" y="-155" width="30" height="30" rx="2" strokeWidth="1" />
                                        <rect x="15" y="-155" width="30" height="30" rx="2" strokeWidth="1" />
                                        <line x1="-55" y1="100" x2="55" y2="100" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                        {analysis.components?.some(c => c.type === 'reflective') && (
                                          <>
                                            <rect x="-55" y="-60" width="110" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                            <rect x="-55" y="60" width="110" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          </>
                                        )}
                                      </g>
                                      {/* ========== BACK VEST ========== */}
                                      <g transform="translate(525, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        <path d="M -25,-205 C -20,-220 20,-220 25,-205" strokeWidth="2" />
                                        <line x1="-25" y1="-205" x2="-70" y2="-185" strokeWidth="1.8" />
                                        <line x1="25" y1="-205" x2="70" y2="-185" strokeWidth="1.8" />
                                        <path d="M -55,-185 L -55,105 L 55,105 L 55,-185" />
                                        <path d="M -70,-185 L -55,-185" strokeWidth="1.2" />
                                        <path d="M 70,-185 L 55,-185" strokeWidth="1.2" />
                                        <path d="M -70,-185 C -70,-120 -55,-105 -55,-105" strokeWidth="1.2" />
                                        <path d="M 70,-185 C 70,-120 55,-105 55,-105" strokeWidth="1.2" />
                                        <line x1="0" y1="-205" x2="0" y2="105" strokeWidth="0.6" strokeDasharray="3,4" stroke="#94a3b8" />
                                        <line x1="-55" y1="-165" x2="55" y2="-165" strokeWidth="1" strokeDasharray="3,2" />
                                        <text x="0" y="-170" textAnchor="middle" fill="#94a3b8" fontSize="5.5" fontFamily="Arial">YOKE</text>
                                        <line x1="-55" y1="100" x2="55" y2="100" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                        {analysis.components?.some(c => c.type === 'reflective') && (
                                          <>
                                            <rect x="-55" y="-60" width="110" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                            <rect x="-55" y="60" width="110" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          </>
                                        )}
                                      </g>
                                    </>
                                  );
                                }

                                // DEFAULT: Jacket/Outerwear flat
                                return (
                                  <>
                                    {/* ========== FRONT JACKET ========== */}
                                    <g transform="translate(175, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                      {/* Collar */}
                                      <path d="M -25,-205 C -20,-220 20,-220 25,-205" strokeWidth="2" />
                                      <path d="M -25,-205 C -30,-195 -35,-195 -40,-200 L -30,-210 Z" strokeWidth="1.2" />
                                      <path d="M 25,-205 C 30,-195 35,-195 40,-200 L 30,-210 Z" strokeWidth="1.2" />
                                      {/* Shoulder */}
                                      <line x1="-40" y1="-200" x2="-85" y2="-185" strokeWidth="1.8" />
                                      <line x1="40" y1="-200" x2="85" y2="-185" strokeWidth="1.8" />
                                      {/* Body */}
                                      <path d="M -70,-185 L -70,105 L 70,105 L 70,-185" />
                                      {/* Armhole */}
                                      <path d="M -85,-185 L -85,-140 C -85,-110 -70,-105 -70,-105" strokeWidth="1.2" />
                                      <path d="M 85,-185 L 85,-140 C 85,-110 70,-105 70,-105" strokeWidth="1.2" />
                                      {/* Sleeves */}
                                      <path d="M -85,-185 L -120,-40 L -95,-35 L -70,-105" />
                                      <path d="M 85,-185 L 120,-40 L 95,-35 L 70,-105" />
                                      {/* Sleeve hem */}
                                      <line x1="-118" y1="-45" x2="-95" y2="-40" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                      <line x1="118" y1="-45" x2="95" y2="-40" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                      {/* Center front zip */}
                                      <line x1="0" y1="-205" x2="0" y2="105" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,2" />
                                      {/* Zipper pull */}
                                      <rect x="-3" y="-195" width="6" height="8" rx="1" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.8" />
                                      {/* Chest pockets */}
                                      <rect x="-60" y="-155" width="38" height="35" rx="2" strokeWidth="1" />
                                      <path d="M -60,-155 L -22,-155 L -25,-147 L -57,-147 Z" strokeWidth="0.8" />
                                      <rect x="22" y="-155" width="38" height="35" rx="2" strokeWidth="1" />
                                      <path d="M 22,-155 L 60,-155 L 57,-147 L 25,-147 Z" strokeWidth="0.8" />
                                      {/* Hand pockets */}
                                      <path d="M -65,-30 L -65,25 L -25,25 L -25,-30 Z" strokeWidth="1" />
                                      <path d="M 65,-30 L 65,25 L 25,25 L 25,-30 Z" strokeWidth="1" />
                                      {/* Hem */}
                                      <line x1="-70" y1="100" x2="70" y2="100" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                      {/* Hi-vis bands if detected */}
                                      {analysis.components?.some(c => c.type === 'reflective') && (
                                        <>
                                          <rect x="-70" y="-80" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="-66" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="60" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="74" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                        </>
                                      )}
                                    </g>

                                    {/* ========== BACK JACKET ========== */}
                                    <g transform="translate(525, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                      {/* Collar */}
                                      <path d="M -25,-205 C -20,-220 20,-220 25,-205" strokeWidth="2" />
                                      {/* Shoulder */}
                                      <line x1="-25" y1="-205" x2="-85" y2="-185" strokeWidth="1.8" />
                                      <line x1="25" y1="-205" x2="85" y2="-185" strokeWidth="1.8" />
                                      {/* Body */}
                                      <path d="M -70,-185 L -70,105 L 70,105 L 70,-185" />
                                      {/* Armhole */}
                                      <path d="M -85,-185 L -85,-140 C -85,-110 -70,-105 -70,-105" strokeWidth="1.2" />
                                      <path d="M 85,-185 L 85,-140 C 85,-110 70,-105 70,-105" strokeWidth="1.2" />
                                      {/* Sleeves */}
                                      <path d="M -85,-185 L -120,-40 L -95,-35 L -70,-105" />
                                      <path d="M 85,-185 L 120,-40 L 95,-35 L 70,-105" />
                                      {/* CB seam */}
                                      <line x1="0" y1="-205" x2="0" y2="105" strokeWidth="0.6" strokeDasharray="3,4" stroke="#94a3b8" />
                                      {/* Back yoke seam */}
                                      <line x1="-70" y1="-165" x2="70" y2="-165" strokeWidth="1" strokeDasharray="3,2" />
                                      <text x="0" y="-170" textAnchor="middle" fill="#94a3b8" fontSize="5.5" fontFamily="Arial">YOKE</text>
                                      {/* Hem */}
                                      <line x1="-70" y1="100" x2="70" y2="100" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                      {/* Hi-vis bands if detected */}
                                      {analysis.components?.some(c => c.type === 'reflective') && (
                                        <>
                                          <rect x="-70" y="-80" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="-66" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="60" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="74" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                        </>
                                      )}
                                    </g>
                                  </>
                                );
                              })()}

                              {/* ========== POM CALLOUT LINES ========== */}
                              {analysis.measurements.length > 0 && (() => {
                                // Distribute POM callouts along the left and right margins of the FRONT view
                                const pomCount = Math.min(analysis.measurements.length, 10);
                                const startY = 55;
                                const spacing = 42;
                                return analysis.measurements.slice(0, pomCount).map((m, i) => {
                                  const yPos = startY + i * spacing;
                                  const isLeft = i % 2 === 0;
                                  // Leader line goes from garment body edge to margin
                                  const garmentX = isLeft ? 105 : 245;
                                  const marginX = isLeft ? 15 : 335;
                                  const labelX = isLeft ? 12 : 338;
                                  const anchor = isLeft ? 'end' : 'start';
                                  return (
                                    <g key={m.pom}>
                                      {/* Leader line */}
                                      <line x1={garmentX} y1={yPos} x2={marginX + (isLeft ? 18 : -18)} y2={yPos} stroke="#334155" strokeWidth="0.6" strokeDasharray="2,2" />
                                      {/* Dot on garment */}
                                      <circle cx={garmentX} cy={yPos} r="2.5" fill="#1e293b" />
                                      {/* POM label circle */}
                                      <circle cx={labelX + (isLeft ? 0 : 0)} cy={yPos} r="9" fill="#1e293b" />
                                      <text x={labelX} y={yPos + 3.5} textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="bold" fontFamily="Arial, sans-serif">{m.pom}</text>
                                      {/* Measurement value */}
                                      <text x={isLeft ? labelX - 14 : labelX + 14} y={yPos + 3} textAnchor={anchor} fill="#64748b" fontSize="5.5" fontFamily="Arial, sans-serif">{m.m}&quot;</text>
                                    </g>
                                  );
                                });
                              })()}

                              {/* Border frame */}
                              <rect x="2" y="2" width="696" height="516" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                              <rect x="5" y="5" width="690" height="510" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />

                              {/* Center divider */}
                              <line x1="350" y1="30" x2="350" y2="510" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="4,4" />

                              {/* Bottom info bar */}
                              <rect x="5" y="490" width="690" height="25" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
                              <text x="15" y="506" fill="#94a3b8" fontSize="6" fontFamily="Arial, sans-serif" fontWeight="bold">
                                AI-EXTRAPOLATED TECHNICAL FLAT — {analysis.garmentClass?.toUpperCase() || 'GARMENT'} — ALL MEASUREMENTS IN INCHES, TAKEN FLAT — RIVIX COMPLIANCE PORTAL
                              </text>
                              <text x="685" y="506" textAnchor="end" fill="#94a3b8" fontSize="6" fontFamily="Arial, sans-serif">
                                {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                              </text>
                            </svg>
                          </div>
                          ) : (
                            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">The technical drawing for this {itemWord(template)} type is on the Review &amp; Approve tab.{isAdmin && <> <button type="button" onClick={() => setActiveTab('review')} className="font-bold text-rivix hover:underline">Open it →</button></>}</p>
                          )}

                          {/* Photos the AI read: first one large, the rest as a grid */}
                          {selectedRep.images?.[0] && (
                            <div className="grid grid-cols-3 gap-2">
                              <img src={selectedRep.images[0]} alt="Main reference photo" title={selectedRep.imageLabels?.[0] || undefined} className="col-span-3 max-h-[26rem] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain" />
                              {selectedRep.images.slice(1).map((u, i) => (
                                <img key={u || i} src={u} alt={`Reference photo ${i + 2}`} title={selectedRep.imageLabels?.[i + 1] || undefined} className={`aspect-square w-full rounded-lg border object-cover ${selectedRep.imageLabels?.[i + 1] ? 'border-amber-400' : 'border-slate-200'}`} />
                              ))}
                            </div>
                          )}
                          {selectedRep.imageLabels?.some(Boolean) && (
                            <p className="mt-1 text-[11px] text-slate-500">Photos {selectedRep.imageLabels.map((l, i) => (l ? i + 1 : 0)).filter(Boolean).join(', ')}: {selectedRep.imageLabels.find(Boolean)}.</p>
                          )}
                          {/* Colours & WASH CARE — side by side */}
                          <div className="grid grid-cols-1 gap-6 mt-8">
                            {analysis.colorway && (
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                                <Eye size={14} className="text-violet-500" />
                                Colours
                              </h3>
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                                <div className="grid grid-cols-1 gap-2 text-[14px]">
                                  <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[12px]">Body</span><span className="font-semibold text-slate-800">{analysis.colorway.bodyColor || <i className="font-normal text-amber-700">Not visible in the photo, needs confirmation</i>}</span></div>
                                  {analysis.colorway.contrastColors?.length > 0 && (
                                    <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[12px]">Contrast</span><span className="font-semibold text-slate-800">{analysis.colorway.contrastColors.join(', ')}</span></div>
                                  )}
                                  <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[12px]">Thread</span><span className="font-semibold text-slate-800">{analysis.colorway.threadColor || <i className="font-normal text-amber-700">Not visible in the photo, needs confirmation</i>}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[12px]">Hardware</span><span className="font-semibold text-slate-800">{analysis.colorway.hardwareFinish || <i className="font-normal text-amber-700">Not visible in the photo, needs confirmation</i>}</span></div>
                                  {analysis.colorway.reflectiveTape && analysis.colorway.reflectiveTape !== 'N/A' && (
                                    <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[12px]">Reflective</span><span className="font-semibold text-slate-800">{analysis.colorway.reflectiveTape}</span></div>
                                  )}
                                </div>
                              </div>
                            </div>
                            )}

                            {analysis.washCare && (
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                                <ShieldCheck size={14} className="text-violet-500" />
                                Wash and care
                              </h3>
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                                <ul className="text-[14px] font-medium text-slate-700 space-y-1.5">
                                  {!analysis.washCare.instructions?.length && <li className="text-amber-700 italic">Not visible in the photo (no readable care label), needs confirmation</li>}
                                  {analysis.washCare.instructions?.map((inst, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 mt-1.5 bg-slate-300 rounded-full shrink-0" />
                                      {inst}
                                    </li>
                                  ))}
                                </ul>
                                {analysis.washCare.specialNotes && (
                                  <div className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-md mt-2">
                                    <span className="text-[12px] font-black uppercase tracking-widest text-amber-700">NOTE: </span>
                                    <span className="text-[13px] text-amber-800 font-medium">{analysis.washCare.specialNotes}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            )}
                          </div>
                          </div>
                        </div>

                        {/* Right: Measurements & BOM */}
                        <div className="lg:col-span-7 p-6 lg:p-8 space-y-8 bg-slate-50/50">
                          
                          {/* Measurement Spec Table */}
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                              <Sliders size={14} className="text-violet-500" />
                              Measurements (inches)
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                              <table className="w-full text-left text-[13px]">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-4 py-3 w-10 text-center">POM</th>
                                    <th className="px-4 py-3">DESCRIPTION</th>
                                    <th className="px-3 py-3 text-center border-l border-slate-200">{cols.labels[0]}</th>
                                    <th className="px-3 py-3 text-center border-l border-slate-200">{cols.labels[1]}</th>
                                    <th className="px-3 py-3 text-center border-l-2 border-r-2 border-violet-200 bg-violet-50 text-violet-900">{cols.sample ? `[${cols.labels[2]}]` : cols.labels[2]}</th>
                                    <th className="px-3 py-3 text-center border-r border-slate-200">{cols.labels[3]}</th>
                                    <th className="px-3 py-3 text-center border-r border-slate-200">{cols.labels[4]}</th>
                                    <th className="px-3 py-3 text-center text-slate-400">TOL +/-</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                  {analysis.measurements.length > 0 ? analysis.measurements.map((m) => (
                                    <tr key={m.pom} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-3 text-center font-bold text-slate-900 bg-slate-50">{m.pom}</td>
                                      <td className="px-4 py-3">{m.description}</td>
                                      <td className="px-3 py-3 text-center border-l border-slate-100">{m.xs}</td>
                                      <td className="px-3 py-3 text-center border-l border-slate-100">{m.s}</td>
                                      <td className="px-3 py-3 text-center border-l-2 border-r-2 border-violet-200 bg-violet-50/50 font-bold text-violet-900">{m.m}</td>
                                      <td className="px-3 py-3 text-center border-r border-slate-100">{m.l}</td>
                                      <td className="px-3 py-3 text-center border-r border-slate-100">{m.xl}</td>
                                      <td className="px-3 py-3 text-center text-slate-400">{m.tolerance}</td>
                                    </tr>
                                  )) : (
                                    <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400 italic">Run AI analysis to generate measurements</td></tr>
                                  )}
                                </tbody>
                              </table>
                              <div className="bg-slate-100/50 px-4 py-2.5 text-[11.5px] text-slate-500 uppercase tracking-widest border-t border-slate-200 font-bold">
                                {measurementFootnote(sizing, template)}
                              </div>
                            </div>
                          </div>

                          {/* BOM & Trims */}
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                              <BookOpen size={14} className="text-violet-500" />
                              Bill of materials
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                                <h4 className="text-[12.5px] font-black text-slate-400 uppercase mb-3 tracking-widest">Main Fabric</h4>
                                <p className="text-sm font-bold text-slate-800 mb-1">{analysis.fabricAnalysis?.material || 'Not visible in the photo, needs confirmation'}</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                  <p className="text-[14px] text-slate-500 font-medium">Weight: <span className="text-slate-700 font-semibold">{analysis.fabricAnalysis?.weight || '—'}</span></p>
                                  <p className="text-[14px] text-slate-500 font-medium">Weave: <span className="text-slate-700 font-semibold">{analysis.fabricAnalysis?.weaveType || '—'}</span></p>
                                  {analysis.fabricAnalysis?.finish && <p className="text-[14px] text-slate-500 font-medium">Finish: <span className="text-slate-700 font-semibold">{analysis.fabricAnalysis.finish}</span></p>}
                                  {analysis.fabricAnalysis?.shrinkage && <p className="text-[14px] text-slate-500 font-medium">Shrinkage: <span className="text-slate-700 font-semibold">{analysis.fabricAnalysis.shrinkage}</span></p>}
                                </div>
                                {analysis.fabricAnalysis?.frRating && analysis.fabricAnalysis.frRating !== 'None' && (
                                  <div className="mt-3 bg-orange-50 border border-orange-200 px-3 py-2 rounded-md">
                                    <span className="text-[12px] font-black uppercase tracking-widest text-orange-700">FR RATED: {analysis.fabricAnalysis.frRating}</span>
                                  </div>
                                )}
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                                <h4 className="text-[12.5px] font-black text-slate-400 uppercase mb-3 tracking-widest">{product ? 'Hardware' : 'Zippers & Hardware'}</h4>
                                <ul className="text-xs font-semibold text-slate-700 space-y-2">
                                  {analysis.bom?.hardware?.length ? analysis.bom.hardware.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2"><span className="w-1.5 h-1.5 mt-1 bg-slate-300 rounded-full shrink-0" /> {item}</li>
                                  )) : (
                                    <li className="text-amber-700 italic">Not visible in the photo, needs confirmation</li>
                                  )}
                                </ul>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                                <h4 className="text-[12.5px] font-black text-slate-400 uppercase mb-3 tracking-widest">Thread & Labels</h4>
                                <ul className="text-xs font-semibold text-slate-700 space-y-2">
                                  {analysis.bom?.thread?.map((item, i) => (
                                    <li key={`t-${i}`} className="flex items-start gap-2"><span className="w-1.5 h-1.5 mt-1 bg-violet-300 rounded-full shrink-0" /> {item}</li>
                                  ))}
                                  {analysis.bom?.labels?.map((item, i) => (
                                    <li key={`l-${i}`} className="flex items-start gap-2"><span className="w-1.5 h-1.5 mt-1 bg-slate-300 rounded-full shrink-0" /> {item}</li>
                                  ))}
                                  {(!analysis.bom?.thread?.length && !analysis.bom?.labels?.length) && (
                                    <li className="text-amber-700 italic">Not visible in the photo, needs confirmation</li>
                                  )}
                                </ul>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                                <h4 className="text-[12.5px] font-black text-slate-400 uppercase mb-3 tracking-widest">Folding & Packaging</h4>
                                {analysis.bom?.packaging && (analysis.bom.packaging.foldDescription || analysis.bom.packaging.polybagSize || analysis.bom.packaging.cartonSize) ? (
                                  <>
                                    <p className="text-xs font-semibold text-slate-700 mb-2">{analysis.bom.packaging.foldDescription}</p>
                                    <ul className="text-[14px] text-slate-500 font-medium space-y-1">
                                      <li>Polybag Size: {analysis.bom.packaging.polybagSize}</li>
                                      <li>Carton: {analysis.bom.packaging.cartonSize}</li>
                                    </ul>
                                  </>
                                ) : (
                                  <p className="text-xs text-amber-700 italic">Not given yet (a person fills in packaging)</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 4. CONSTRUCTION DETAILS */}
                          {analysis.construction.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                              <Layers size={14} className="text-violet-500" />
                              Construction and seams
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                              <table className="w-full text-left text-[13px]">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-3 py-2.5">SEAM LOCATION</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">SEAM TYPE</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">STITCH</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200 text-center">SPI (T/B)</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200 text-center">S/A</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">NOTES</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                  {analysis.construction.map((c, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-3 py-2.5 font-bold text-slate-900">{c.location}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100">{c.seamType}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 font-mono text-violet-700">{c.stitchType}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-center">{c.spiTop}/{c.spiBottom}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-center font-bold">{c.seamAllowance}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-slate-500 text-[12px]">{c.notes}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}

                          {/* Stitch reference */}
                          {analysis.stitchReference.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                              <Activity size={14} className="text-violet-500" />
                              Stitch reference
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                              <table className="w-full text-left text-[13px]">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-3 py-2.5 w-16 text-center">ISO CODE</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">STITCH NAME</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">MACHINE TYPE</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200 text-center w-16">SPI</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">USAGE ON GARMENT</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                  {analysis.stitchReference.map((s, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-3 py-2.5 text-center font-mono font-bold text-violet-700 bg-violet-50/50">{s.code}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 font-bold text-slate-900">{s.name}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-[12px] text-slate-600">{s.machineType}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-center font-bold">{s.defaultSpi}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-[12px] text-slate-500">{s.usage}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}

                          {/* 6. LABEL PLACEMENTS */}
                          {analysis.labelPlacements.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                              <Target size={14} className="text-violet-500" />
                              Labels
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                              <table className="w-full text-left text-[13px]">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-3 py-2.5">LABEL TYPE</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">PLACEMENT</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">ATTACHMENT</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200 text-center">SIZE</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">MATERIAL</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                  {analysis.labelPlacements.map((lp, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-3 py-2.5 font-bold text-slate-900">{lp.type}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-[12px]">{lp.location}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-[12px]">{lp.attachment}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-center font-mono">{lp.dimensions}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-[12px] text-slate-500">{lp.material}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}


                        </div>
                      </div>
                    </div>
                  )}

                  {/* Idle state — no analysis run yet */}
                  {analysis.status === 'idle' && (
                    <div className="bg-white border border-slate-100 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-20 h-20 rounded-full bg-violet-50 flex items-center justify-center text-violet-400">
                        <Camera size={36} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">Ready for AI Analysis</h3>
                      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                        {product
                          ? <>Click &ldquo;Run AI Scan&rdquo; above to read the client&apos;s uploaded product photos. The AI fills in the {template?.family.label.toLowerCase()} checklist, copies the printed labels and markings, and drafts the measurement points. Blank means it could not see it; a person checks every value on the Review tab.</>
                          : <>Click &ldquo;Run AI Scan&rdquo; above to process the client&apos;s uploaded garment photos. The AI engine will detect every component — snaps, zippers, seams, reflective striping — and auto-generate a production-ready CAD wireframe.</>}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        {(product ? ['Checklist', 'Labels and markings', 'Measurement points'] : ['Fabric Detection', 'Hardware ID', 'Seam Mapping', 'Wireframe Gen']).map(step => (
                          <div key={step} className="flex items-center gap-1.5 text-[12px] font-bold text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-300" />
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
}
