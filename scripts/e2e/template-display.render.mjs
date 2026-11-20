// Shared by template-display.make-golden.mjs (once, before the change) and template-display.test.mjs: the jacket cases and
// how each screen and the PDF are drawn, so the golden files and the test draw exactly the same thing.
// Run under the .tsx loader: node --no-warnings --import ./scripts/e2e/tsx-resolve.mjs <script>
import { env as E2E_ENV } from './env.mjs'; // the test project only (guarded), never Development
import fs from 'fs';
import React from 'react';

// The clock is frozen (2026-11-20, approved): "today" is 15 March 2030, 12:00 local time, for every `new Date()` and
// `Date.now()` in the code under test, so it can never fall on a fixed test date (NOW below, or 18 November 2026, the day the
// golden files were made). Dates given to the constructor are untouched. Installed before the app's modules load.
export const FROZEN_TODAY = new Date(2030, 2, 15, 12, 0, 0);
const RealDate = Date;
const FROZEN_MS = FROZEN_TODAY.getTime();
class FrozenDate extends RealDate {
  constructor(...args) { if (args.length === 0) super(FROZEN_MS); else super(...args); }
  static now() { return FROZEN_MS; }
}
globalThis.Date = FrozenDate;

// The browser Supabase client is created when its module loads: give it the public values (never a secret).
const env = E2E_ENV;
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const { renderToStaticMarkup } = await import('react-dom/server');
export const ReviewTab = (await import('../../src/app/admin/replication/ReviewTab.tsx')).default;
export const View = await import('../../src/app/admin/replication/AnalysisTabView.tsx');
export const NewRequestDialog = (await import('../../src/app/admin/replication/NewRequestDialog.tsx')).default;
export const P = await import('../../src/lib/TechPackPDF.tsx');
export const C = await import('../../src/lib/template-catalog.ts');
export const A = await import('../../src/lib/garmentAiAnalysis.ts');
export const K = await import('../../src/lib/checklist-confirm.ts');
const { normalizeAnalysis } = await import('../../src/lib/analysis-shape.ts');
const { confirmAll } = await import('./confirm.mjs');

export const NOW = '2026-11-18T10:00:00.000Z';
const noop = () => {};

/** A full jacket analysis the way the scan saves it: AI values, nothing confirmed by a person. */
export function jacketAnalysis(typeKey = 'jacket') {
  const t = C.resolveTemplate(typeKey, null, C.BUILT_IN_CATALOG);
  const vals = ['22', '23', '24', '25', '26'];
  const checklist = A.checklistFor(t).map((c, i) => (c.source === 'photo' && i % 2 === 0 ? { ...c, value: `ZZ ${c.key}`, readFromPhoto: true } : c));
  return {
    analyzedAt: NOW, garmentClass: 'Insulated work jacket', overallConfidence: 88, season: 'FW26', hasHood: true,
    components: [{ id: 'c1', type: 'zipper', label: 'Centre front zipper', location: 'front', confidence: 90 }, { id: 'c2', type: 'pocket', label: 'Chest pocket', location: "wearer's left chest", confidence: 80 }],
    measurements: A.templateMeasurements(t).map((m) => ({ ...m, xs: vals[0], s: vals[1], m: vals[2], l: vals[3], xl: vals[4], tolerance: '0.5' })),
    construction: [{ location: 'Side seam', seamType: 'Safety stitch', stitchType: '516', spiTop: 10, spiBottom: 10, seamAllowance: '3/8"', notes: '' }],
    stitchReference: [{ code: '301', name: 'Lockstitch', machineType: 'Single needle', defaultSpi: 10, usage: 'Topstitch' }],
    labelPlacements: [{ type: 'Main label', location: 'Inside back neck', attachment: 'Sewn', dimensions: '2 x 1 in', material: 'Woven' }],
    bom: { hardware: ['#5 coil zipper'], thread: ['Tex 40 poly'], labels: ['Woven main label'], packaging: { foldDescription: '', polybagSize: '', cartonSize: '', hangtagSpec: '' } },
    colorway: { bodyColor: 'Navy', contrastColors: ['Black'], threadColor: 'Navy', hardwareFinish: 'Black matte', reflectiveTape: 'N/A' },
    fabricAnalysis: { material: 'Polyester', weight: '200 gsm', weaveType: 'Twill', frRating: 'None', finish: 'DWR', shrinkage: '' },
    washCare: { instructions: ['Machine wash cold', 'Do not bleach'], instructionsFr: [], specialNotes: '' },
    checklist, markings: [], testing: ['Colourfastness to laundering: AATCC 61'], flags: ['colorway.threadColor'], origin: 'Canada',
  };
}

