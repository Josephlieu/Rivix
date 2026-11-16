// Saved scan results come in many shapes: older scans, gloves/footwear/PPE scans (no fabric or BOM lists), hand edits, or a
// model that answered oddly. Every screen and PDF reads the saved analysis through normalizeAnalysis(), so a missing or
// unexpected field can never crash a page (RQ-0635: a boot scan saved `bom` with packaging only and the Review tab crashed).
//
// SHAPE ONLY. It never invents a value: no rating, size, material, standard, colour or number is ever added. A missing text
// becomes '' and a missing list [] (the screens show "Not filled in"); a value of the wrong type becomes the empty value of the
// right type; a missing optional section stays missing; unknown fields are kept as they are. It never touches `template`,
// `drawing` or `review` (set by the server; template versions are immutable). Idempotent: normalizing twice changes nothing.
// Pure, relative imports only (the e2e tests load it directly).

type Row = Record<string, unknown>;

const isObj = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
/** Text as text: a string stays, a finite number is written as digits, anything else is ''. */
const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
/** A list of texts: strings (and numbers) kept in order, anything else dropped; one string becomes its non-empty lines. */
const texts = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' || (typeof x === 'number' && Number.isFinite(x))).map((x) => String(x))
  : typeof v === 'string' ? v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  : [];
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Fills the named text keys of an object (missing or wrong type -> ''); other keys are kept. */
function withTexts(o: Row, keys: string[]): Row {
  const out: Row = { ...o };
  for (const k of keys) out[k] = text(o[k]);
  return out;
}
/** Keeps a number key only when it is a real number (never makes one up). */
function keepNumber(o: Row, k: string): void {
  const n = num(o[k]);
  if (n === undefined) delete o[k]; else o[k] = n;
}
/** A list of rows: objects only (null, numbers, strings and arrays dropped), each with its text cells as text. */
function rows(v: unknown, textKeys: string[], numberKeys: string[] = []): Row[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isObj).map((r) => {
    const out = withTexts(r, textKeys);
    for (const k of numberKeys) keepNumber(out, k);
    return out;
  });
}

/**
 * The saved analysis in the shape every screen expects, or null when there is none (null, a string, an array...).
 * See the header: shape only, never a made-up value.
 */
export function normalizeAnalysis<T = Row>(raw: unknown): T | null {
  if (!isObj(raw)) return null;
  const a: Row = { ...raw };

  // Single values the screens print or edit.
  a.garmentClass = typeof raw.garmentClass === 'string' ? raw.garmentClass : null;
  a.season = typeof raw.season === 'string' ? raw.season : null;
  a.overallConfidence = num(raw.overallConfidence) ?? null;
  if ('analyzedAt' in raw) a.analyzedAt = text(raw.analyzedAt);
  if ('origin' in raw) a.origin = text(raw.origin);
  if ('hasHood' in raw) a.hasHood = typeof raw.hasHood === 'boolean' ? raw.hasHood : null;

  // Sections that may be absent (null = not drafted); present but malformed -> the empty section.
  if ('fabricAnalysis' in raw) {
    if (isObj(raw.fabricAnalysis)) {
      const f = withTexts(raw.fabricAnalysis, ['material', 'weight', 'weaveType', 'frRating']);
      for (const k of ['finish', 'shrinkage']) if (k in raw.fabricAnalysis) f[k] = text(raw.fabricAnalysis[k]);
      keepNumber(f, 'confidence');
      a.fabricAnalysis = f;
    } else a.fabricAnalysis = null;
  }
  if ('colorway' in raw) {
    a.colorway = isObj(raw.colorway)
      ? { ...withTexts(raw.colorway, ['bodyColor', 'threadColor', 'hardwareFinish', 'reflectiveTape']), contrastColors: texts(raw.colorway.contrastColors) }
      : null;
  }
  if ('washCare' in raw) {
    if (isObj(raw.washCare)) {
      const w: Row = { ...raw.washCare, instructions: texts(raw.washCare.instructions), specialNotes: text(raw.washCare.specialNotes) };
      if ('instructionsFr' in raw.washCare) w.instructionsFr = texts(raw.washCare.instructionsFr);
      a.washCare = w;
    } else a.washCare = null;
  }
  if ('bom' in raw) {
    if (isObj(raw.bom)) {
      const p = isObj(raw.bom.packaging) ? raw.bom.packaging : {};
      const packaging = withTexts(p, ['foldDescription', 'polybagSize', 'cartonSize']);
      if ('hangtagSpec' in p) packaging.hangtagSpec = text(p.hangtagSpec);
      a.bom = { ...raw.bom, hardware: texts(raw.bom.hardware), thread: texts(raw.bom.thread), labels: texts(raw.bom.labels), packaging };
    } else a.bom = null;
  }
  if ('productIdentification' in raw) {
    const p = raw.productIdentification;
    a.productIdentification = isObj(p)
      ? { ...p, mode: text(p.mode), brand: typeof p.brand === 'string' ? p.brand : null, model: typeof p.model === 'string' ? p.model : null, source: text(p.source) }
      : null;
  }

  // Lists the screens always loop over.
  a.components = rows(raw.components, ['id', 'type', 'label', 'location'], ['confidence', 'x', 'y']);
  a.measurements = rows(raw.measurements, ['pom', 'description', 'xs', 's', 'm', 'l', 'xl', 'tolerance']);
  a.construction = rows(raw.construction, ['location', 'seamType', 'stitchType', 'seamAllowance', 'notes'], ['spiTop', 'spiBottom']);
  a.stitchReference = rows(raw.stitchReference, ['code', 'name', 'machineType', 'usage'], ['defaultSpi']);
  a.labelPlacements = rows(raw.labelPlacements, ['type', 'location', 'attachment', 'dimensions', 'material']);

  // Optional lists and maps: kept absent when absent, corrected when present.
  if ('checklist' in raw) a.checklist = rows(raw.checklist, ['key', 'label', 'value']);
  if ('markings' in raw) a.markings = rows(raw.markings, ['kind', 'text', 'location'], ['photo']);
  if ('artwork' in raw) a.artwork = rows(raw.artwork, ['name', 'placement', 'size', 'method']);
  for (const k of ['flags', 'fromCustomer', 'fromWebsite', 'testing']) if (k in raw) a[k] = texts(raw[k]);
  if ('suggestions' in raw) {
    const s = isObj(raw.suggestions) ? raw.suggestions : {};
    a.suggestions = Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === 'string'));
  }
  if ('sizeRun' in raw) {
    // Absent = XS to XL. A malformed size run is dropped rather than guessed.
    if (isObj(raw.sizeRun) && Array.isArray(raw.sizeRun.labels)) a.sizeRun = { ...raw.sizeRun, labels: texts(raw.sizeRun.labels) };
    else delete a.sizeRun;
  }
  return a as T;
}
