import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { clearGarmentCache, loadGarmentLibrary } from '@/lib/garment-types';
import { clearTemplateCache, getTemplateCatalog } from '@/lib/template-store';
import { recordCatalogChange, NOT_RECORDED } from '@/lib/catalog-log';
import { cleanText } from '@/lib/template-admin';

// Task 31: add a category (two-step admins only). Categories are never deleted, only switched off. Recorded in the change log.
export async function POST(req: NextRequest) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const body = await req.json().catch(() => null);
  const label = cleanText(body?.label, 80);
  if (!label) return NextResponse.json({ error: 'Give the category a name.' }, { status: 400 });
  const admin = createAdminClient();
  const lib = await loadGarmentLibrary(admin);
  if (!lib.fromDatabase) return NextResponse.json({ error: 'The product library is not set up on this database yet.' }, { status: 409 });
  if (lib.categories.some((c) => c.label.toLowerCase() === label.toLowerCase())) return NextResponse.json({ error: 'There is already a category with that name.' }, { status: 409 });
  const base = String(body?.baseTemplate || 'garment-base');
  if (!(await getTemplateCatalog(admin)).templates.some((t) => t.kind === 'base' && t.key === base)) return NextResponse.json({ error: 'Choose a base template from the list.' }, { status: 400 });
  let key = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'category';
  for (let n = 2; lib.categories.some((c) => c.key === key); n++) key = `${key.replace(/-\d+$/, '')}-${n}`;
  const sort = Math.max(0, ...lib.categories.map((c) => c.sort)) + 10;
  const { error } = await admin.from('garment_categories').insert({ key, label, sort, base_template: base, active: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  clearGarmentCache(); clearTemplateCache();
  const ok = await recordCatalogChange(admin, who, { kind: 'category', key, action: `added category "${label}"`, changes: [`Base template: ${base}`] });
  return NextResponse.json({ ok: true, key, ...(ok ? {} : { warning: NOT_RECORDED }) });
}
