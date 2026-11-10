// Template system v2 (task 26). A product type's tech file template is built from templates kept in the database:
// a BASE (items every product in the category needs), a FAMILY (the base shape: measurement points, construction, sizing,
// drawing views) and optional MODULES (add-ons such as insulation, hi-vis, FR). Each template has numbered versions; a version
// is never edited (the database refuses it), so a tech file made with version N always reads the same.
//
// resolveTemplate() is the one entry point the screens, the AI and the PDF use. It is pure: the catalog is passed in.
// - the server gets it from the database: getTemplateCatalog() in src/lib/template-store.ts (cached, with a code fallback);
// - the browser gets it from /api/replications/garment-types (BUILT_IN_CATALOG until that has loaded).
// BUILT_IN_CATALOG is today's templates from src/lib/garment-templates.ts, in the new shape: the seed of the database
// (scripts/generate-template-seed.mjs) and the fallback when the database cannot be read.
// Client-safe (no server imports). Relative imports only (the tests load this file directly).
import { COMMON_ITEMS, FAMILIES, MODULES, TYPE_TEMPLATES, type ChecklistItem, type Family, type Module, type ProtectiveInfo, type Source, type SizingStructure } from './garment-templates';
import { ADDED_TEMPLATES, ADDED_TYPE_TEMPLATES, CATEGORY_BASE } from './templates-added';
import { DEFAULT_GARMENT_CATEGORIES, DEFAULT_GARMENT_TYPES } from './garment-types-data';

// ---- the general template shape ---------------------------------------------------------------------------------------------
export type CertificationLevel = 'described' | 'needs-test-evidence' | 'certified-equipment';
export type SizingSystem = SizingStructure['style'];
export type DrawingView = 'front' | 'back' | 'side' | 'palm' | 'back-of-hand' | 'top' | 'sole' | 'inside' | 'outer-side' | 'inner-side';
// A standard that MAY apply (task 27). Never used as a claim until the RIVIX compliance person confirms it (status 'to-verify').
export interface StandardCandidate { standard: string; link: string; status: 'to-verify'; appliesTo?: string }

export interface TemplatePoint { code: string; name: string; howToMeasure: string; method: 'flat' | 'length' | 'circumference' | 'along-body' | 'other' }
export interface TemplateItem { key: string; label: string; section: 'spec' | 'construction'; source: Source; required: boolean }
export interface TemplateBody {
  points: TemplatePoint[];
  items: TemplateItem[];                 // spec fields (materials, components) and the construction checklist, in tech file order
  sizing: { system: SizingSystem; note: string } | null;
  views: DrawingView[];
  protective: ProtectiveInfo | null;     // standards to check and the evidence needed
  certification: CertificationLevel;     // certified equipment: the tech file can describe it but never claim compliance
  composedOf?: string[];                 // a kit: the family templates it is made of
  notes?: string[];                      // notes shown with the template (scope limits, what not to claim)
  standardCandidates?: StandardCandidate[]; // standards that may apply, each with a source link, all still to verify
}
export interface TemplateRecord { key: string; kind: 'base' | 'family' | 'module'; label: string; description: string; version: number; active: boolean; body: TemplateBody }
export interface TemplateCatalog {
  source: 'database' | 'built-in';
  templates: TemplateRecord[];                                                   // current version of each template
  types: Record<string, { family: string | null; modules: string[]; category: string | null }>;
  categories: Record<string, { baseTemplate: string }>;
}

const CERT_RANK: Record<CertificationLevel, number> = { described: 0, 'needs-test-evidence': 1, 'certified-equipment': 2 };

// ---- today's code as version 1 (the seed and the fallback) -----------------------------------------------------------------
// Certification level (decided 2026-11-10): described = every family + insulated, waterproof; needs test evidence = hi-vis,
// FR, arc, welding, disposable; certified equipment = firefighter, chemical, immersion, heat reflective.
const MODULE_CERT: Record<string, CertificationLevel> = { hivis: 'needs-test-evidence', fr: 'needs-test-evidence', arc: 'needs-test-evidence', welding: 'needs-test-evidence', disposable: 'needs-test-evidence', firefighter: 'certified-equipment', chemical: 'certified-equipment', immersion: 'certified-equipment', 'heat-reflective': 'certified-equipment' };
// Items about how the garment is made are construction; the rest are spec fields. Information only: the list order is what counts.
const CONSTRUCTION_KEYS = new Set(['seams', 'seam-sealing', 'weather-closures', 'fit-allowance', 'arc-coverage', 'weld-coverage', 'sealing', 'overlap', 'suit-seams', 'hood-cuffs']);
const toItem = (c: ChecklistItem, section?: TemplateItem['section']): TemplateItem => ({ key: c.key, label: c.label, section: section ?? (CONSTRUCTION_KEYS.has(c.key) ? 'construction' : 'spec'), source: c.source, required: c.required });

