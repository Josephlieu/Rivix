// What the screens and the PDF say for a request's template (2026-11-18): gloves, footwear and Other PPE showed jacket fields,
// XS to XL sizes, zipper photos and clothing fabric tests. One set of rules for the Client Spec Review panel, the New request
// form, the AI analysis tab, the Review tab and the PDF.
//
// - "clothing" = the template uses the clothing base ('garment-base'); every other base (the product base of the Gloves,
//   Footwear and Other PPE categories) is a "product". Without a template (it could not be read) it is clothing, as before.
// - Clothing output stays as it was, except where it said something untrue (the measurement note, see measureState).
// - Labels and layout only: values are never invented; an empty value stays "Not filled in".
// Pure, relative imports only (the e2e tests load it directly).
import { protectiveText, viewsText, type ResolvedTemplate } from './template-catalog';
import { isStamped, itemState, type ItemState } from './checklist-confirm';
import { sizeLabels, sizeNote, withDefaultSizes } from './size-run';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type TemplateKind = 'clothing' | 'product';
/** What the display needs from a template (a full ResolvedTemplate fits). */
export type DisplayTemplate = Pick<ResolvedTemplate, 'family' | 'checklist' | 'versions' | 'protective' | 'standardCandidates'>;

export const CLOTHING_BASE = 'garment-base';
/** Clothing or a product (glove, footwear, PPE), from the base template the request's template was built on. */
export function kindOf(t: Partial<DisplayTemplate> | null | undefined): TemplateKind {
  const base = Array.isArray(t?.versions) ? t!.versions[0]?.key : undefined;
  return !base || base === CLOTHING_BASE ? 'clothing' : 'product';
}
export const isProduct = (t: Partial<DisplayTemplate> | null | undefined) => kindOf(t) === 'product';
/** "garment" for clothing, "product" for gloves, footwear and PPE. */
export const itemWord = (t: Partial<DisplayTemplate> | null | undefined) => (isProduct(t) ? 'product' : 'garment');

