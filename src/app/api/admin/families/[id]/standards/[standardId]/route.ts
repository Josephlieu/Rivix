import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, isId } from '@/lib/catalog-route';
import { audit } from '@/lib/audit';

// Remove a standard from a family's list (2026-11-26, two-step admins).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; standardId: string }> }) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id, standardId } = await params; if (!isId(id) || !isId(standardId)) return bad('Not found.', 404);
  const { data } = await c.admin.from('family_standards').delete().eq('family_id', id).eq('standard_id', standardId).select('family_id, standard:standards(designation), family:product_families(code)');
  if (!data?.length) return bad('Not found.', 404);
  const x = data[0] as unknown as { standard: { designation: string } | null; family: { code: string } | null };
  const audited = await audit(c.admin, c.actor, { action: 'family_standard.remove', table: 'family_standards', id: `${id}:${standardId}`, route: 'DELETE /api/admin/families/[id]/standards/[standardId]', before: { family_code: x.family?.code ?? null, standard: x.standard?.designation ?? null }, after: null });
  return NextResponse.json({ ok: true, ...audited });
}
