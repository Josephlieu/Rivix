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

// ---- the general template shape ---------------------------------------------------------------------------------------------
export type CertificationLevel = 'described' | 'needs-test-evidence' | 'certified-equipment';
export type SizingSystem = SizingStructure['style'] | 'glove' | 'shoe-width' | 'head';
export type DrawingView = 'front' | 'back' | 'side' | 'palm' | 'back-of-hand' | 'top' | 'sole' | 'inside';

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
];

export const BUILT_IN_CATALOG: TemplateCatalog = {
  source: 'built-in',
  templates: BUILT_IN_TEMPLATES,
  types: Object.fromEntries(Object.entries(TYPE_TEMPLATES).map(([k, v]) => [k, { family: v.family, modules: v.modules ?? [], category: null }])),
  categories: {},
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
}

const find = (catalog: TemplateCatalog, key: string | null | undefined, kind: TemplateRecord['kind']) =>
  key ? catalog.templates.find((t) => t.key === key && t.kind === kind) : undefined;

// Back to the shapes the screens, the AI prompt and the PDF already use.
const asFamily = (t: TemplateRecord): Family => ({
  key: t.key, label: t.label, description: t.description,
  points: t.body.points.map((p) => ({ code: p.code, name: p.name, definition: p.howToMeasure, kind: p.method as 'flat' | 'length' })),
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
  const withClaim = moduleTs.filter((t) => t.body.protective);
  const protective = withClaim.length
    ? { standards: Array.from(new Set(withClaim.flatMap((t) => t.body.protective!.standards))), evidence: withClaim[0].body.protective!.evidence }
    : null;
  const used = [baseT, familyT, ...(familyT.body.composedOf ? partTs : []), ...moduleTs];
  const certification = used.reduce<CertificationLevel>((lvl, t) => (CERT_RANK[t.body.certification] > CERT_RANK[lvl] ? t.body.certification : lvl), 'described');
  const versions = Array.from(new Map(used.map((t) => [t.key, { key: t.key, version: t.version }])).values());
  return { family, modules, parts, checklist, protective, certification, versions };
}
