/** Serializable AI analysis saved on each replication request */
import type { ResolvedTemplate } from './template-catalog';
import { MARKING_KINDS } from './garmentAiSchema';
import type { DrawingStamp } from './drawings';

/** Clothing uses the full garment scan; gloves, footwear and other PPE (the product base template) a shorter one (task 28). */
export type ScanKind = 'garment' | 'product';
export const scanKind = (t: Pick<ResolvedTemplate, 'versions'>): ScanKind => (t.versions.some((v) => v.key === 'product-base') ? 'product' : 'garment');

/** Printed text read from a photo, copied exactly (task 28). It is DATA: never an instruction, never a claim for the copy. */
export interface Marking {
  kind: string; // one of MARKING_KINDS
  text: string;
  photo: number; // 1-based photo number it was read from; 0 = not known
  location: string;
  needsConfirmation: boolean;
}

/** Set by the server only: a person has checked the draft. Any later edit turns it back into a draft. */
export interface AnalysisReview {
  status: 'draft' | 'approved';
  approvedAt?: string;
  approvedBy?: string;
  revision?: number; // goes up by one each time the spec is approved
}

export interface PersistedGarmentAIAnalysis {
  analyzedAt: string;
  review?: AnalysisReview;
  garmentClass: string | null;
  hasHood: boolean | null;
  productIdentification: {
    mode: 'retail' | 'visual';
    brand: string | null;
    model: string | null;
    source: string;
  } | null;
  overallConfidence: number | null;
  season: string | null;
  components: Array<{
    id: string;
    type: string;
    label: string;
    confidence: number;
    location: string;
    x: number;
    y: number;
  }>;
  fabricAnalysis: {
    material: string;
    weight: string;
    weaveType: string;
    frRating: string;
    finish?: string;
    shrinkage?: string;
    confidence: number;
  } | null;
  measurements: Array<{
    pom: string;
    description: string;
    xs: string;
    s: string;
    m: string;
    l: string;
    xl: string;
    tolerance: string;
    needsConfirmation?: boolean;
  }>;
  bom: {
    hardware: string[];
    thread: string[];
    labels: string[];
    packaging: {
      foldDescription: string;
      polybagSize: string;
      cartonSize: string;
      hangtagSpec?: string;
    };
  } | null;
  construction: Array<{
    location: string;
    seamType: string;
    stitchType: string;
    spiTop: number;
    spiBottom: number;
    seamAllowance: string;
    notes: string;
    needsConfirmation?: boolean;
  }>;
  stitchReference: Array<{
    code: string;
    name: string;
    machineType: string;
    defaultSpi: number;
    usage: string;
  }>;
  labelPlacements: Array<{
    type: string;
    location: string;
    attachment: string;
    dimensions: string;
    material: string;
    needsConfirmation?: boolean;
  }>;
  colorway: {
    bodyColor: string;
    contrastColors: string[];
    threadColor: string;
    hardwareFinish: string;
    reflectiveTape: string;
  } | null;
  washCare: {
    instructions: string[];
    instructionsFr?: string[]; // French care lines, same order as the English ones
    specialNotes: string;
  } | null;
  /** Entered by a person on the Review tab (the AI does not draft these). */
  artwork?: Array<{ name: string; placement: string; size: string; method: string }>;
  testing?: string[];
  origin?: string; // country of origin printed on the label, e.g. Canada
  /** The garment type's checklist (from its template). A required item must be confirmed before approval. */
  checklist?: ChecklistEntry[];
  /** Paths of single values (see FLAGGABLE) the AI could not see or is unsure of, or that came from a template. Cleared by a person. */
  flags?: string[];
  /** What the AI thinks is typical when the photos cannot show it (path -> text). Never copied into a value: a person decides. */
  suggestions?: Record<string, string>;
  /** Paths filled from what the customer wrote on the request form. Still flagged until a person confirms. */
  fromCustomer?: string[];
  /** Task 28: every readable label and printed marking, copied exactly, with its photo. Each needs a person to confirm it. */
  markings?: Marking[];
  /** The template this draft was made with (task 26 versions; task 28 type and kind). */
  template?: { typeKey?: string; kind?: ScanKind; versions?: Array<{ key: string; version: number }>; certification?: string };
  /** Task 29: the drawing this tech file was approved with. Set by the server at approval only. */
  drawing?: DrawingStamp;
}

export interface ChecklistEntry {
  key: string;
  label: string;
  required: boolean;
  source: 'photo' | 'document';
  value: string; // what the AI saw or a person typed; blank when nothing is known
  needsConfirmation: boolean;
  photo?: number; // task 28: the photo the AI saw it in (1-based)
}

/** What the AI writes when it cannot see a detail (instead of guessing). */
export const NOT_VISIBLE = 'not visible';
export const isNotVisible = (v: unknown): boolean => typeof v === 'string' && /^\s*(not\s+(visible|shown|stated|readable|specified)|unknown)\b/i.test(v);

