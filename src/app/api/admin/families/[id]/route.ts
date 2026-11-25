import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, beforeAfter, isId, readJson } from '@/lib/catalog-route';
import { FAMILY_ADMIN_COLUMNS, checkFamily } from '@/lib/catalog-families';
import { activeCategoryKeys, familyDetail } from '@/lib/family-admin';
import { audit } from '@/lib/audit';

// One product family (2026-11-26, two-step admins only). GET: details, images, standards (and which ones customers see),
// linked products. PATCH: details, publish (visible_to_customers), active. Publishing is logged as its own action.
// No DELETE: switch a family off (inactive) instead; carts, samples and requests keep pointing at it.
type P = { params: Promise<{ id: string }> };
export async function GET(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Family not found.', 404);
  const d = await familyDetail(c.admin, id);
  if (!d) return bad('Family not found.', 404);
  return NextResponse.json({ ...d, categories: await activeCategoryKeys(c.admin) });
}

export async function PATCH(req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Family not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  const { data: before } = await c.admin.from('product_families').select(FAMILY_ADMIN_COLUMNS).eq('id', id).maybeSingle();
  if (!before) return bad('Family not found.', 404);
  const cats = await activeCategoryKeys(c.admin);
  const { values, errors } = checkFamily(body, 'update', [...cats.map((x) => x.key), String(before.category)]);
  if (errors.length) return bad(errors.join(' '));
  const d = beforeAfter(before, values);
  if (!d.changed) return NextResponse.json({ family: before, changed: false });
  const { data, error } = await c.admin.from('product_families').update(d.after).eq('id', id).select(FAMILY_ADMIN_COLUMNS).single();
  if (error) return error.code === '23505' ? bad('There is already a family with this code.', 409) : bad(error.message);
  // Publishing or hiding is its own audit row; any other changed field is a family.edit row.
  const rename = (o: Record<string, unknown>) => { const { code, ...r } = o; return code === undefined ? r : { family_code: code, ...r }; };
  let audited: { auditWarning?: string } = {};
  if ('visible_to_customers' in d.after) {
    const r = await audit(c.admin, c.actor, { action: d.after.visible_to_customers ? 'family.publish' : 'family.unpublish', table: 'product_families', id, route: 'PATCH /api/admin/families/[id]', before: { visible_to_customers: d.before.visible_to_customers }, after: { visible_to_customers: d.after.visible_to_customers } });
    if (r.auditWarning) audited = r;
  }
  const { visible_to_customers: _v, ...restAfter } = d.after; void _v;
  const { visible_to_customers: _b, ...restBefore } = d.before; void _b;
  if (Object.keys(restAfter).length) {
    const r = await audit(c.admin, c.actor, { action: 'family.edit', table: 'product_families', id, route: 'PATCH /api/admin/families/[id]', before: rename(restBefore), after: rename(restAfter) });
    if (r.auditWarning) audited = r;
  }
  return NextResponse.json({ family: data, changed: true, ...audited });
}
