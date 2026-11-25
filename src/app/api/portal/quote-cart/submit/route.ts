import { NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { submitCart } from '@/lib/quote-cart';

// Submit the signed-in customer's own cart as ONE quote request (2026-11-26). Atomic: see submitCart in quote-cart.ts.
// The customer's rep (or every admin) gets one notification and the email (dry run in tests).
export async function POST() {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  const r = await submitCart(me.admin, me.customer);
  if (r.status >= 400) return NextResponse.json({ error: r.error, ...('code' in r && r.code ? { code: r.code } : {}) }, { status: r.status });
  return NextResponse.json({ request: r.request, handledBy: r.handledBy, handlerEmail: r.handlerEmail }, { status: 201 });
}
