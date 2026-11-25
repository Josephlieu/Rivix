import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { addLine } from '@/lib/quote-cart';
import { readJson } from '@/lib/catalog-route';

// Add a line to the signed-in customer's own cart (2026-11-26): { family_id, spec, sizes } (or { quantity } for a family
// without sizes). The family must be published; the spec and sizes are checked; below the minimum is refused; below the
// note level gets a gentle note. At most 25 lines (also enforced by the database).
export async function POST(req: NextRequest) {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  const body = await readJson(req); if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const r = await addLine(me.admin, me.customer.id, body);
  if (r.status >= 400) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ line: r.line, note: r.note }, { status: 201 });
}
