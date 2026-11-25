import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { publishedFamilies, publishedFamily } from '@/lib/catalog-public';
import { readJson } from '@/lib/catalog-route';

// The signed-in customer's own saved list (2026-11-26). GET: saved families that are still published (customer-safe
// views). POST { family_id }: save a published family (saving twice is fine).
export async function GET() {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  const { data } = await me.admin.from('saved_families').select('family_id, created_at').eq('customer_id', me.customer.id).order('created_at', { ascending: false });
  const ids = (data ?? []).map((r) => r.family_id as string);
  const fams = await publishedFamilies(me.admin, { ids });
  const order = new Map(ids.map((id, i) => [id, i]));
  return NextResponse.json({ families: fams.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) });
}
export async function POST(req: NextRequest) {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  const body = await readJson(req); if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const fam = typeof body.family_id === 'string' ? await publishedFamily(me.admin, body.family_id).catch(() => null) : null;
  if (!fam) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  const { error } = await me.admin.from('saved_families').upsert({ customer_id: me.customer.id, family_id: fam.id }, { onConflict: 'customer_id,family_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: 'Could not save it.' }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
