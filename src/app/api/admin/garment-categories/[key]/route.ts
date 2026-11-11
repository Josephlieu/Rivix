import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { clearGarmentCache, loadGarmentLibrary } from '@/lib/garment-types';
import { clearTemplateCache, getTemplateCatalog } from '@/lib/template-store';
import { recordCatalogChange, NOT_RECORDED } from '@/lib/catalog-log';
import { cleanText } from '@/lib/template-admin';

// Task 31: rename a category, change its base template, or switch it off or on (two-step admins only). Never deleted: a
// category that is off is not offered for new requests; its types and requests keep working. Every change is recorded.
// A base template change applies to new tech files; existing ones keep the template versions they were made with.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const { key } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const admin = createAdminClient();
  const lib = await loadGarmentLibrary(admin);
  const cat = lib.categories.find((c) => c.key === key);
  if (!cat) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
  const update: Record<string, unknown> = {};
  const changes: string[] = [];
  if ('label' in body) {
    const label = cleanText(body.label, 80);
    if (!label) return NextResponse.json({ error: 'The name cannot be empty.' }, { status: 400 });
    if (lib.categories.some((c) => c.key !== key && c.label.toLowerCase() === label.toLowerCase())) return NextResponse.json({ error: 'There is already a category with that name.' }, { status: 409 });
    if (label !== cat.label) { update.label = label; changes.push(`Name: "${cat.label}" → "${label}"`); }
  }
  if ('baseTemplate' in body) {
    const base = String(body.baseTemplate ?? '');
    if (!(await getTemplateCatalog(admin)).templates.some((t) => t.kind === 'base' && t.key === base)) return NextResponse.json({ error: 'Choose a base template from the list.' }, { status: 400 });
    if (base !== (cat.baseTemplate ?? 'garment-base')) { update.base_template = base; changes.push(`Base template: ${cat.baseTemplate ?? 'garment-base'} → ${base}`); }
  }
  if ('active' in body) {
    const active = body.active === true;
    if (active !== (cat.active !== false)) { update.active = active; changes.push(active ? 'Switched on' : 'Switched off (not offered for new requests; its types and requests keep working)'); }
  }
  if (!changes.length) return NextResponse.json({ ok: true, unchanged: true });
  const { error } = await admin.from('garment_categories').update(update).eq('key', key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  clearGarmentCache(); clearTemplateCache();
  const ok = await recordCatalogChange(admin, who, { kind: 'category', key, action: 'active' in update ? (update.active ? 'switched on' : 'switched off') : 'label' in update ? 'renamed' : 'changed base template', changes });
  return NextResponse.json({ ok: true, ...(ok ? {} : { warning: NOT_RECORDED }) });
}
