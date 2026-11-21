import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, beforeAfter, isId, readJson } from '@/lib/catalog-route';
import { CLAIM_COLUMNS } from '@/lib/catalog-server';
import { CLAIM_SPEC, checkFields } from '@/lib/catalog-fields';
import { audit } from '@/lib/audit';

// Edit a claim's protection type and class, or remove the claim (2026-11-21, admin only). The standard of a claim never
// changes: remove it and claim the other edition.
type P = { params: Promise<{ id: string; claimId: string }> };
export async function PATCH(req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id, claimId } = await params; if (!isId(id) || !isId(claimId)) return bad('Claim not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  if ('standard_id' in body) return bad('A claim keeps its standard: remove it and claim the other edition.');
  const { data: before } = await c.admin.from('product_compliance').select(CLAIM_COLUMNS).eq('id', claimId).eq('product_id', id).maybeSingle();
  if (!before) return bad('Claim not found.', 404);
  const f = checkFields(CLAIM_SPEC, body, 'update');
  if (f.errors.length) return bad(f.errors.join(' '));
  const d = beforeAfter(before, f.values);
  if (!d.changed) return NextResponse.json({ claim: before, changed: false });
  const { data, error } = await c.admin.from('product_compliance').update(d.after).eq('id', claimId).select(CLAIM_COLUMNS).single();
  if (error) return bad(error.message);
  const audited = await audit(c.admin, c.actor, { action: 'compliance.edit', table: 'product_compliance', id: claimId, route: 'PATCH /api/admin/products-catalog/[id]/compliance/[claimId]', before: d.before, after: d.after });
  return NextResponse.json({ claim: data, changed: true, ...audited });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id, claimId } = await params; if (!isId(id) || !isId(claimId)) return bad('Claim not found.', 404);
  const { data: before } = await c.admin.from('product_compliance').select(`${CLAIM_COLUMNS}, standard:standards(designation)`).eq('id', claimId).eq('product_id', id).maybeSingle();
  if (!before) return bad('Claim not found.', 404);
  const { error } = await c.admin.from('product_compliance').delete().eq('id', claimId);
  if (error) return bad(error.message, 500);
  const audited = await audit(c.admin, c.actor, { action: 'compliance.remove', table: 'product_compliance', id: claimId, route: 'DELETE /api/admin/products-catalog/[id]/compliance/[claimId]', before: { standard: (before as unknown as { standard: { designation: string } }).standard?.designation, protection_type: before.protection_type, protection_class: before.protection_class }, after: null });
  return NextResponse.json({ ok: true, ...audited });
}
