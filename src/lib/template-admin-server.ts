// Server only (task 31): reading the templates for the admin screens, and the context a new version is checked against.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TemplateBody, TemplateRecord } from '@/lib/template-catalog';
import { DRAWINGS } from '@/lib/drawings';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function readTemplates(admin: SupabaseClient) {
  const [t, v, g, c] = await Promise.all([
    admin.from('templates').select('key, kind, label, description, current_version, active').order('key'),
    admin.from('template_versions').select('template_key, version, body, created_by, created_at, change_note').order('version'),
    admin.from('garment_types').select('key, label, template_family, template_modules'),
    admin.from('garment_categories').select('key, label, base_template'),
  ]);
  const err = [t, v, g, c].find((r) => r.error)?.error;
  if (err) throw new Error(err.message);
  return { templates: t.data as Row[], versions: v.data as Row[], types: g.data as Row[], categories: c.data as Row[] };
}

/** Where a template is used: the product types and categories that point at it (a kit's parts count too). */
export function usageOf(key: string, d: Awaited<ReturnType<typeof readTemplates>>) {
  const current = (k: string) => { const t = d.templates.find((x) => x.key === k); return d.versions.find((v) => v.template_key === k && v.version === t?.current_version)?.body as TemplateBody | undefined; };
  const kitsUsing = d.templates.filter((t) => t.kind === 'family' && (current(t.key)?.composedOf ?? []).includes(key)).map((t) => t.key);
  return {
    types: d.types.filter((x) => x.template_family === key || (x.template_modules ?? []).includes(key) || kitsUsing.includes(x.template_family)).map((x) => ({ key: x.key, label: x.label })),
    categories: d.categories.filter((x) => x.base_template === key).map((x) => ({ key: x.key, label: x.label })),
    kits: kitsUsing,
  };
}

/** What a new version is checked against: the base templates' field keys and the single (non-kit) families. */
export function validationContext(d: Awaited<ReturnType<typeof readTemplates>>, selfKey: string) {
  const current = (t: Row) => d.versions.find((v) => v.template_key === t.key && v.version === t.current_version)?.body as TemplateBody | undefined;
  return {
    baseKeys: d.templates.filter((t) => t.kind === 'base').flatMap((t) => current(t)?.items.map((i) => i.key) ?? []),
    families: d.templates.filter((t) => t.kind === 'family' && t.key !== selfKey && !current(t)?.composedOf).map((t) => t.key),
  };
}
export const hasDrawing = (key: string) => !!DRAWINGS[key]?.length;
export const recordOf = (t: Row, body: TemplateBody): TemplateRecord => ({ key: t.key, kind: t.kind, label: t.label, description: t.description ?? '', version: t.current_version, active: t.active !== false, body });
