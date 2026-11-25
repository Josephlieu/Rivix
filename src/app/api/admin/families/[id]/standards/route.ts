import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, isId, readJson } from '@/lib/catalog-route';
import { audit } from '@/lib/audit';

// List a standard a family can be made to (2026-11-26, two-step admins): { standard_id }. Customers see it ONLY while an
// active product linked to the family holds a Compliant claim for that exact edition (catalog-public.ts backedByFamily).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Family not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  if (!isId(body.standard_id)) return bad('Choose a standard.');
  const [f, s] = await Promise.all([c.admin.from('product_families').select('id, code').eq('id', id).maybeSingle(), c.admin.from('standards').select('id, designation').eq('id', body.standard_id).maybeSingle()]);
  if (!f.data || !s.data) return bad('Family or standard not found.', 404);
  const { error } = await c.admin.from('family_standards').insert({ family_id: id, standard_id: s.data.id });
  if (error) return error.code === '23505' ? bad('This standard is already listed.', 409) : bad(error.message);
  const audited = await audit(c.admin, c.actor, { action: 'family_standard.add', table: 'family_standards', id: `${id}:${s.data.id}`, route: 'POST /api/admin/families/[id]/standards', after: { family_code: f.data.code, standard: s.data.designation } });
  return NextResponse.json({ ok: true, ...audited }, { status: 201 });
}
