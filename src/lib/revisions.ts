// Task 30: tech file revisions. A revision is a full copy of the tech file at one save (the names, the product type, the
// admin spec fields and the AI/edited analysis). This file turns two copies into a readable list of what changed, labels a
// revision ("Rev 2", "Draft after Rev 2") and holds the size columns (gloves and footwear get their own sizes).
// Pure and client-safe, relative imports only (the tests load it directly).
import { garmentTypeLabel } from './garment-types-data';
import { FLAGGABLE } from './garmentAiAnalysis';
import { sizeLabels, sizeNote, SIZE_KEYS } from './size-run';
export { sizeLabels, sizeNote, defaultSizeRun, SIZE_KEYS, ALPHA_SIZES, SHOE_WIDTHS, type SizeRun } from './size-run';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface TechFileSnapshot { clientName: string; productName: string; garmentType: string; specs: Row; analysis: Row | null }
/** Spec keys that are about the parcel or the type confirmation, not the tech file: never part of a revision. */
export const NOT_TECH_FILE_SPECS = ['typeCheck', 'garmentPosted', 'inboundReceivedAt'];

export function techFileSnapshot(r: { clientName?: unknown; productName?: unknown; garmentType?: unknown; specs?: unknown; analysis?: unknown }): TechFileSnapshot {
  const specs = r.specs && typeof r.specs === 'object' && !Array.isArray(r.specs) ? { ...(r.specs as Row) } : {};
  for (const k of NOT_TECH_FILE_SPECS) delete specs[k];
  return {
    clientName: String(r.clientName ?? ''), productName: String(r.productName ?? ''), garmentType: String(r.garmentType ?? ''),
    specs, analysis: r.analysis && typeof r.analysis === 'object' ? (r.analysis as Row) : null,
  };
}
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Row).sort(([a], [b]) => a.localeCompare(b))) : x));
/** The tech file's content, without what only the server sets (review, drawing stamp, scan time): equal keys = no change. */
export function contentKey(s: TechFileSnapshot): string {
  const a = s.analysis ? (({ review: _r, drawing: _d, analyzedAt: _t, ...rest }) => rest)(s.analysis) : null; // eslint-disable-line @typescript-eslint/no-unused-vars
  return stable({ c: s.clientName, p: s.productName, g: s.garmentType, s: s.specs, a });
}

// ---- what changed ----------------------------------------------------------------------------------------------------------
const SPEC_LABELS: Record<string, string> = {
  coreMaterial: 'Base material', fabricWeight: 'Fabric weight', liningMaterial: 'Lining', zippers: 'Zippers', buttonsSnaps: 'Buttons / snaps',
  safetyRating: 'Safety rating', reflectiveStriping: 'Reflective striping', pocketsCount: 'Pockets', seamConstruction: 'Seam construction',
  specialInstructions: 'Special instructions', careText: 'Care text from the customer',
};
const show = (v: unknown): string => {
  const s = Array.isArray(v) ? v.map((x) => String(x ?? '')).filter(Boolean).join('; ') : v === null || v === undefined ? '' : String(v);
  const t = s.replace(/\s+/g, ' ').trim();
  return t ? `"${t.length > 80 ? `${t.slice(0, 78)}…` : t}"` : 'blank';
};
const same = (a: unknown, b: unknown) => stable(a ?? null) === stable(b ?? null);

/**
 * A readable list of what changed between two copies of a tech file ("Measurement A (Chest), M: blank → "24"").
 * `prev` null = the first revision. At most 300 lines.
 */
