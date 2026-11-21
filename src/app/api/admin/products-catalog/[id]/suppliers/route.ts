import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, isId, readJson } from '@/lib/catalog-route';
import { LINK_COLUMNS } from '@/lib/catalog-server';
import { LINK_SPEC, checkFields } from '@/lib/catalog-fields';
import { audit } from '@/lib/audit';

// Link a product to a supplier (2026-11-21, admin only): the supplier's own SKU, MOQ (+ unit) and lead time. No cost or price.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Product not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  if (!isId(body.supplier_id)) return bad('Choose a supplier.');
  const [p, s] = await Promise.all([c.admin.from('products').select('id, code, name').eq('id', id).maybeSingle(), c.admin.from('suppliers').select('id, code, name').eq('id', body.supplier_id).maybeSingle()]);
  if (!p.data) return bad('Product not found.', 404);
  if (!s.data) return bad('Supplier not found.', 404);
  const f = checkFields(LINK_SPEC, body, 'create');
  if (f.errors.length) return bad(f.errors.join(' '));
  const { data, error } = await c.admin.from('product_suppliers').insert({ ...f.values, product_id: id, supplier_id: s.data.id }).select(LINK_COLUMNS).single();
  if (error) return bad(error.code === '23505' ? 'This supplier is already linked to the product.' : error.message, error.code === '23505' ? 409 : 400);
  const audited = await audit(c.admin, c.actor, { action: 'product_supplier.link', table: 'product_suppliers', id: `${id}:${s.data.id}`, route: 'POST /api/admin/products-catalog/[id]/suppliers', after: { product: p.data.code ?? p.data.name, supplier: s.data.name, ...f.values } });
  return NextResponse.json({ link: data, ...audited }, { status: 201 });
}
