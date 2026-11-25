import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, readJson } from '@/lib/catalog-route';
import { PRODUCT_COLUMNS, productValues, today } from '@/lib/catalog-server';
import { claimStatus, type CertFacts, type ClaimStatus } from '@/lib/compliance';
import { audit } from '@/lib/audit';
import { auditNames } from '@/lib/catalog-fields';

// Products (2026-11-21, admin only). GET: the list (?q=, ?active=), each with its claims counted by status under the
// certificate rule. POST: a new product. (/api/admin/products is the older product-specs screen.)
export async function GET(req: NextRequest) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  let q = c.admin.from('products').select(PRODUCT_COLUMNS).order('name');
  const active = req.nextUrl.searchParams.get('active');
  if (active === 'true' || active === 'false') q = q.eq('active', active === 'true');
  const [p, cl, ce, cats] = await Promise.all([q, c.admin.from('product_compliance').select('product_id, standard_id, standard:standards(checked)'), c.admin.from('certificates').select('product_id, standard_id, status, expires_on, document_type'), c.admin.from('garment_categories').select('key, label').eq('active', true).order('sort')]);
  if (p.error) return bad('Could not read the products.', 500);
  const term = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  const day = today(), certs = (ce.data ?? []) as CertFacts[];
  const products = (p.data ?? []).filter((x) => !term || String(x.name).toLowerCase().includes(term) || String(x.code ?? '').toLowerCase().includes(term)).map((x) => {
    const counts: Record<ClaimStatus, number> = { compliant: 0, expired: 0, declaration_only: 0, certificate_needed: 0, standard_not_checked: 0 };
    for (const k of (cl.data ?? []).filter((k) => k.product_id === x.id)) counts[claimStatus(k, (k as unknown as { standard: { checked: boolean } }).standard, certs, day)]++;
    return { ...x, claims: counts };
  });
  return NextResponse.json({ products, today: day, categories: cats.data ?? [] });
}

export async function POST(req: NextRequest) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const body = await readJson(req); if (!body) return bad('Bad request');
  const f = await productValues(c.admin, body, false);
  if (f.errors.length) return bad(f.errors.join(' '));
  const { data, error } = await c.admin.from('products').insert(f.values).select(PRODUCT_COLUMNS).single();
  if (error) return bad(error.code === '23505' ? 'There is already a product with this code.' : error.message, error.code === '23505' ? 409 : 400);
  const audited = await audit(c.admin, c.actor, { action: 'product.create', table: 'products', id: data.id, route: 'POST /api/admin/products-catalog', after: auditNames(f.values, 'product_code') });
  return NextResponse.json({ product: data, ...audited }, { status: 201 });
}
