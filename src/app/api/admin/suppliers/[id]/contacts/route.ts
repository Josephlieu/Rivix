import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, isId, readJson } from '@/lib/catalog-route';
import { CONTACT_COLUMNS } from '@/lib/catalog-server';
import { CONTACT_SPEC, checkFields } from '@/lib/catalog-fields';
import { audit } from '@/lib/audit';

// A supplier's contacts (2026-11-21, admin only; this table is never read anywhere else). POST adds one; the first contact,
// or one sent with is_primary: true, becomes the primary (the previous primary stays as a contact).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Supplier not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  const { data: s } = await c.admin.from('suppliers').select('id').eq('id', id).maybeSingle();
  if (!s) return bad('Supplier not found.', 404);
  const f = checkFields(CONTACT_SPEC, body, 'create');
  if (f.errors.length) return bad(f.errors.join(' '));
  if (!f.values.contact_name && !f.values.email && !f.values.whatsapp) return bad('Give a name, an email or a WhatsApp number.');
  const { count } = await c.admin.from('supplier_contacts').select('id', { count: 'exact', head: true }).eq('supplier_id', id).eq('is_primary', true);
  const primary = body.is_primary === true || !count;
  if (primary && count) await c.admin.from('supplier_contacts').update({ is_primary: false }).eq('supplier_id', id).eq('is_primary', true);
  const { data, error } = await c.admin.from('supplier_contacts').insert({ ...f.values, supplier_id: id, is_primary: primary }).select(CONTACT_COLUMNS).single();
  if (error) return bad(error.message);
  const audited = await audit(c.admin, c.actor, { action: 'supplier_contact.create', table: 'supplier_contacts', id: data.id, route: 'POST /api/admin/suppliers/[id]/contacts', after: { supplier_id: id, is_primary: primary, ...f.values } });
  return NextResponse.json({ contact: data, ...audited }, { status: 201 });
}
