import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, beforeAfter, isId, readJson } from '@/lib/catalog-route';
import { CONTACT_COLUMNS } from '@/lib/catalog-server';
import { CONTACT_SPEC, checkFields } from '@/lib/catalog-fields';
import { audit } from '@/lib/audit';

// Edit or remove one contact (2026-11-21, admin only). is_primary: true makes it the primary contact.
type P = { params: Promise<{ id: string; contactId: string }> };
export async function PATCH(req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id, contactId } = await params; if (!isId(id) || !isId(contactId)) return bad('Contact not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  const { data: before } = await c.admin.from('supplier_contacts').select(CONTACT_COLUMNS).eq('id', contactId).eq('supplier_id', id).maybeSingle();
  if (!before) return bad('Contact not found.', 404);
  const f = checkFields(CONTACT_SPEC, body, 'update');
  if (f.errors.length) return bad(f.errors.join(' '));
  if (body.is_primary === true && !before.is_primary) {
    await c.admin.from('supplier_contacts').update({ is_primary: false }).eq('supplier_id', id).eq('is_primary', true);
    f.values.is_primary = true;
  }
  const d = beforeAfter(before, f.values);
  if (!d.changed) return NextResponse.json({ contact: before, changed: false });
  const { data, error } = await c.admin.from('supplier_contacts').update(d.after).eq('id', contactId).select(CONTACT_COLUMNS).single();
  if (error) return bad(error.message);
  const audited = await audit(c.admin, c.actor, { action: 'supplier_contact.edit', table: 'supplier_contacts', id: contactId, route: 'PATCH /api/admin/suppliers/[id]/contacts/[contactId]', before: d.before, after: d.after });
  return NextResponse.json({ contact: data, changed: true, ...audited });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id, contactId } = await params; if (!isId(id) || !isId(contactId)) return bad('Contact not found.', 404);
  const { data: before } = await c.admin.from('supplier_contacts').select(CONTACT_COLUMNS).eq('id', contactId).eq('supplier_id', id).maybeSingle();
  if (!before) return bad('Contact not found.', 404);
  const { error } = await c.admin.from('supplier_contacts').delete().eq('id', contactId);
  if (error) return bad(error.message, 500);
  const audited = await audit(c.admin, c.actor, { action: 'supplier_contact.delete', table: 'supplier_contacts', id: contactId, route: 'DELETE /api/admin/suppliers/[id]/contacts/[contactId]', before: { contact_name: before.contact_name, email: before.email, whatsapp: before.whatsapp, is_primary: before.is_primary }, after: null });
  return NextResponse.json({ ok: true, ...audited });
}