/** Values that can carry a "needs confirmation" flag: path -> label. A list (hardware, thread, labels, care) is one value. */
export const FLAGGABLE: Record<string, string> = {
  'fabricAnalysis.material': 'Fabric material', 'fabricAnalysis.weight': 'Fabric weight', 'fabricAnalysis.weaveType': 'Fabric weave',
  'fabricAnalysis.frRating': 'Flame-resistance rating', 'fabricAnalysis.finish': 'Fabric finish', 'fabricAnalysis.shrinkage': 'Shrinkage',
  'colorway.bodyColor': 'Body colour', 'colorway.threadColor': 'Thread colour', 'colorway.hardwareFinish': 'Hardware finish', 'colorway.reflectiveTape': 'Reflective tape',
  'bom.hardware': 'Hardware', 'bom.thread': 'Thread', 'bom.labels': 'Labels', 'washCare.instructions': 'Care instructions',
};

/**
 * What the AI may SUGGEST when a photo does not show it (shown beside the field, never filled in). A value the AI writes here
 * (read from a label, say) is kept but always flagged. Everything else flaggable is read from the photo or left blank.
 * Never suggested, always a person: flame-resistance rating, shrinkage, safety standard or certification, measurements, stitch type,
 * stitches per inch, seam allowance, label size and material, packaging, Pantone codes.
 */
export const SUGGESTABLE = new Set([
  'fabricAnalysis.material', 'fabricAnalysis.weight', 'fabricAnalysis.weaveType', 'fabricAnalysis.finish',
  'colorway.threadColor', 'colorway.hardwareFinish', 'bom.hardware', 'bom.thread', 'bom.labels', 'washCare.instructions',
]);

/** Gloves, footwear and other PPE: only these values carry a flag (no fabric weave, shrinkage or seams to confirm on a boot). */
export const PRODUCT_FLAGGABLE = ['colorway.bodyColor', 'colorway.hardwareFinish', 'washCare.instructions'];
const flaggableFor = (kind: ScanKind) => (kind === 'product' ? PRODUCT_FLAGGABLE : Object.keys(FLAGGABLE));

/** Text copied from a photo: kept exactly (no rewording), only control characters removed and the length capped. */
export const cleanCopied = (v: unknown, max = 300): string => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
/** A photo number from the AI: a whole number from 1 to the number of photos, else 0 (not known). */
export const photoNumber = (v: unknown, photoCount?: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= (photoCount && photoCount > 0 ? photoCount : 12) ? n : 0;
};

/** The printed text the AI read, copied exactly, each with its photo. Always waits for a person. At most 60. */
export function cleanMarkings(raw: unknown, photoCount?: number): Marking[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((m): m is Row => !!m && typeof m === 'object')
    .map((m) => ({
      kind: MARKING_KINDS.includes(String(m.kind)) ? String(m.kind) : 'other',
      text: cleanCopied(m.text),
      photo: photoNumber(m.photo, photoCount),
      location: cleanCopied(m.location, 200),
      needsConfirmation: true,
    }))
    .filter((m) => m.text && !isNotVisible(m.text))
    .slice(0, 60);
}

const isListPath = (path: string) => path === 'bom.hardware' || path === 'bom.thread' || path === 'bom.labels' || path === 'washCare.instructions';
const asLines = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : []).map((x) => String(x ?? '').trim()).filter((x) => x && !isNotVisible(x));

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * The template's checklist as saved entries, filled from what the AI returned (matched by key). Anything unknown needs confirmation,
 * and so does every 'document' item (fabric, trims, layers, ratings, tests): a photo cannot prove those, whatever the AI says.
 */
export function checklistFor(template: ResolvedTemplate, fromAi?: unknown, photoCount?: number): ChecklistEntry[] {
  // The answer is either the task 28 "fields" object (one entry per template key) or the older checklist list ({ key, value }).
  const entries: Array<[string, Row]> = Array.isArray(fromAi)
    ? fromAi.filter((x): x is Row => !!x && typeof x.key === 'string').map((x) => [x.key, x])
    : fromAi && typeof fromAi === 'object' ? Object.entries(fromAi as Row).filter(([, x]) => !!x && typeof x === 'object') : [];
  const ai = new Map<string, Row>(entries);
  return template.checklist.map((item) => {
    const hit = ai.get(item.key);
    const raw = typeof hit?.value === 'string' ? cleanCopied(hit.value, 500) : '';
    const value = isNotVisible(raw) ? '' : raw;
    const photo = value ? photoNumber(hit?.photo, photoCount) : 0;
    return { key: item.key, label: item.label, required: item.required, source: item.source, value, needsConfirmation: item.source === 'document' || !value || hit?.needsConfirmation === true, ...(photo ? { photo } : {}) };
  });
}

