import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from './supabase-admin'; // relative imports: the tests load this file directly
import { BUILT_IN_CATALOG, type TemplateBody, type TemplateCatalog, type TemplateRecord } from './template-catalog';

// Server side of the template system (task 26): the current version of every template, each product type's family and
// add-on modules, and each category's base template, read from the database with the service role. A short cache keeps the
// AI scan and the screens fast; an admin change clears it (clearTemplateCache).
// If the tables cannot be read (SQL not run, a database hiccup), the built-in templates from the code are used instead, so the
// scan and the PDF keep working. That is logged, and the catalog says where it came from (source).
const TTL_MS = 60_000;
let cache: { at: number; catalog: TemplateCatalog } | null = null;
let warned = false;
export const clearTemplateCache = () => { cache = null; };

type Row = Record<string, unknown>;

export async function getTemplateCatalog(admin: SupabaseClient = createAdminClient()): Promise<TemplateCatalog> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.catalog;
  try {
    const [t, v, g, c] = await Promise.all([
      admin.from('templates').select('key, kind, label, description, current_version, active'),
      admin.from('template_versions').select('template_key, version, body'),
      admin.from('garment_types').select('key, category, template_family, template_modules'),
      admin.from('garment_categories').select('key, base_template'),
    ]);
    const failed = [t, v, g, c].find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    // Only the current version of each template; an older version stays in the table for the tech files made with it.
    const bodies = new Map((v.data as Row[]).map((r) => [`${r.template_key}@${r.version}`, r.body as TemplateBody]));
    const templates: TemplateRecord[] = (t.data as Row[]).flatMap((r) => {
      const body = bodies.get(`${r.key}@${r.current_version}`);
      return body ? [{ key: String(r.key), kind: r.kind as TemplateRecord['kind'], label: String(r.label), description: String(r.description ?? ''), version: Number(r.current_version), active: r.active !== false, body }] : [];
    });
    if (!templates.some((x) => x.kind === 'family' && x.key === 'generic') || !templates.some((x) => x.kind === 'base')) throw new Error('the templates table is missing the general family or a base template');
    const catalog: TemplateCatalog = {
      source: 'database',
      templates,
      types: Object.fromEntries((g.data as Row[]).map((r) => [String(r.key), {
        family: (r.template_family as string | null) ?? null,
        // A type with no modules saved yet keeps the built-in ones (a brand-new type has none).
        modules: Array.isArray(r.template_modules) ? (r.template_modules as string[]) : BUILT_IN_CATALOG.types[String(r.key)]?.modules ?? [],
        category: (r.category as string | null) ?? null,
      }])),
      categories: Object.fromEntries((c.data as Row[]).map((r) => [String(r.key), { baseTemplate: String(r.base_template ?? 'garment-base') }])),
    };
    cache = { at: Date.now(), catalog };
    warned = false;
    return catalog;
  } catch (e) {
    if (!warned) console.error('templates: could not read the database, using the built-in templates:', e instanceof Error ? e.message : e);
    warned = true;
    cache = { at: Date.now() - TTL_MS + 10_000, catalog: BUILT_IN_CATALOG }; // try the database again in 10 s
    return BUILT_IN_CATALOG;
  }
}
