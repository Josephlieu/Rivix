import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, beforeAfter, isId, readJson } from '@/lib/catalog-route';
import { LINK_COLUMNS } from '@/lib/catalog-server';
import { LINK_SPEC, checkFields } from '@/lib/catalog-fields';
import { audit } from '@/lib/audit';

// Edit or remove a product-supplier link (2026-11-21, admin only).
type P = { params: Promise<{ id: string; supplierId: string }> };
export async function PATCH(req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id, supplierId } = await params; if (!isId(id) || !isId(supplierId)) return bad('Link not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  const { data: before } = await c.admin.from('product_suppliers').select(LINK_COLUMNS).eq('product_id', id).eq('supplier_id', supplierId).maybeSingle();
  if (!before) return bad('Link not found.', 404);
  const f = checkFields(LINK_SPEC, body, 'update');
  if (f.errors.length) return bad(f.errors.join(' '));
  const d = beforeAfter(before, f.values);
  if (!d.changed) return NextResponse.json({ link: before, changed: false });
  const { data, error } = await c.admin.from('product_suppliers').update(d.after).eq('product_id', id).eq('supplier_id', supplierId).select(LINK_COLUMNS).single();
  if (error) return bad(error.message);
  const audited = await audit(c.admin, c.actor, { action: 'product_supplier.edit', table: 'product_suppliers', id: `${id}:${supplierId}`, route: 'PATCH /api/admin/products-catalog/[id]/suppliers/[supplierId]', before: d.before, after: d.after });
  return NextResponse.json({ link: data, changed: true, ...audited });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id, supplierId } = await params; if (!isId(id) || !isId(supplierId)) return bad('Link not found.', 404);
  const { data: before } = await c.admin.from('product_suppliers').select(LINK_COLUMNS).eq('product_id', id).eq('supplier_id', supplierId).maybeSingle();
  if (!before) return bad('Link not found.', 404);
  const { error } = await c.admin.from('product_suppliers').delete().eq('product_id', id).eq('supplier_id', supplierId);
  if (error) return bad(error.message, 500);
  const audited = await audit(c.admin, c.actor, { action: 'product_supplier.unlink', table: 'product_suppliers', id: `${id}:${supplierId}`, route: 'DELETE /api/admin/products-catalog/[id]/suppliers/[supplierId]', before: { supplier_sku: before.supplier_sku, moq: before.moq, moq_unit: before.moq_unit, lead_time_days: before.lead_time_days }, after: null });
  return NextResponse.json({ ok: true, ...audited });
}
