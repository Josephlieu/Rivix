import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, isId, readJson } from '@/lib/catalog-route';
import { CLAIM_COLUMNS } from '@/lib/catalog-server';
import { CLAIM_SPEC, checkFields } from '@/lib/catalog-fields';
import { audit } from '@/lib/audit';

// Claim a standard (one exact edition) for a product (2026-11-21, admin only), with its protection type and class. A claim is
// not a verification: it shows "Certificate needed" until an admin verifies an unexpired certificate for it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Product not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  if (!isId(body.standard_id)) return bad('Choose a standard.');
  const [p, s] = await Promise.all([c.admin.from('products').select('id, code, name').eq('id', id).maybeSingle(), c.admin.from('standards').select('id, designation').eq('id', body.standard_id).maybeSingle()]);
  if (!p.data) return bad('Product not found.', 404);
  if (!s.data) return bad('Standard not found.', 404);
  const f = checkFields(CLAIM_SPEC, body, 'create');
  if (f.errors.length) return bad(f.errors.join(' '));
  const { data, error } = await c.admin.from('product_compliance').insert({ ...f.values, product_id: id, standard_id: s.data.id }).select(CLAIM_COLUMNS).single();
  if (error) return bad(error.code === '23505' ? 'This standard is already claimed for the product.' : error.message, error.code === '23505' ? 409 : 400);
  const audited = await audit(c.admin, c.actor, { action: 'compliance.add', table: 'product_compliance', id: data.id, route: 'POST /api/admin/products-catalog/[id]/compliance', after: { product: p.data.code ?? p.data.name, standard: s.data.designation, ...f.values } });
  return NextResponse.json({ claim: data, ...audited }, { status: 201 });
}
