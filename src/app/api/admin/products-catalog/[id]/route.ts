import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, beforeAfter, isId, readJson } from '@/lib/catalog-route';
import { LINK_COLUMNS, PRODUCT_COLUMNS, productCompliance, productValues } from '@/lib/catalog-server';
import { audit } from '@/lib/audit';
import { auditNames } from '@/lib/catalog-fields';

// One product (2026-11-21, admin only): details, suppliers, claims with their status (the certificate rule) and certificates.
// DELETE is refused while it has supplier links or certificates: switch it off instead. Its claims go with it.
type P = { params: Promise<{ id: string }> };
export async function GET(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Product not found.', 404);
  const [p, l] = await Promise.all([
    c.admin.from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle(),
    c.admin.from('product_suppliers').select(`${LINK_COLUMNS}, supplier:suppliers(id, code, name, active)`).eq('product_id', id),
  ]);
  if (!p.data) return bad('Product not found.', 404);
  return NextResponse.json({ product: p.data, suppliers: l.data ?? [], ...(await productCompliance(c.admin, id)) });
}

export async function PATCH(req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Product not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  const { data: before } = await c.admin.from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle();
  if (!before) return bad('Product not found.', 404);
  const f = await productValues(c.admin, body, true, before);
  if (f.errors.length) return bad(f.errors.join(' '));
  const d = beforeAfter(before, f.values);
  if (!d.changed) return NextResponse.json({ product: before, changed: false });
  const { data, error } = await c.admin.from('products').update(d.after).eq('id', id).select(PRODUCT_COLUMNS).single();
  if (error) return bad(error.code === '23505' ? 'There is already a product with this code.' : error.message, error.code === '23505' ? 409 : 400);
  const audited = await audit(c.admin, c.actor, { action: 'product.edit', table: 'products', id, route: 'PATCH /api/admin/products-catalog/[id]', before: auditNames(d.before, 'product_code'), after: auditNames(d.after, 'product_code') });
  return NextResponse.json({ product: data, changed: true, ...audited });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Product not found.', 404);
  const { data: p } = await c.admin.from('products').select('id, code, name').eq('id', id).maybeSingle();
  if (!p) return bad('Product not found.', 404);
  const [l, ce] = await Promise.all([
    c.admin.from('product_suppliers').select('supplier_id', { count: 'exact', head: true }).eq('product_id', id),
    c.admin.from('certificates').select('id', { count: 'exact', head: true }).eq('product_id', id),
  ]);
  if ((l.count ?? 0) + (ce.count ?? 0) > 0) return bad(`This product has ${l.count ?? 0} supplier link(s) and ${ce.count ?? 0} certificate(s). Switch it off (inactive) instead of deleting it.`, 409);
  const { error } = await c.admin.from('products').delete().eq('id', id);
  if (error) return bad(error.message, 500);
  const audited = await audit(c.admin, c.actor, { action: 'product.delete', table: 'products', id, route: 'DELETE /api/admin/products-catalog/[id]', before: { product_code: p.code, name: p.name }, after: null });
  return NextResponse.json({ ok: true, ...audited });
}
