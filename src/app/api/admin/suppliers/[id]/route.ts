import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, beforeAfter, isId, readJson } from '@/lib/catalog-route';
import { CONTACT_COLUMNS, LINK_COLUMNS, SUPPLIER_COLUMNS } from '@/lib/catalog-server';
import { SUPPLIER_SPEC, checkFields } from '@/lib/catalog-fields';
import { audit } from '@/lib/audit';

// One supplier (2026-11-21, admin only): details, contacts (admin-only table) and the products it supplies. PATCH edits it
// (a blank field is left as it is; the code never changes). DELETE is refused while it is linked to products: switch it off.
type P = { params: Promise<{ id: string }> };
export async function GET(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Supplier not found.', 404);
  const [s, ct, l] = await Promise.all([
    c.admin.from('suppliers').select(SUPPLIER_COLUMNS).eq('id', id).maybeSingle(),
    c.admin.from('supplier_contacts').select(CONTACT_COLUMNS).eq('supplier_id', id).order('is_primary', { ascending: false }).order('created_at'),
    c.admin.from('product_suppliers').select(`${LINK_COLUMNS}, product:products(id, code, name, active)`).eq('supplier_id', id),
  ]);
  if (!s.data) return bad('Supplier not found.', 404);
  return NextResponse.json({ supplier: s.data, contacts: ct.data ?? [], products: l.data ?? [] });
}

export async function PATCH(req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Supplier not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  if ('code' in body) return bad('The supplier code is chosen by the system and never changes.');
  const { data: before } = await c.admin.from('suppliers').select(SUPPLIER_COLUMNS).eq('id', id).maybeSingle();
  if (!before) return bad('Supplier not found.', 404);
  const f = checkFields(SUPPLIER_SPEC, body, 'update');
  if (f.errors.length) return bad(f.errors.join(' '));
  const d = beforeAfter(before, f.values);
  if (!d.changed) return NextResponse.json({ supplier: before, changed: false });
  const { data, error } = await c.admin.from('suppliers').update(d.after).eq('id', id).select(SUPPLIER_COLUMNS).single();
  if (error) return bad(error.code === '23505' ? 'There is already a supplier with this name.' : error.message, error.code === '23505' ? 409 : 400);
  const audited = await audit(c.admin, c.actor, { action: 'supplier.edit', table: 'suppliers', id, route: 'PATCH /api/admin/suppliers/[id]', before: d.before, after: d.after });
  return NextResponse.json({ supplier: data, changed: true, ...audited });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Supplier not found.', 404);
  const { data: s } = await c.admin.from('suppliers').select('id, code, name').eq('id', id).maybeSingle();
  if (!s) return bad('Supplier not found.', 404);
  const { count } = await c.admin.from('product_suppliers').select('product_id', { count: 'exact', head: true }).eq('supplier_id', id);
  if ((count ?? 0) > 0) return bad(`This supplier is linked to ${count} product${count === 1 ? '' : 's'}. Switch it off (inactive) instead of deleting it.`, 409);
  const { error } = await c.admin.from('suppliers').delete().eq('id', id);
  if (error) return bad(error.message, 500);
  const audited = await audit(c.admin, c.actor, { action: 'supplier.delete', table: 'suppliers', id, route: 'DELETE /api/admin/suppliers/[id]', before: { supplier_code: s.code, name: s.name }, after: null });
  return NextResponse.json({ ok: true, ...audited });
}
