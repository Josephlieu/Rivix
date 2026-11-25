import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { checkLine, isSubmitting, ownLine } from '@/lib/quote-cart';
import { publishedFamily } from '@/lib/catalog-public';
import { isId, readJson } from '@/lib/catalog-route';

// One line of the signed-in customer's own cart (2026-11-26). Another customer's line answers exactly like a line that does
// not exist (404). PATCH { spec?, sizes? | quantity? }: re-checked against the published family and the minimum. DELETE.
type P = { params: Promise<{ lineId: string }> };
const notFound = () => NextResponse.json({ error: 'Line not found.' }, { status: 404 });

export async function PATCH(req: NextRequest, { params }: P) {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  const { lineId } = await params; if (!isId(lineId)) return notFound();
  const body = await readJson(req); if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const own = await ownLine(me.admin, me.customer.id, lineId); if (!own) return notFound();
  if (isSubmitting(own.draft)) return NextResponse.json({ error: 'Your quote cart is being submitted. Wait a moment, then try again.' }, { status: 409 });
  const family = await publishedFamily(me.admin, own.line.family_id);
  if (!family) return NextResponse.json({ error: 'This product is no longer available. Remove it from your quote cart.' }, { status: 409 });
  const chk = await checkLine(me.admin, family, { spec: 'spec' in body ? body.spec : { ...own.line.spec, options: Object.fromEntries((own.line.spec.options ?? []).map((o) => [o.label, o.value])) }, sizes: 'sizes' in body ? body.sizes : own.line.sizes, quantity: body.quantity });
  if ('error' in chk) return NextResponse.json({ error: chk.error }, { status: 400 });
  const { error } = await me.admin.from('quote_draft_lines').update({ spec: chk.spec, sizes: chk.sizes }).eq('id', lineId).eq('draft_id', own.draft.id);
  if (error) return NextResponse.json({ error: 'Could not save the line.' }, { status: 500 });
  return NextResponse.json({ ok: true, note: chk.note });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  const { lineId } = await params; if (!isId(lineId)) return notFound();
  const own = await ownLine(me.admin, me.customer.id, lineId); if (!own) return notFound();
  if (isSubmitting(own.draft)) return NextResponse.json({ error: 'Your quote cart is being submitted. Wait a moment, then try again.' }, { status: 409 });
  const { data } = await me.admin.from('quote_draft_lines').delete().eq('id', lineId).eq('draft_id', own.draft.id).select('id');
  if (!data?.length) return notFound();
  return NextResponse.json({ ok: true });
}
