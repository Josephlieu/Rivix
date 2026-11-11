// Task 31: the rules for templates that admins create or change. A change is always a NEW version (versions are never edited
// in place); this file checks a version before it is published, cleans the text admins type, sets size limits so the AI scan
// still fits, and describes what changed in plain words. Text typed by admins is DATA: it is cleaned to single lines here and
// quoted in the AI prompt, where the fixed rules stay outside anything an admin can edit.
// Pure and client-safe, relative imports only (the screens, the routes and the tests use it).
import type { TemplateBody, TemplateItem, TemplatePoint, CertificationLevel, StandardCandidate } from './template-catalog';

export const LIMITS = {
  points: 40, items: 80, notes: 10, standards: 10, candidates: 10, parts: 6,
  name: 80, description: 300, label: 120, howToMeasure: 300, note: 300, evidence: 1000, standard: 160, link: 300,
  sizingNote: 300, totalText: 12_000,
};
export const SIZING_SYSTEMS = ['alpha', 'numeric', 'waist-inseam', 'height-based', 'glove', 'shoe-width', 'head', 'one-size', 'custom'] as const;
export const VIEWS = ['front', 'back', 'side', 'palm', 'back-of-hand', 'top', 'sole', 'inside', 'outer-side', 'inner-side'] as const;
export const METHODS = ['flat', 'length', 'circumference', 'along-body', 'other'] as const;
export const CERTIFICATION: CertificationLevel[] = ['described', 'needs-test-evidence', 'certified-equipment'];
export const CERT_WORDS: Record<CertificationLevel, string> = { described: 'described', 'needs-test-evidence': 'needs test evidence', 'certified-equipment': 'certified equipment' };
const RANK: Record<string, number> = { described: 0, 'needs-test-evidence': 1, 'certified-equipment': 2 };

/** Text typed by an admin, made safe to store and to quote in the AI prompt: one line, no control characters, no heading or
 *  list markers at the start, capped. */
export function cleanText(v: unknown, max: number): string {
  return String(v ?? '')
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s#>*\-=`]+/, '')
    .trim()
    .slice(0, max);
}
const KEY_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const CODE_RE = /^[A-Z]{1,2}[0-9]?$/;

/** A new template's key from its name, unique among the existing keys ("zz-" is kept for the tests' own data). */
export function newTemplateKey(label: string, existing: string[], test = false): string {
  let base = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'template';
  if (!test) base = base.replace(/^zz-/, 'z-');
  if (test && !base.startsWith('zz-')) base = `zz-${base}`.slice(0, 36);
  let key = base, n = 2;
  while (existing.includes(key)) key = `${base}-${n++}`;
  return key;
}

export interface TemplateDraft { label: string; description: string; body: TemplateBody }
export type Kind = 'base' | 'family' | 'module';

/**
 * Checks and cleans a template version before it is published. `baseKeys`: the item keys of the base templates (a family's or
 * add-on's item with the same key would be silently dropped when they are combined). `families`: existing non-kit families
 * (for a kit's parts). Returns the cleaned draft, or the list of problems in plain words.
 */