export const BUILT_IN_TEMPLATES: TemplateRecord[] = [
  { key: 'garment-base', kind: 'base', label: 'Every garment', description: 'Items every garment tech file asks for.', version: 1, active: true,
    body: { points: [], items: COMMON_ITEMS.map((c) => toItem(c)), sizing: null, views: [], protective: null, certification: 'described' } },
  ...FAMILIES.map((f): TemplateRecord => ({ key: f.key, kind: 'family', label: f.label, description: f.description, version: 1, active: true,
    body: { points: f.points.map((p) => ({ code: p.code, name: p.name, howToMeasure: p.definition, method: p.kind })), items: f.construction.map((c) => toItem(c, 'construction')), sizing: { system: f.sizing.style, note: f.sizing.note }, views: f.views, protective: null, certification: 'described', ...(f.composedOf ? { composedOf: f.composedOf } : {}) } })),
  ...MODULES.map((m): TemplateRecord => ({ key: m.key, kind: 'module', label: m.label, description: '', version: 1, active: true,
    body: { points: [], items: m.construction.map((c) => toItem(c)), sizing: null, views: [], protective: m.protective ? { standards: m.protective.standards, evidence: m.protective.evidence } : null, certification: MODULE_CERT[m.key] ?? 'described' } })),
  // Task 27: gloves, footwear, headwear, hoods, sleeves, back supports, harnesses, accessories and two clothing kits.
  ...ADDED_TEMPLATES,
];

export const BUILT_IN_CATALOG: TemplateCatalog = {
  source: 'built-in',
  templates: BUILT_IN_TEMPLATES,
  // Every type in the 9 categories (task 27): the 41 older types keep their template, the new ones use theirs.
  types: Object.fromEntries(Object.entries({ ...TYPE_TEMPLATES, ...ADDED_TYPE_TEMPLATES }).map(([k, v]) => [k, {
    family: v.family, modules: v.modules ?? [], category: DEFAULT_GARMENT_TYPES.find((g) => g.key === k)?.category ?? null,
  }])),
  categories: Object.fromEntries(DEFAULT_GARMENT_CATEGORIES.map((c) => [c.key, { baseTemplate: CATEGORY_BASE[c.key] ?? 'garment-base' }])),
};

// ---- resolving --------------------------------------------------------------------------------------------------------------
export interface ResolvedTemplate {
  family: Family;
  modules: Module[];
  parts: Family[]; // for a kit, the families it is made of; otherwise just the family itself
  checklist: ChecklistItem[]; // the base items, then each part's items, then the modules' items (no duplicates)
  protective: ProtectiveInfo | null; // merged from the modules; null when the product has no protective claim
  certification: CertificationLevel; // the strictest level of the base, the parts and the modules
  versions: Array<{ key: string; version: number }>; // every template version used: a tech file records these
  notes: string[]; // task 27: notes from the templates used (scope limits, what not to claim); empty for the older templates
  standardCandidates: StandardCandidate[]; // task 27: standards that MAY apply, all still to verify (never a claim)
}

const find = (catalog: TemplateCatalog, key: string | null | undefined, kind: TemplateRecord['kind']) =>
  key ? catalog.templates.find((t) => t.key === key && t.kind === kind) : undefined;

// Back to the shapes the screens, the AI prompt and the PDF already use.
const asFamily = (t: TemplateRecord): Family => ({
  key: t.key, label: t.label, description: t.description,
  points: t.body.points.map((p) => ({ code: p.code, name: p.name, definition: p.howToMeasure, kind: p.method })),
  construction: t.body.items.map((i) => ({ key: i.key, label: i.label, source: i.source, required: i.required })),
  sizing: { style: (t.body.sizing?.system ?? 'custom') as SizingStructure['style'], note: t.body.sizing?.note ?? '' },
  views: t.body.views as Family['views'],
  ...(t.body.composedOf ? { composedOf: t.body.composedOf } : {}),
});
const asModule = (t: TemplateRecord): Module => ({
  key: t.key, label: t.label,
  construction: t.body.items.map((i) => ({ key: i.key, label: i.label, source: i.source, required: i.required })),
  ...(t.body.protective ? { protective: t.body.protective } : {}),
});

/** The family template for a product type: the one saved on the type (admins can set it), else the type's own, else the general one. */
export function familyKeyFor(typeKey: string, saved: string | null | undefined, catalog: TemplateCatalog): string {
  if (saved && find(catalog, saved, 'family')) return saved;
  const own = catalog.types[typeKey]?.family;
  return own && find(catalog, own, 'family') ? own : 'generic';
}