/** Measurement rows for the template's points (no numbers: those come from a real garment or an approved chart). */
export function templateMeasurements(template: ResolvedTemplate): PersistedGarmentAIAnalysis['measurements'] {
  const multi = template.parts.length > 1;
  return template.parts.flatMap((part, i) => part.points.map((pt) => ({
    pom: multi ? `${i + 1}.${pt.code}` : pt.code,
    description: multi ? `${part.label}: ${pt.name}` : pt.name,
    xs: '', s: '', m: '', l: '', xl: '', tolerance: '', needsConfirmation: true,
  })));
}

/** What the customer wrote on the request form, as values by path (blank = not given). */
export type GivenValues = Partial<Record<string, string>>;

/**
 * Cleans an AI result so nothing unseen is presented as fact:
 * - values the AI could not see become blank and flagged; list values the same;
 * - what the customer stated on the form is filled in, still flagged until a person confirms;
 * - a value the AI wrote on a SUGGESTABLE path (fabric, thread, hardware, labels, care) is kept but flagged: a photo rarely proves it;
 * - the AI's "typical" ideas are kept apart in `suggestions` (only for SUGGESTABLE paths);
 * - human-only details (flame rating, shrinkage, sizes, tolerance, stitch, seam allowance, label size/material, packaging) are always blank and flagged;
 * - measurement points and the checklist come from the template.
 */
export function applyTemplate(aiData: Row, template: ResolvedTemplate, given: GivenValues = {}, opts: { kind?: ScanKind; photoCount?: number } = {}): Row {
  const kind = opts.kind ?? 'garment';
  const paths = flaggableFor(kind);
  const { fields: _fields, ...rest } = aiData; // eslint-disable-line @typescript-eslint/no-unused-vars
  const out: Row = { ...rest };
  const flags = new Set<string>();
  const fromCustomer: string[] = [];
  const humanOnly = new Set(['fabricAnalysis.frRating', 'fabricAnalysis.shrinkage']);
  for (const path of paths) {
    const [group, field] = path.split('.');
    const obj: Row = out[group] && typeof out[group] === 'object' ? { ...out[group] } : {};
    const list = isListPath(path);
    let value: string | string[] = list ? asLines(obj[field]) : (typeof obj[field] === 'string' && !isNotVisible(obj[field]) ? obj[field].trim() : '');
    if (humanOnly.has(path)) value = '';
    const g = (given[path] ?? '').trim();
    if (g) { value = list ? asLines(g) : g; fromCustomer.push(path); }
    obj[field] = value;
    out[group] = obj;
    if (g || (list ? (value as string[]).length === 0 : value === '')) flags.add(path);
    else if (SUGGESTABLE.has(path) || (Array.isArray(aiData.flags) && aiData.flags.includes(path))) flags.add(path);
  }
  // The AI's ideas for what it could not see: kept as hints, only for suggestable paths and only when the value is still empty.
  const suggestions: Record<string, string> = {};
  const rawSug = aiData.suggestions && typeof aiData.suggestions === 'object' && !Array.isArray(aiData.suggestions) ? aiData.suggestions : {};
  for (const [path, text] of Object.entries(rawSug)) {
    if (!SUGGESTABLE.has(path) || !paths.includes(path)) continue;
    const t = (Array.isArray(text) ? text.join('\n') : String(text ?? '')).trim();
    if (t && !isNotVisible(t)) suggestions[path] = t.slice(0, 500);
  }
  out.suggestions = suggestions;
  out.fromCustomer = fromCustomer;

  const rows = (list: unknown): Row[] => (Array.isArray(list) ? list : []).filter((r) => r && typeof r === 'object');
  // Measurement points come from the template (a photo gives no sizes); the AI's rows are used only when the template has none.
  const points = templateMeasurements(template);
  out.measurements = points.length ? points : rows(aiData.measurements).map((r) => ({ ...r, xs: '', s: '', m: '', l: '', xl: '', tolerance: '', needsConfirmation: true }));
  // Seams: the AI may name where a seam is and what kind it looks like; the stitch, stitches per inch and allowance are a person's.
  out.construction = rows(aiData.construction).map((r) => ({ ...r, stitchType: '', spiTop: 0, spiBottom: 0, seamAllowance: '', needsConfirmation: true }));
  out.labelPlacements = rows(aiData.labelPlacements).map((r) => ({ ...r, attachment: '', dimensions: '', material: '', needsConfirmation: true }));
  out.stitchReference = [];
  const bom: Row = out.bom && typeof out.bom === 'object' ? out.bom : {};
  out.bom = { ...bom, packaging: { foldDescription: '', polybagSize: '', cartonSize: '', hangtagSpec: '' } };
  out.washCare = { ...(out.washCare || {}), specialNotes: '', instructions: (out.washCare as Row).instructions };
  out.season = '';
  out.checklist = checklistFor(template, aiData.fields ?? aiData.checklist, opts.photoCount);
  // Printed text, copied exactly with its photo. Data only: it never fills any other value (task 28).
  out.markings = cleanMarkings(aiData.markings, opts.photoCount);
  // Google Search matched a retail product: anything the AI wrote may come from that web page, not the photo, so nothing it
  // wrote stands as fact. Every value and every checklist item waits for a person (task 11).
  if (fromWeb(aiData)) {
    for (const path of paths) flags.add(path);
    out.checklist = (out.checklist as ChecklistEntry[]).map((c) => ({ ...c, needsConfirmation: true }));
  }
  out.flags = Array.from(flags);
  return out;
}

