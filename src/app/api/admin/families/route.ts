import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, readJson } from '@/lib/catalog-route';
import { FAMILY_ADMIN_COLUMNS, checkFamily } from '@/lib/catalog-families';
import { activeCategoryKeys } from '@/lib/family-admin';
import { audit } from '@/lib/audit';

// Product families (2026-11-26, two-step admins only). GET: every family (published or not) with image and product counts.
// POST: a new family (unpublished until an admin publishes it).
export async function GET() {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const [f, imgs, prods, cats] = await Promise.all([
    c.admin.from('product_families').select(FAMILY_ADMIN_COLUMNS).order('sort').order('name'),
    c.admin.from('family_images').select('family_id'),
    c.admin.from('products').select('family_id').not('family_id', 'is', null),
    activeCategoryKeys(c.admin),
  ]);
  if (f.error) return bad('Could not read the families.', 500);
  const n = (rows: Array<{ family_id: string | null }> | null, id: string) => (rows ?? []).filter((r) => r.family_id === id).length;
  return NextResponse.json({
    families: (f.data ?? []).map((x) => ({ ...x, images: n(imgs.data, x.id as string), products: n(prods.data, x.id as string) })),
    categories: cats,
  });
}

export async function POST(req: NextRequest) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const body = await readJson(req); if (!body) return bad('Bad request');
  const cats = await activeCategoryKeys(c.admin);
  const { values, errors } = checkFamily({ ...body, visible_to_customers: false }, 'create', cats.map((x) => x.key));
  if (errors.length) return bad(errors.join(' '));
  const { data, error } = await c.admin.from('product_families').insert(values).select(FAMILY_ADMIN_COLUMNS).single();
  if (error) return error.code === '23505' ? bad('There is already a family with this code.', 409) : bad(error.message);
  const { code, ...rest } = values;
  const audited = await audit(c.admin, c.actor, { action: 'family.create', table: 'product_families', id: data.id, route: 'POST /api/admin/families', after: { family_code: code, ...rest } });
  return NextResponse.json({ family: data, ...audited }, { status: 201 });
}
