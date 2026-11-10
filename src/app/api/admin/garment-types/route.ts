import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { clearGarmentCache, loadGarmentLibrary } from '@/lib/garment-types';
import { getTemplateCatalog, clearTemplateCache } from '@/lib/template-store';

const NOT_READY = 'The garment library is not set up on this database yet. Run dev-patch-garment-types.sql in the Supabase SQL Editor first.';

const slug = (label: string) => label.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// Admin adds a garment type (for example when the product range grows). The key is made from the name and never changes afterwards.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const label = String(body?.label ?? '').trim().slice(0, 80);
  const category = String(body?.category ?? '');
  if (!label) return NextResponse.json({ error: 'Type a name for the garment type.' }, { status: 400 });

  const admin = createAdminClient();
  const lib = await loadGarmentLibrary(admin);
  if (!lib.fromDatabase) return NextResponse.json({ error: NOT_READY }, { status: 409 });
  if (!lib.categories.some((c) => c.key === category)) return NextResponse.json({ error: 'Choose a category.' }, { status: 400 });
  if (lib.types.some((t) => t.label.toLowerCase() === label.toLowerCase())) return NextResponse.json({ error: 'There is already a garment type with that name.' }, { status: 409 });

  const base = slug(label) || 'garment';
  let key = base;
  for (let n = 2; lib.types.some((t) => t.key === key); n++) key = `${base}-${n}`;
  const sort = Math.max(0, ...lib.types.map((t) => t.sort)) + 10;
  const family = String(body?.templateFamily ?? '');
  if (family && !(await getTemplateCatalog()).templates.some((t) => t.kind === 'family' && t.key === family)) return NextResponse.json({ error: 'Choose a template from the list.' }, { status: 400 });

  // template_family exists once dev-patch-garment-families.sql has been run; before that the type is added without it.
  const { data, error } = await admin.from('garment_types').insert({ key, label, category, sort, ...(family ? { template_family: family } : {}) }).select('key, label, category, sort, active').single();
  if (error && family && /template_family/.test(error.message)) {
    return NextResponse.json({ error: 'Template choice is not set up yet. Run dev-patch-garment-families.sql in the Supabase SQL Editor first.' }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  clearGarmentCache();
  clearTemplateCache(); // a type's family or category feeds the template catalog
  return NextResponse.json({ type: data }, { status: 201 });
}
