import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { cartView, getDraft, isSubmitting } from '@/lib/quote-cart';
import { readJson } from '@/lib/catalog-route';
import { SPEC_LIMITS } from '@/lib/catalog-families';

// The signed-in customer's own quote cart (2026-11-26). Customers only (reps and admins get 403: carts are private until
// submitted). GET: the lines. PATCH { note }: the cart note.
export async function GET() {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  return NextResponse.json(await cartView(me.admin, me.customer.id));
}

export async function PATCH(req: NextRequest) {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  const body = await readJson(req); if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const raw = body.note === null || body.note === undefined ? '' : body.note;
  if (typeof raw !== 'string') return NextResponse.json({ error: 'The note must be text.' }, { status: 400 });
  const note = raw.trim();
  if (note.length > SPEC_LIMITS.note) return NextResponse.json({ error: `The note is longer than ${SPEC_LIMITS.note} characters.` }, { status: 400 });
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)) return NextResponse.json({ error: 'The note contains characters that cannot be stored.' }, { status: 400 });
  const draft = await getDraft(me.admin, me.customer.id, true);
  if (!draft) return NextResponse.json({ error: 'Could not open your quote cart.' }, { status: 500 });
  if (isSubmitting(draft)) return NextResponse.json({ error: 'Your quote cart is being submitted. Wait a moment, then try again.' }, { status: 409 });
  const { error } = await me.admin.from('quote_drafts').update({ note: note || null }).eq('id', draft.id).eq('customer_id', me.customer.id);
  if (error) return NextResponse.json({ error: 'Could not save the note.' }, { status: 500 });
  return NextResponse.json(await cartView(me.admin, me.customer.id));
}