export function validateTemplate(kind: Kind, draft: TemplateDraft, ctx: { baseKeys: string[]; families: string[] }): { ok: true; draft: TemplateDraft } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const b = (draft.body ?? {}) as Partial<TemplateBody>;
  const label = cleanText(draft.label, LIMITS.name);
  if (!label) errors.push('Give the template a name.');
  const description = cleanText(draft.description, LIMITS.description);
  const points: TemplatePoint[] = (Array.isArray(b.points) ? b.points : []).map((p) => ({
    code: cleanText(p?.code, 3).toUpperCase(), name: cleanText(p?.name, LIMITS.label), howToMeasure: cleanText(p?.howToMeasure, LIMITS.howToMeasure),
    method: (METHODS as readonly string[]).includes(String(p?.method)) ? p.method : 'other',
  }));
  const items: TemplateItem[] = (Array.isArray(b.items) ? b.items : []).map((i) => ({
    key: cleanText(i?.key, 40).toLowerCase(), label: cleanText(i?.label, LIMITS.label),
    section: i?.section === 'construction' ? 'construction' : 'spec', source: i?.source === 'document' ? 'document' : 'photo', required: i?.required === true,
  }));
  const composedOf = Array.isArray(b.composedOf) ? b.composedOf.map((k) => cleanText(k, 40)) : undefined;
  if (!points.length && !items.length && !(composedOf && composedOf.length)) errors.push('Add at least one section: a measurement point or a field.');
  if (points.length > LIMITS.points) errors.push(`At most ${LIMITS.points} measurement points (the AI scan has to fit).`);
  if (items.length > LIMITS.items) errors.push(`At most ${LIMITS.items} fields (the AI scan has to fit).`);
  const codes = new Set<string>();
  points.forEach((p, i) => {
    if (!CODE_RE.test(p.code)) errors.push(`Measurement point ${i + 1}: the code must be one or two capital letters, optionally with a digit (for example A, B, AA, A1).`);
    else if (codes.has(p.code)) errors.push(`Measurement code ${p.code} is used twice: each code must be unique.`);
    codes.add(p.code);
    if (!p.name) errors.push(`Measurement point ${p.code || i + 1}: give it a name.`);
    if (!p.howToMeasure) errors.push(`Measurement point ${p.code || i + 1}: say how to measure it.`);
  });
  const keys = new Set<string>();
  items.forEach((it, i) => {
    if (!KEY_RE.test(it.key)) errors.push(`Field ${i + 1}: the key must be 2 to 40 lowercase letters, digits or dashes.`);
    else if (keys.has(it.key)) errors.push(`Field key "${it.key}" is used twice: each key must be unique.`);
    else if (kind !== 'base' && ctx.baseKeys.includes(it.key)) errors.push(`Field key "${it.key}" is already a field of every product (base template): choose another key.`);
    keys.add(it.key);
    if (!it.label) errors.push(`Field ${it.key || i + 1}: give it a label.`);
  });
  if (kind !== 'family' && (points.length || composedOf?.length)) errors.push('Only a garment or product template (family) has measurement points or parts.');
  if (composedOf) {
    if (composedOf.length < 2 || composedOf.length > LIMITS.parts) errors.push(`A set is made of 2 to ${LIMITS.parts} parts.`);
    for (const k of composedOf) if (!ctx.families.includes(k)) errors.push(`Part "${k}" is not an existing single garment template.`);
  }
  const sys = b.sizing?.system;
  type System = NonNullable<TemplateBody['sizing']>['system'];
  const sizing = kind === 'family' ? { system: ((SIZING_SYSTEMS as readonly string[]).includes(String(sys)) ? sys : 'custom') as System, note: cleanText(b.sizing?.note, LIMITS.sizingNote) } : null;
  if (kind === 'family' && sys && !(SIZING_SYSTEMS as readonly string[]).includes(String(sys))) errors.push('Choose a sizing system from the list.');
  const views = (Array.isArray(b.views) ? b.views : []).filter((v, i, all) => all.indexOf(v) === i);
  if (views.some((v) => !(VIEWS as readonly string[]).includes(String(v)))) errors.push('Choose drawing views from the list.');
  if (kind === 'family' && !views.length) errors.push('Choose at least one drawing view.');
  const certification = CERTIFICATION.includes(b.certification as CertificationLevel) ? (b.certification as CertificationLevel) : null;
  if (!certification) errors.push('Choose a certification level.');
  const standards = (b.protective?.standards ?? []).map((s) => cleanText(s, LIMITS.standard)).filter(Boolean);
  if (standards.length > LIMITS.standards) errors.push(`At most ${LIMITS.standards} standards.`);
  const evidence = cleanText(b.protective?.evidence, LIMITS.evidence);
  if (standards.length && !evidence) errors.push('Say what evidence is needed for the standards (the protective note).');
  const protective = standards.length || evidence ? { standards, evidence } : null;
  const notes = (Array.isArray(b.notes) ? b.notes : []).map((n) => cleanText(n, LIMITS.note)).filter(Boolean);
  if (notes.length > LIMITS.notes) errors.push(`At most ${LIMITS.notes} notes.`);
  const cands: StandardCandidate[] = (Array.isArray(b.standardCandidates) ? b.standardCandidates : []).map((c) => ({
    standard: cleanText(c?.standard, LIMITS.standard), link: cleanText(c?.link, LIMITS.link), status: 'to-verify' as const, ...(c?.appliesTo ? { appliesTo: cleanText(c.appliesTo, LIMITS.label) } : {}),
  })).filter((c) => c.standard);
  if (cands.length > LIMITS.candidates) errors.push(`At most ${LIMITS.candidates} standards to verify.`);
  if (cands.some((c) => !/^https:\/\/[^\s]+$/.test(c.link))) errors.push('Every standard to verify needs its source link (https://...).');
  const body: TemplateBody = {
    points: kind === 'family' ? points : [], items, sizing, views: kind === 'family' ? (views as TemplateBody['views']) : [], protective, certification: certification ?? 'described',
    ...(composedOf && kind === 'family' ? { composedOf } : {}), ...(notes.length ? { notes } : {}), ...(cands.length ? { standardCandidates: cands } : {}),
  };
  const textSize = JSON.stringify({ label, description, body }).length;
  if (textSize > LIMITS.totalText) errors.push(`The template is too long for the AI scan (${textSize} characters; at most ${LIMITS.totalText}). Shorten the texts or remove fields.`);
  return errors.length ? { ok: false, errors: Array.from(new Set(errors)) } : { ok: true, draft: { label, description, body } };
}

