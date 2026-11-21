import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, beforeAfter, isId, readJson } from '@/lib/catalog-route';
import { STANDARD_COLUMNS } from '@/lib/catalog-server';
import { STANDARD_SPEC, checkFields } from '@/lib/catalog-fields';
import { audit } from '@/lib/audit';

// Edit a standard or remove it (2026-11-21, admin only). The designation, standard and edition are fixed once a certificate
// refers to it (add the new edition as its own row). Delete is refused while claims or certificates refer to it.
type P = { params: Promise<{ id: string }> };
export async function PATCH(req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Standard not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  const { data: before } = await c.admin.from('standards').select(STANDARD_COLUMNS).eq('id', id).maybeSingle();
  if (!before) return bad('Standard not found.', 404);
  const f = checkFields(STANDARD_SPEC, body, 'update');
  if (f.errors.length) return bad(f.errors.join(' '));
  if (['designation', 'standard', 'edition'].some((k) => k in f.values && f.values[k] !== (before as Record<string, unknown>)[k])) {
    const { count } = await c.admin.from('certificates').select('id', { count: 'exact', head: true }).eq('standard_id', id);
    if ((count ?? 0) > 0) return bad('Certificates refer to this standard edition, so its name and edition cannot change. Add the other edition as its own standard.', 409);
  }
  if (typeof body.checked === 'boolean' && body.checked !== before.checked) {
    f.values.checked = body.checked;
    f.values.checked_by_email = body.checked ? c.who.email : null;
    const merged = { ...before, ...f.values };
    if (body.checked && (!merged.standard || !merged.edition || !merged.checked_on)) return bad('To mark a standard as checked, give the standard, the edition and the date checked.');
  }
  const d = beforeAfter(before, f.values);
  if (!d.changed) return NextResponse.json({ standard: before, changed: false });
  const { data, error } = await c.admin.from('standards').update(d.after).eq('id', id).select(STANDARD_COLUMNS).single();
  if (error) return bad(error.code === '23505' ? 'This standard and edition is already in the reference.' : error.message, error.code === '23505' ? 409 : 400);
  const audited = await audit(c.admin, c.actor, { action: 'standard.edit', table: 'standards', id, route: 'PATCH /api/admin/standards/[id]', before: d.before, after: d.after });
  return NextResponse.json({ standard: data, changed: true, ...audited });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Standard not found.', 404);
  const { data: s } = await c.admin.from('standards').select('id, designation').eq('id', id).maybeSingle();
  if (!s) return bad('Standard not found.', 404);
  const [cl, ce] = await Promise.all([
    c.admin.from('product_compliance').select('id', { count: 'exact', head: true }).eq('standard_id', id),
    c.admin.from('certificates').select('id', { count: 'exact', head: true }).eq('standard_id', id),
  ]);
  if ((cl.count ?? 0) + (ce.count ?? 0) > 0) return bad(`${cl.count ?? 0} claim(s) and ${ce.count ?? 0} certificate(s) refer to this standard; it cannot be deleted.`, 409);
  const { error } = await c.admin.from('standards').delete().eq('id', id);
  if (error) return bad(error.message, 500);
  const audited = await audit(c.admin, c.actor, { action: 'standard.delete', table: 'standards', id, route: 'DELETE /api/admin/standards/[id]', before: { designation: s.designation }, after: null });
  return NextResponse.json({ ok: true, ...audited });
}
