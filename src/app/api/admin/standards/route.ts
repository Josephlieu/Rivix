import { NextResponse } from 'next/server';
import { adminCtx, bad, readJson } from '@/lib/catalog-route';
import { STANDARD_COLUMNS } from '@/lib/catalog-server';
import { STANDARD_SPEC, checkFields } from '@/lib/catalog-fields';
import { audit } from '@/lib/audit';

// The standards reference (2026-11-21, admin only, editable). Each row is ONE edition, written in full ("EN 388:2016+A1:2018")
// and matched ignoring case and spaces. A new standard starts unchecked; marking it checked needs the standard, the edition,
// the date checked (and records who).
export async function GET() {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const [s, cl, ce] = await Promise.all([
    c.admin.from('standards').select(STANDARD_COLUMNS).order('designation'),
    c.admin.from('product_compliance').select('standard_id'),
    c.admin.from('certificates').select('standard_id'),
  ]);
  if (s.error) return bad('Could not read the standards.', 500);
  const n = (rows: Array<{ standard_id: string }> | null, id: string) => (rows ?? []).filter((r) => r.standard_id === id).length;
  return NextResponse.json({ standards: (s.data ?? []).map((x) => ({ ...x, claimCount: n(cl.data, x.id), certificateCount: n(ce.data, x.id) })) });
}

export async function POST(req: Request) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const body = await readJson(req); if (!body) return bad('Bad request');
  const f = checkFields(STANDARD_SPEC, body, 'create');
  if (f.errors.length) return bad(f.errors.join(' '));
  const checked = body.checked === true;
  if (checked && (!f.values.standard || !f.values.edition || !f.values.checked_on)) return bad('To mark a standard as checked, give the standard, the edition and the date checked.');
  const row = { ...f.values, checked, checked_by_email: checked ? c.who.email : null };
  const { data, error } = await c.admin.from('standards').insert(row).select(STANDARD_COLUMNS).single();
  if (error) return bad(error.code === '23505' ? 'This standard and edition is already in the reference.' : error.message, error.code === '23505' ? 409 : 400);
  const audited = await audit(c.admin, c.actor, { action: 'standard.create', table: 'standards', id: data.id, route: 'POST /api/admin/standards', after: row });
  return NextResponse.json({ standard: data, ...audited }, { status: 201 });
}
