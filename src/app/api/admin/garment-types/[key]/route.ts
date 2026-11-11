import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { recordCatalogChange, NOT_RECORDED } from '@/lib/catalog-log';
import { cleanText } from '@/lib/template-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { clearGarmentCache, loadGarmentLibrary } from '@/lib/garment-types';
import { getTemplateCatalog, clearTemplateCache } from '@/lib/template-store';

// Rename a type, move it to another category, switch it on or off, or move it up or down inside its category.
// Types are never deleted: older requests keep their type. Switching one off only hides it from the new-request form.
// Task 31: two-step admins only; add-ons (templateModules) can be changed too; every change is recorded. A change of template
// applies to new tech files; existing ones keep the template versions they were made with.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const { key } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const admin = createAdminClient();
  const lib = await loadGarmentLibrary(admin);
  if (!lib.fromDatabase) return NextResponse.json({ error: 'The garment library is not set up on this database yet. Run dev-patch-garment-types.sql first.' }, { status: 409 });
  const type = lib.types.find((t) => t.key === key);
  if (!type) return NextResponse.json({ error: 'Garment type not found.' }, { status: 404 });

  const update: Record<string, unknown> = {};
  const changes: string[] = [];
  const catalog = await getTemplateCatalog(admin);
  if ('label' in body) {
    const label = cleanText(body.label, 80);
    if (!label) return NextResponse.json({ error: 'The name cannot be empty.' }, { status: 400 });
    if (lib.types.some((t) => t.key !== key && t.label.toLowerCase() === label.toLowerCase())) return NextResponse.json({ error: 'There is already a garment type with that name.' }, { status: 409 });
    if (label !== type.label) { update.label = label; changes.push(`Name: "${type.label}" → "${label}"`); }
  }
  if ('category' in body) {
    if (!lib.categories.some((c) => c.key === body.category)) return NextResponse.json({ error: 'Choose a category.' }, { status: 400 });
    if (body.category !== type.category) { update.category = body.category; changes.push(`Category: ${type.category} → ${body.category}`); }
  }
  if ('active' in body && Boolean(body.active) !== type.active) { update.active = Boolean(body.active); changes.push(body.active ? 'Switched on' : 'Switched off'); }
  if ('templateFamily' in body) {
    const family = String(body.templateFamily ?? '');
    if (family && !catalog.templates.some((t) => t.kind === 'family' && t.key === family && t.active)) return NextResponse.json({ error: 'Choose a template from the list.' }, { status: 400 });
    if ((family || null) !== (type.templateFamily ?? null)) { update.template_family = family || null; changes.push(`Template: ${type.templateFamily || 'general'} → ${family || 'general'}`); }
  }
  if ('templateModules' in body) {
    const modules: string[] = Array.isArray(body.templateModules) ? Array.from(new Set(body.templateModules.map(String))) : [];
    if (modules.some((m) => !catalog.templates.some((t) => t.kind === 'module' && t.key === m && t.active))) return NextResponse.json({ error: 'Choose add-ons from the list.' }, { status: 400 });
    const before = catalog.types[key]?.modules ?? [];
    if (modules.join() !== before.join()) { update.template_modules = modules; changes.push(`Add-ons: ${before.join(', ') || 'none'} → ${modules.join(', ') || 'none'}`); }
  }

  if (body.move === 'up' || body.move === 'down') {
    const mates = lib.types.filter((t) => t.category === (update.category ?? type.category)).sort((a, b) => a.sort - b.sort);
    const i = mates.findIndex((t) => t.key === key);
    const other = mates[body.move === 'up' ? i - 1 : i + 1];
    if (other) {
      const { error } = await admin.from('garment_types').update({ sort: other.sort, updated_at: new Date().toISOString() }).eq('key', key);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await admin.from('garment_types').update({ sort: type.sort, updated_at: new Date().toISOString() }).eq('key', other.key);
    }
  }

  if (Object.keys(update).length) {
    const { error } = await admin.from('garment_types').update({ ...update, updated_at: new Date().toISOString() }).eq('key', key);
    if (error && /template_family/.test(error.message)) return NextResponse.json({ error: 'Template choice is not set up yet. Run dev-patch-garment-families.sql in the Supabase SQL Editor first.' }, { status: 409 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  clearGarmentCache();
  clearTemplateCache(); // a type's family or category feeds the template catalog
  if (body.move === 'up' || body.move === 'down') changes.push(`Moved ${body.move}`);
  const ok = !changes.length || await recordCatalogChange(admin, who, { kind: 'type', key, action: changes.length === 1 ? changes[0].split(':')[0].toLowerCase() : 'changed', changes });
  return NextResponse.json({ ok: true, ...(ok ? {} : { warning: NOT_RECORDED }) });
}