export function describeChanges(prev: TechFileSnapshot | null, next: TechFileSnapshot): string[] {
  const out: string[] = [];
  const add = (s: string) => { if (out.length < 300) out.push(s); };
  if (!prev) return [next.analysis ? `First recorded revision (${(next.analysis.measurements || []).length} measurements, ${(next.analysis.checklist || []).length} checklist items)` : 'First recorded revision'];
  if (prev.productName !== next.productName) add(`Product name: ${show(prev.productName)} → ${show(next.productName)}`);
  if (prev.clientName !== next.clientName) add(`Customer: ${show(prev.clientName)} → ${show(next.clientName)}`);
  if (prev.garmentType !== next.garmentType) add(`Product type: ${garmentTypeLabel(prev.garmentType)} → ${garmentTypeLabel(next.garmentType)}`);
  for (const k of Array.from(new Set([...Object.keys(prev.specs), ...Object.keys(next.specs)]))) {
    if (k === 'annotations') { if (!same(prev.specs[k], next.specs[k])) add('Spec annotations changed'); continue; }
    if (!same(prev.specs[k] ?? '', next.specs[k] ?? '')) add(`${SPEC_LABELS[k] ?? k}: ${show(prev.specs[k])} → ${show(next.specs[k])}`);
  }
  const A = prev.analysis, B = next.analysis;
  if (!A && B) { add(`Tech file drafted (${(B.measurements || []).length} measurements, ${(B.checklist || []).length} checklist items)`); return out; }
  if (A && !B) { add('Tech file removed'); return out; }
  if (!A || !B) return out;
  const ra = A.review?.status, rb = B.review?.status;
  if (ra !== 'approved' && rb === 'approved') add(`Approved as Rev ${B.review?.revision ?? ''}`.trim());
  if (ra === 'approved' && rb !== 'approved') add(`New draft started from Rev ${A.review?.revision ?? ''}`.trim());
  // Single values (fabric, colours, care...) and their confirmations.
  for (const path of Object.keys(FLAGGABLE)) {
    const [g, f] = path.split('.');
    const va = A[g]?.[f], vb = B[g]?.[f];
    if (!same(va ?? '', vb ?? '')) add(`${FLAGGABLE[path]}: ${show(va)} → ${show(vb)}`);
    const fa = (A.flags || []).includes(path), fb = (B.flags || []).includes(path);
    if (fa && !fb) add(`${FLAGGABLE[path]}: confirmed`);
    if (!fa && fb) add(`${FLAGGABLE[path]}: needs confirmation again`);
  }
  for (const [k, label] of [['contrastColors', 'Contrast colours']] as const) if (!same(A.colorway?.[k], B.colorway?.[k])) add(`${label}: ${show(A.colorway?.[k])} → ${show(B.colorway?.[k])}`);
  for (const [k, label] of [['instructionsFr', 'French care text'], ['specialNotes', 'Care notes']] as const) if (!same(A.washCare?.[k] ?? '', B.washCare?.[k] ?? '')) add(`${label}: ${show(A.washCare?.[k])} → ${show(B.washCare?.[k])}`);
  for (const [k, label] of [['origin', 'Country of origin'], ['garmentClass', 'Product description'], ['testing', 'Testing']] as const) if (!same(A[k] ?? '', B[k] ?? '')) add(`${label}: ${show(A[k])} → ${show(B[k])}`);
  if (!same(A.bom?.packaging, B.bom?.packaging)) add('Packaging changed');
  if (!same(A.artwork, B.artwork)) add('Artwork changed');
  // Size columns
  const la = sizeLabels(A), lb = sizeLabels(B);
  if (!same(la, lb)) add(`Size columns: ${la.join(', ')} → ${lb.join(', ')}`);
  if (sizeNote(A) !== sizeNote(B) && (A.sizeRun?.system === 'shoe' || B.sizeRun?.system === 'shoe')) add(`Sizes: ${show(sizeNote(A))} → ${show(sizeNote(B))}`);
  // Measurements, by point code
  const byPom = (a: Row) => new Map<string, Row>((a.measurements || []).map((m: Row, i: number) => [String(m.pom || `row ${i + 1}`), m]));
  const ma = byPom(A), mb = byPom(B);
  for (const [pom, m] of mb) {
    const o = ma.get(pom);
    const name = `Measurement ${pom}${m.description ? ` (${m.description})` : ''}`;
    if (!o) { add(`${name}: added`); continue; }
    if (o.description !== m.description) add(`Measurement ${pom}: description ${show(o.description)} → ${show(m.description)}`);
    SIZE_KEYS.forEach((k, i) => { if (!same(o[k] ?? '', m[k] ?? '')) add(`${name}, ${lb[i]}: ${show(o[k])} → ${show(m[k])}`); });
    if (!same(o.tolerance ?? '', m.tolerance ?? '')) add(`${name}, tolerance: ${show(o.tolerance)} → ${show(m.tolerance)}`);
    if (o.needsConfirmation === true && m.needsConfirmation !== true) add(`${name}: confirmed`);
  }
  for (const [pom, o] of ma) if (!mb.has(pom)) add(`Measurement ${pom}${o.description ? ` (${o.description})` : ''}: removed`);
  // Checklist, by item
  const ca = new Map<string, Row>((A.checklist || []).map((c: Row) => [c.key, c]));
  for (const c of B.checklist || []) {
    const o = ca.get(c.key);
    if (!o) { add(`Checklist ${c.label}: added`); continue; }
    if (!same(o.value ?? '', c.value ?? '')) add(`Checklist ${c.label}: ${show(o.value)} → ${show(c.value)}`);
    if (o.needsConfirmation && !c.needsConfirmation) add(`Checklist ${c.label}: confirmed`);
    if (!o.needsConfirmation && c.needsConfirmation) add(`Checklist ${c.label}: needs confirmation again`);
  }
  // Markings, seams, labels
  const mk = (a: Row) => (a.markings || []).map((m: Row) => `${m.kind}: ${m.text}`);
  const mka = mk(A), mkb = mk(B);
  for (const t of mkb) if (!mka.includes(t)) add(`Marking added: ${show(t)}`);
  for (const t of mka) if (!mkb.includes(t)) add(`Marking removed: ${show(t)}`);
  const conf = (a: Row) => (a.markings || []).filter((m: Row) => !m.needsConfirmation).length;
  if (conf(B) > conf(A)) add(`${conf(B) - conf(A)} marking${conf(B) - conf(A) > 1 ? 's' : ''} confirmed`);
  for (const [k, label] of [['construction', 'Seam'], ['labelPlacements', 'Label placement']] as const) {
    const xa: Row[] = A[k] || [], xb: Row[] = B[k] || [];
    for (let i = 0; i < Math.max(xa.length, xb.length); i++) {
      if (!xa[i]) add(`${label} ${i + 1}: added`);
      else if (!xb[i]) add(`${label} ${i + 1}: removed`);
      else if (!same(xa[i], xb[i])) add(`${label} ${i + 1} changed`);
    }
  }
  return out;
}

/** "Rev 2" for an approved revision; "Draft (after Rev 2)" or "Draft" for the saves in between. */
export const revisionLabel = (r: { status: string; revision: number }) => (r.status === 'approved' ? `Rev ${r.revision}` : r.revision ? `Draft (after Rev ${r.revision})` : 'Draft');