const confirmedAll = (a) => K.settleConfirmations(a, null, { confirmations: confirmAll(a), actorEmail: 'zz-admin@example.com', now: NOW });
const emptyValues = (a) => ({ ...a, measurements: a.measurements.map((m) => ({ ...m, xs: '', s: '', m: '', l: '', xl: '', tolerance: '' })) });

/** The request around an analysis. `garment`: 'received' | 'expected' | 'photos'. */
export function makeRep(typeKey, analysis, { garment = 'received', specs = {} } = {}) {
  return {
    id: `zz-${typeKey}`, requestCode: 'RQ-ZZ', clientName: 'ZZ Client', productName: 'ZZ product', garmentType: typeKey, status: 'received',
    submissionDate: '2026-11-17', images: [], imagePaths: [], imageLabels: [], messages: [],
    specs: { safetyRating: '', coreMaterial: 'Polyester', liningMaterial: 'Quilted', fabricWeight: '200 gsm', zippers: '#5 coil', buttonsSnaps: 'Snaps at storm flap',
      reflectiveStriping: '', pocketsCount: '4', seamConstruction: 'Safety stitch', specialInstructions: 'ZZ note', annotations: [],
      ...(garment === 'received' ? { garmentPosted: true, inboundReceivedAt: NOW } : garment === 'expected' ? { garmentPosted: true } : {}), ...specs },
    aiAnalysis: analysis,
  };
}

/** The jacket cases (saved with the golden files, so the test draws exactly the same input). */
export function jacketCases() {
  const ai = jacketAnalysis();
  return {
    ai,
    empty: emptyValues(ai),
    confirmed: confirmedAll(ai),
    approved: { ...confirmedAll(ai), review: { status: 'approved', revision: 1, approvedBy: 'zz-admin@example.com', approvedAt: NOW } },
  };
}

const idle = () => ({ status: 'idle', currentStep: 0, totalSteps: View.AI_SCAN_STEPS.length, stepLabel: '', progress: 0, components: [], detectedSoFar: [], fabricAnalysis: null, wireframeGenerated: false, garmentClass: null, overallConfidence: null, season: null, measurements: [], bom: null, construction: [], stitchReference: [], labelPlacements: [], colorway: null, washCare: null });

/** The day the golden files were made (template-display.make-golden.mjs ran on 18 November 2026, local time). */
export const GOLDEN_MADE_ON = new Date(2026, 10, 18);
/** A date in the three forms the screens and the PDF print. */
export const dateForms = (d) => [d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }), d.toLocaleDateString()];

/** "Today" (the frozen day: the AI tab prints the current date) masked as [TODAY].
 *  18 November 2026 is masked too, and must stay: the golden files were made on that day, which is also the day of the fixed
 *  test date NOW, so the golden files hold [TODAY] where NOW's date is printed (the PDF and the Review tab). The frozen clock
 *  keeps "today" away from NOW; template-display.check.mjs checks the unmasked output to prove the two are never mixed up. */
export function mask(text) {
  const forms = [...dateForms(new Date()), ...dateForms(GOLDEN_MADE_ON)];
  return forms.reduce((s, f) => s.split(f).join('[TODAY]'), text);
}
/** One tag per line, so a difference is one line. */
export const lines = (html) => mask(html).replace(/></g, '>\n<');

