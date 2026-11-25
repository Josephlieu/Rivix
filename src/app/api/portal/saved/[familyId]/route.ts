import { NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { isId } from '@/lib/catalog-route';

// Remove a family from the signed-in customer's OWN saved list (2026-11-26). Only this customer's row can ever be removed.
export async function DELETE(_req: Request, { params }: { params: Promise<{ familyId: string }> }) {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  const { familyId } = await params;
  if (!isId(familyId)) return NextResponse.json({ error: 'Not in your saved list.' }, { status: 404 });
  const { data } = await me.admin.from('saved_families').delete().eq('customer_id', me.customer.id).eq('family_id', familyId).select('family_id');
  if (!data?.length) return NextResponse.json({ error: 'Not in your saved list.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