/** The family templates an admin can choose from, in a stable order (today's order first, then any new ones by name). */
export function familyChoices(catalog: TemplateCatalog): Array<{ key: string; label: string }> {
  const order = new Map(FAMILIES.map((f, i) => [f.key, i]));
  return catalog.templates
    .filter((t) => t.kind === 'family' && t.active)
    .sort((a, b) => (order.get(a.key) ?? 1e6) - (order.get(b.key) ?? 1e6) || a.label.localeCompare(b.label))
    .map((t) => ({ key: t.key, label: t.label }));
}

/** Everything the tech file and the AI need to know about one product type. */
export function resolveTemplate(typeKey: string, savedFamily: string | null | undefined, catalog: TemplateCatalog): ResolvedTemplate {
  const familyT = find(catalog, familyKeyFor(typeKey, savedFamily, catalog), 'family') ?? find(BUILT_IN_CATALOG, 'generic', 'family')!;
  const moduleTs = (catalog.types[typeKey]?.modules ?? []).map((k) => find(catalog, k, 'module')).filter((t): t is TemplateRecord => !!t);
  const partTs = familyT.body.composedOf ? familyT.body.composedOf.map((k) => find(catalog, k, 'family')).filter((t): t is TemplateRecord => !!t) : [familyT];
  const category = catalog.types[typeKey]?.category;
  const baseT = find(catalog, (category && catalog.categories[category]?.baseTemplate) || 'garment-base', 'base') ?? find(BUILT_IN_CATALOG, 'garment-base', 'base')!;

  const family = asFamily(familyT);
  const modules = moduleTs.map(asModule);
  const parts = familyT.body.composedOf ? partTs.map(asFamily) : [family];
  const seen = new Set<string>();
  const checklist: ChecklistItem[] = [];
  for (const item of [...asModule(baseT).construction, ...parts.flatMap((f) => f.construction), ...modules.flatMap((m) => m.construction)]) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    checklist.push(item);
  }
  // The family's own claim first (task 27: harness, sleeve), then the modules'. Older families have none, so nothing changes for them.
  const withClaim = [familyT, ...moduleTs].filter((t) => t.body.protective);
  const protective = withClaim.length
    ? { standards: Array.from(new Set(withClaim.flatMap((t) => t.body.protective!.standards))), evidence: withClaim[0].body.protective!.evidence }
    : null;
  const used = [baseT, familyT, ...(familyT.body.composedOf ? partTs : []), ...moduleTs];
  const certification = used.reduce<CertificationLevel>((lvl, t) => (CERT_RANK[t.body.certification] > CERT_RANK[lvl] ? t.body.certification : lvl), 'described');
  const versions = Array.from(new Map(used.map((t) => [t.key, { key: t.key, version: t.version }])).values());
  const notes = Array.from(new Set(used.flatMap((t) => t.body.notes ?? [])));
  const standardCandidates = Array.from(new Map(used.flatMap((t) => t.body.standardCandidates ?? []).map((c) => [c.standard, c])).values());
  return { family, modules, parts, checklist, protective, certification, versions, notes, standardCandidates };
}

// ---- words for the screens (task 27) ------------------------------------------------------------------------------------------
const VIEW_WORDS: Record<string, string> = { 'back-of-hand': 'back of hand', 'outer-side': 'outer side', 'inner-side': 'inner side' };
/** "front and back", "palm and back of hand", "outer side, inner side, top and sole". */
export function viewsText(views: string[]): string {
  const w = views.map((v) => VIEW_WORDS[v] ?? v);
  return w.length <= 2 ? w.join(' and ') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
}
const METHOD_WORDS: Record<string, string> = { flat: 'Flat, across', length: 'Length', circumference: 'Around', 'along-body': 'Along the body', other: 'Other' };
export const methodText = (kind: string) => METHOD_WORDS[kind] ?? 'Length';
/** The protective line: confirmed standards as before; when there are none yet, the candidates, clearly marked "to verify". */
/** The older templates read exactly as before (`${prefix}: A, B. evidence`). */
export function protectiveText(t: Pick<ResolvedTemplate, 'protective' | 'standardCandidates'>, prefix = 'Standards to check'): string {
  if (!t.protective) return '';
  if (t.protective.standards.length) return `${prefix}: ${t.protective.standards.join(', ')}. ${t.protective.evidence}`;
  const cands = t.standardCandidates.map((c) => c.standard.split(' ').slice(0, 2).join(' ').replace(/:$/, ''));
  return `${cands.length ? `Standards that may apply (to verify, not claims): ${Array.from(new Set(cands)).join(', ')}. ` : ''}${t.protective.evidence}`;
}
export const CERTIFICATION_TEXT: Record<CertificationLevel, string> = {
  described: 'Described (no protective claim)',
  'needs-test-evidence': 'Needs test evidence before any claim',
  'certified-equipment': 'Certified equipment: the tech file describes it and never claims compliance',
};