/** True when the new version has a lower certification level (e.g. certified equipment → described). */
export const lowersCertification = (from: CertificationLevel | undefined, to: CertificationLevel) => RANK[to] < RANK[from ?? 'described'];

/** Same content, whatever the key order (the database stores JSON keys in its own order). */
const same = (a: unknown, b: unknown) => {
  const st = (v: unknown) => JSON.stringify(v ?? null, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([p], [q]) => p.localeCompare(q))) : x));
  return st(a) === st(b);
};

/** What changed between two versions of a template, in plain words. */
export function describeTemplateChanges(old: TemplateDraft | null, next: TemplateDraft): string[] {
  if (!old) return [`New template "${next.label}" (${next.body.points.length} measurement points, ${next.body.items.length} fields)`];
  const out: string[] = [];
  const o = old.body, n = next.body;
  if (old.label !== next.label) out.push(`Name: "${old.label}" → "${next.label}"`);
  if (old.description !== next.description) out.push('Description changed');
  const op = new Map(o.points.map((p) => [p.code, p])), np = new Map(n.points.map((p) => [p.code, p]));
  for (const [c, p] of np) {
    const was = op.get(c);
    if (!was) out.push(`Point ${c} ${p.name}: added`);
    else {
      if (was.name !== p.name) out.push(`Point ${c}: name "${was.name}" → "${p.name}"`);
      if (was.howToMeasure !== p.howToMeasure) out.push(`Point ${c} ${p.name}: how to measure changed`);
      if (was.method !== p.method) out.push(`Point ${c} ${p.name}: measured ${was.method} → ${p.method}`);
    }
  }
  for (const [c, p] of op) if (!np.has(c)) out.push(`Point ${c} ${p.name}: removed`);
  if (o.points.map((p) => p.code).filter((c) => np.has(c)).join() !== n.points.map((p) => p.code).filter((c) => op.has(c)).join()) out.push('Measurement points reordered');
  const oi = new Map(o.items.map((i) => [i.key, i])), ni = new Map(n.items.map((i) => [i.key, i]));
  for (const [k, i] of ni) {
    const was = oi.get(k);
    if (!was) out.push(`Field ${i.label}: added`);
    else {
      if (was.label !== i.label) out.push(`Field ${k}: label "${was.label}" → "${i.label}"`);
      if (was.required !== i.required) out.push(`Field ${i.label}: ${i.required ? 'now required' : 'now optional'}`);
      if (was.source !== i.source) out.push(`Field ${i.label}: ${i.source === 'document' ? 'needs a document' : 'often visible in a photo'}`);
      if (was.section !== i.section) out.push(`Field ${i.label}: moved to ${i.section === 'construction' ? 'construction' : 'spec fields'}`);
    }
  }
  for (const [k, i] of oi) if (!ni.has(k)) out.push(`Field ${i.label || k}: removed`);
  if (!same(o.sizing, n.sizing)) out.push(`Sizing: ${o.sizing?.system ?? 'none'} → ${n.sizing?.system ?? 'none'}${o.sizing?.note !== n.sizing?.note ? ' (note changed)' : ''}`);
  const ov = o.views.join(', '), nv = n.views.join(', ');
  if (ov !== nv) out.push(`Drawing views: ${ov || 'none'} → ${nv || 'none'}`);
  if (o.certification !== n.certification) out.push(`Certification: ${CERT_WORDS[o.certification]} → ${CERT_WORDS[n.certification]}`);
  if (!same(o.protective, n.protective)) out.push('Protective standards or evidence changed');
  if (!same(o.notes ?? [], n.notes ?? [])) out.push('Notes changed');
  if (!same(o.standardCandidates ?? [], n.standardCandidates ?? [])) out.push('Standards to verify changed');
  if (!same(o.composedOf ?? [], n.composedOf ?? [])) out.push(`Parts: ${(o.composedOf ?? []).join(', ') || 'none'} → ${(n.composedOf ?? []).join(', ') || 'none'}`);
  return out;
}