/** The AI analysis tab, drawn the way the page draws it. */
export function drawAiTab(rep, extra = {}) {
  const getAIAnalysis = rep.aiAnalysis ? () => View.analysisResultFromSaved(normalizeAnalysis(rep.aiAnalysis) ?? {}) : idle;
  return renderToStaticMarkup(React.createElement(View.default, {
    selectedRep: { ...rep, aiAnalysis: normalizeAnalysis(rep.aiAnalysis) }, getAIAnalysis, isAdmin: true, building: false, handleDownload: noop, handleStartAIAnalysis: noop,
    setActiveTab: noop, setError: noop, setReplications: noop, setSelectedRep: noop, ...extra,
  }));
}
export const drawReview = (rep) => renderToStaticMarkup(React.createElement(ReviewTab, { rep, onSave: async () => true }));
export const drawNewRequest = () => renderToStaticMarkup(React.createElement(NewRequestDialog, { role: 'admin', onClose: noop, onCreated: noop }));

/** Every text the PDF prints, in order (one line per Text element). Function components are expanded by calling them. */
export function pdfTexts(rep, template) { return mask(pdfTextsRaw(rep, template)); }
/** The same, unmasked (for the date checks). */
export function pdfTextsRaw(rep, template) {
  const d = P.buildTechFileData(rep, [], undefined, template);
  const out = [];
  const flat = (el) => (el == null || typeof el === 'boolean' ? '' : typeof el === 'string' || typeof el === 'number' ? String(el) : Array.isArray(el) ? el.map(flat).join('') : el.props ? flat(el.props.children) : '');
  const walk = (el) => {
    if (el == null || typeof el === 'boolean') return;
    if (typeof el === 'string' || typeof el === 'number') { out.push(String(el)); return; }
    if (Array.isArray(el)) { el.forEach(walk); return; }
    if (typeof el.type === 'function') { walk(el.type(el.props)); return; }
    if (el.type === 'TEXT') { const t = flat(el); if (t) out.push(t); return; }
    if (el.props) walk(el.props.children);
  };
  walk(React.createElement(P.TechPackPDF, { d }));
  return out.join('\n');
}

/** Everything the golden files hold, for the jacket. `panel(rep)` draws the Client Spec Review panel. */
export async function renderAll({ panel, aiExtra = () => ({}), cases = jacketCases() }) {
  const c = cases;
  const t = C.resolveTemplate('jacket', null, C.BUILT_IN_CATALOG);
  const scanning = { ...idle(), status: 'scanning', currentStep: 2, stepLabel: View.AI_SCAN_STEPS[2].label, progress: 30 };
  const rep = (a, o) => makeRep('jacket', a, o);
  return {
    'ai-tab-ai-values': lines(drawAiTab(rep(c.ai), aiExtra(rep(c.ai)))),
    'ai-tab-empty-values': lines(drawAiTab(rep(c.empty), aiExtra(rep(c.empty)))),
    'ai-tab-all-confirmed': lines(drawAiTab(rep(c.confirmed), aiExtra(rep(c.confirmed)))),
    'ai-tab-not-scanned': lines(drawAiTab(rep(null), aiExtra(rep(null)))),
    'ai-tab-scanning': lines(renderToStaticMarkup(React.createElement(View.default, { selectedRep: rep(null), getAIAnalysis: () => scanning, isAdmin: true, building: false, handleDownload: noop, handleStartAIAnalysis: noop, setActiveTab: noop, setError: noop, setReplications: noop, setSelectedRep: noop, ...aiExtra(rep(null)) }))),
    'review-tab': lines(drawReview(rep(c.ai))),
    'review-tab-approved': lines(drawReview(rep(c.approved))),
    'panel-received': lines(renderToStaticMarkup(panel(rep(c.ai, { garment: 'received' })))),
    'panel-expected': lines(renderToStaticMarkup(panel(rep(c.ai, { garment: 'expected' })))),
    'panel-photos-only': lines(renderToStaticMarkup(panel(rep(c.ai, { garment: 'photos' })))),
    'new-request': lines(drawNewRequest()),
    'pdf-draft-ai-values': pdfTexts(rep(c.ai), t),
    'pdf-draft-empty-values': pdfTexts(rep(c.empty), t),
    'pdf-draft-all-confirmed': pdfTexts(rep(c.confirmed), t),
    'pdf-approved': pdfTexts(rep(c.approved), t),
  };
}