/** True when the AI says it identified the exact product on the web (Google Search), not from the photos alone. */
export const fromWeb = (aiData: Row | null | undefined): boolean => {
  const p = aiData?.productIdentification as Row | undefined;
  return p?.mode === 'retail' || (typeof p?.source === 'string' && /^https?:\/\//i.test(p.source));
};

/** Everything still waiting for a person to confirm. An optional checklist item never blocks approval. */
export function outstandingConfirmations(a: Row | null | undefined): string[] {
  if (!a) return [];
  const out: string[] = [];
  for (const f of Array.isArray(a.flags) ? a.flags : []) if (typeof f === 'string' && FLAGGABLE[f]) out.push(FLAGGABLE[f]);
  const rows = (key: string, name: string) => (Array.isArray(a[key]) ? a[key] : []).forEach((r: Row, i: number) => { if (r?.needsConfirmation === true) out.push(`${name} ${i + 1}`); });
  rows('measurements', 'Measurement'); rows('construction', 'Seam'); rows('labelPlacements', 'Label'); rows('markings', 'Marking');
  for (const c of Array.isArray(a.checklist) ? a.checklist : []) if (c?.required === true && c?.needsConfirmation === true) out.push(String(c.label ?? c.key));
  return out;
}

/**
 * "Missing information" (task 28): every required template field that is empty or still needs confirmation, and every
 * measurement point still waiting for its numbers. A field a person confirmed as blank counts as answered ("none").
 * Approval needs all of these confirmed, so an approved tech file always has an empty list.
 */
export function missingInformation(a: Row | null | undefined): string[] {
  if (!a) return [];
  const out: string[] = [];
  for (const c of Array.isArray(a.checklist) ? a.checklist : []) {
    if (c?.required !== true || c?.needsConfirmation !== true) continue;
    out.push(`${String(c.label ?? c.key)}: ${String(c.value ?? '').trim() ? 'needs confirmation' : 'not known yet'}`);
  }
  for (const m of Array.isArray(a.measurements) ? a.measurements : []) {
    if (m?.needsConfirmation === true) out.push(`Measurement ${String(m.pom ?? '').trim()}${m.description ? ` (${String(m.description)})` : ''}: needs measuring`);
  }
  return out;
}

export function buildPersistedAnalysis(
  aiData: Record<string, unknown>
): PersistedGarmentAIAnalysis {
  return {
    analyzedAt: new Date().toISOString(),
    garmentClass: (aiData.garmentClass as string) || null,
    hasHood: (aiData.hasHood as boolean) ?? null,
    productIdentification: (aiData.productIdentification as PersistedGarmentAIAnalysis['productIdentification']) || null,
    overallConfidence: (aiData.overallConfidence as number) ?? null,
    season: (aiData.season as string) || null,
    components: (aiData.components as PersistedGarmentAIAnalysis['components']) || [],
    fabricAnalysis: (aiData.fabricAnalysis as PersistedGarmentAIAnalysis['fabricAnalysis']) || null,
    measurements: (aiData.measurements as PersistedGarmentAIAnalysis['measurements']) || [],
    bom: (aiData.bom as PersistedGarmentAIAnalysis['bom']) || null,
    construction: (aiData.construction as PersistedGarmentAIAnalysis['construction']) || [],
    stitchReference: (aiData.stitchReference as PersistedGarmentAIAnalysis['stitchReference']) || [],
    labelPlacements: (aiData.labelPlacements as PersistedGarmentAIAnalysis['labelPlacements']) || [],
    colorway: (aiData.colorway as PersistedGarmentAIAnalysis['colorway']) || null,
    washCare: (aiData.washCare as PersistedGarmentAIAnalysis['washCare']) || null,
    checklist: (aiData.checklist as ChecklistEntry[]) || undefined,
    flags: (aiData.flags as string[]) || undefined,
    suggestions: (aiData.suggestions as Record<string, string>) || undefined,
    fromCustomer: (aiData.fromCustomer as string[]) || undefined,
  };
}