/** A checklist label without its explanation: "Outsole: material and tread pattern" -> "Outsole". */
export const shortLabel = (label: string) => String(label || '').split(/:|\. | \(/)[0].trim();

// ---- the clothing fields of a request (specs) ------------------------------------------------------------------------------
/** The specs fields that only make sense for clothing (the safety rating and special instructions apply to everything). */
export const APPAREL_SPEC_KEYS = ['coreMaterial', 'liningMaterial', 'fabricWeight', 'zippers', 'buttonsSnaps', 'reflectiveStriping', 'pocketsCount', 'seamConstruction'] as const;
const isApparelKey = (k: string) => (APPAREL_SPEC_KEYS as readonly string[]).includes(k);
const filled = (v: unknown) => v != null && String(v).trim() !== '';
/** Show a specs field? Clothing: always. Product: the clothing fields only when they already hold a value (never hidden). */
export const showSpecField = (t: Partial<DisplayTemplate> | null | undefined, key: string, value: unknown) => !isProduct(t) || !isApparelKey(key) || filled(value);

// ---- Section 2 of the tech file: colour and fabric (2026-11-20) ------------------------------------------------------------
/** Section 2 fields that only make sense for clothing. A glove, boot or other PPE item shows them only when a person filled one. */
export const CLOTHING_ONLY_ANALYSIS = ['colorway.threadColor', 'colorway.reflectiveTape', 'fabricAnalysis.material', 'fabricAnalysis.weight',
  'fabricAnalysis.weaveType', 'fabricAnalysis.frRating', 'fabricAnalysis.finish', 'fabricAnalysis.shrinkage'] as const;
export const showAnalysisField = (t: Partial<DisplayTemplate> | null | undefined, path: string, value: unknown) =>
  !isProduct(t) || !(CLOTHING_ONLY_ANALYSIS as readonly string[]).includes(path) || filled(value);
/** The cover's name for "what it is": a product file never says "Garment class". */
export const descriptionLabel = (t: Partial<DisplayTemplate> | null | undefined) => (isProduct(t) ? 'Product description' : 'Garment class');

// ---- Where a draft came from: the cover note (2026-11-20) --------------------------------------------------------------------
export type DraftOrigin = 'ai' | 'manual' | 'unknown';
/** 'ai': the server's marker says a scan made it, or (older drafts) a scan's product identification and confidence are there.
 *  'manual': the server marked it as a person's first draft (Review tab, no scan). Anything else: not known. */
export function draftOrigin(a: Row | null | undefined): DraftOrigin {
  if (!a || typeof a !== 'object') return 'unknown';
  if (a.source === 'ai_scan') return 'ai';
  if (a.source === 'manual') return 'manual';
  const pid = a.productIdentification;
  return pid && typeof pid === 'object' && typeof a.overallConfidence === 'number' ? 'ai' : 'unknown';
}
/** The cover's draft note: names the AI only for a scan, a person only for a hand-made draft, neither when not known. */
export function draftNote(a: Row | null | undefined, word: string): string {
  const head = 'DRAFT. This specification has not been approved.';
  const tail = `must be checked against the physical ${word} before this file goes to a factory.`;
  const o = draftOrigin(a);
  if (o === 'ai') return `${head} Values were drafted by AI from photos and ${tail}`;
  if (o === 'manual') return `${head} No AI scan was run: the values were entered by a person and ${tail}`;
  return `${head} Values ${tail}`;
}

/** The words for a checklist item's state, as the Review tab says them. */
export const STATE_WORDS: Record<ItemState, string> = { needs: 'Needs confirmation', read: 'Read from photo, not checked', confirmed: 'Confirmed' };

/** The template's own fields with the saved values (a product's specs panel). Empty stays empty (the screen says "Not filled in"). */
export function templateFieldRows(t: DisplayTemplate, analysis: Row | null | undefined): Array<{ key: string; label: string; value: string; state: string | null }> {
  const saved = new Map<string, Row>((Array.isArray(analysis?.checklist) ? analysis!.checklist : []).filter((c: Row) => c && typeof c === 'object').map((c: Row) => [String(c.key), c]));
  return t.checklist.map((item) => {
    const s = saved.get(item.key);
    const value = String(s?.value ?? '').trim();
    return { key: item.key, label: shortLabel(item.label), value, state: s && value ? STATE_WORDS[itemState(s, 'checklist')] : null };
  });
}

// ---- photos ---------------------------------------------------------------------------------------------------------------
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** The New request photo checklist for a product: each view, then every item the template reads from a photo. Clothing: null. */
export function photoChecklist(t: DisplayTemplate | null | undefined): string[] | null {
  if (!t || !isProduct(t)) return null;
  const views = (t.family.views || []).map((v) => `${cap(viewsText([v]))} view`);
  const items = t.checklist.filter((c) => c.source === 'photo').map((c) => shortLabel(c.label));
  return Array.from(new Set([...views, ...items]));
}
/** "palm and back of hand", or null when the template names no views. */
export const viewsOf = (t: DisplayTemplate | null | undefined) => (t?.family.views?.length ? viewsText(t.family.views) : null);
/** The New request form's first line: clothing as before; a product names its template's views. */
export function newRequestIntro(t: DisplayTemplate | null | undefined): string {
  if (!t || !isProduct(t)) return 'Enter a garment for a customer. Add photos from several angles (front, back, pockets, labels, zippers): the AI reads all of them.';
  return `Enter a product for a customer. Add photos of the ${viewsOf(t) ?? 'product from several angles'}, and close-ups of the labels and markings: the AI reads all of them.`;
}

// ---- sizes and measurements ---------------------------------------------------------------------------------------------
const SIZE_KEYS = ['xs', 's', 'm', 'l', 'xl'];
/** The analysis with the template's sizes (gloves and footwear get their own until a size run is saved), as the PDF does. */
export const sizedAnalysis = <T extends Row | null | undefined>(a: T, t: Partial<DisplayTemplate> | null | undefined): T => withDefaultSizes(a, t?.family?.key);
/** The column labels of the measurement table and whether the middle one is the sample size (clothing only: "[M]"). */
export function sizeColumns(a: Row | null | undefined, t: Partial<DisplayTemplate> | null | undefined): { labels: string[]; sample: boolean; note: string } {
  const sz = sizedAnalysis(a ?? {}, t);
  return { labels: sizeLabels(sz), sample: !isProduct(t) && !sz?.sizeRun, note: sizeNote(sz) };
}
/** The size range: clothing as before ("XS - XL [SAMPLE: M]"); glove and shoe sizes from the template; else "Not filled in". */
export function sizeRange(a: Row | null | undefined, t: Partial<DisplayTemplate> | null | undefined): string {
  const sz = sizedAnalysis(a ?? {}, t);
  if (sz?.sizeRun) { const l = sizeLabels(sz); const n = sizeNote(sz); return `${l[0]} - ${l[4]}${n ? ` (${n})` : ''}`; }
  return isProduct(t) ? 'Not filled in' : 'XS - XL [SAMPLE: M]';
}
/** Measured flat on the half (clothing) or as each point describes (products). */
export const measuredFlat = (t: Partial<DisplayTemplate> | null | undefined) => !isProduct(t);

/** 'none': no size value filled in; 'unconfirmed': a filled row a person has not confirmed; 'confirmed': every filled row confirmed. */
export type MeasureState = 'none' | 'unconfirmed' | 'confirmed';
export function measureState(rows: unknown): MeasureState {
  const list = (Array.isArray(rows) ? rows : []).filter((r): r is Row => !!r && typeof r === 'object');
  const withValues = list.filter((r) => SIZE_KEYS.some((k) => filled(r[k])));
  if (withValues.length === 0) return 'none';
  return withValues.every((r) => isStamped(r)) ? 'confirmed' : 'unconfirmed';
}

/** The AI tab's note under the measurement table (upper case, as the tab prints it). Says nothing about estimates when false. */
export function measurementFootnote(a: Row | null | undefined, t: Partial<DisplayTemplate> | null | undefined): string {
  const state = measureState(a?.measurements);
  const cols = sizeColumns(a, t);
  const sizes = cols.note ? ` SIZE COLUMNS: ${cols.note.toUpperCase()} (${cols.labels.join(', ')}).` : '';
  if (state === 'none') return `* NO MEASUREMENTS FILLED IN YET. MEASURE A SAMPLE OR USE THE APPROVED SIZE CHART.${sizes}`;
  if (!isProduct(t)) {
    return state === 'unconfirmed'
      ? '* ALL ABOVE MEASUREMENTS ARE AI-ESTIMATED IN INCHES AND TAKEN FLAT. IT IS RECOMMENDED THAT ALL SIZES ARE SAMPLED BEFORE PRODUCTION.'
      : '* ALL ABOVE MEASUREMENTS ARE IN INCHES AND TAKEN FLAT, CONFIRMED BY A PERSON. IT IS RECOMMENDED THAT ALL SIZES ARE SAMPLED BEFORE PRODUCTION.';
  }
  return state === 'unconfirmed'
    ? `* IN INCHES, EACH POINT MEASURED AS ITS DESCRIPTION SAYS. VALUES NOT CONFIRMED BY A PERSON MAY BE AI ESTIMATES FROM PHOTOS: MEASURE A SAMPLE IN EVERY SIZE BEFORE PRODUCTION.${sizes}`
    : `* IN INCHES, EACH POINT MEASURED AS ITS DESCRIPTION SAYS, CONFIRMED BY A PERSON. IT IS RECOMMENDED THAT ALL SIZES ARE SAMPLED BEFORE PRODUCTION.${sizes}`;
}
/** The PDF's warning under a draft's measurement table. */
export function pdfMeasurementWarning(a: Row | null | undefined, t: Partial<DisplayTemplate> | null | undefined): string {
  const state = measureState(a?.measurements);
  const w = itemWord(t);
  if (state === 'none') return `No measurements filled in yet. Measure the physical ${w} or use the approved size chart.`;
  if (state === 'confirmed') return 'Every measurement was confirmed by a person. This file is not approved yet.';
  return `Measurements are estimates until approved. Measure the physical ${w}.`;
}

// ---- testing --------------------------------------------------------------------------------------------------------------
/** The standards the template names (confirmed ones, or candidates "to verify"), or '' when it names none. */
export function standardsLine(t: DisplayTemplate | null | undefined): string {
  if (!t) return '';
  const own = protectiveText(t);
  if (own) return own;
  return t.standardCandidates.length ? protectiveText({ protective: { standards: [], evidence: '' }, standardCandidates: t.standardCandidates }).trim() : '';
}

// ---- the AI scan's progress steps -----------------------------------------------------------------------------------------
/** The step labels while a scan runs (the same number of steps and timings for clothing and products). */
export function scanStepLabels(t: Partial<DisplayTemplate> | null | undefined, clothing: string[]): string[] {
  if (!isProduct(t)) return clothing;
  const product = ['Reading the photos...', 'Reading materials and colours...', 'Reading the checklist items for this product...', 'Reading the construction details...',
    'Copying printed labels and markings...', 'Matching the measurement points...', 'Checking what the photos do not show...', 'Preparing the draft for review...'];
  return clothing.map((c, i) => product[i] ?? c);
}

// ---- the request's garment (the Client Spec Review panel) -----------------------------------------------------------------
export type GarmentState = 'received' | 'on-the-way' | 'expected' | 'photos-only';
/** Where the physical garment is: the same states as the request page's Garment card. */
export function garmentState(rep: { specs?: Row | null; clientTrackingNumber?: string | null }): GarmentState {
  if (rep.specs?.inboundReceivedAt) return 'received';
  if (rep.clientTrackingNumber) return 'on-the-way';
  if (rep.specs?.garmentPosted) return 'expected';
  return 'photos-only';
}
/** The note in the "Physical Spec Review" box: true for a photos-only request too. */
export function physicalReviewNote(rep: { specs?: Row | null; clientTrackingNumber?: string | null }, t: Partial<DisplayTemplate> | null | undefined): string {
  const w = itemWord(t);
  const state = garmentState(rep);
  if (state === 'received') return `Verify details such as safety ratings and structural seams against the physical ${w} that the client has sent.`;
  if (state === 'photos-only') return `Photos only: no ${w} is coming. Check details such as safety ratings and seams against the photos, and ask the customer for anything the photos do not show.`;
  return `Verify details such as safety ratings and structural seams against the physical ${w} when it arrives. Until then, check them against the photos.`;
}
