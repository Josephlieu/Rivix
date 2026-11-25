import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/session-customer';
import { readJson } from '@/lib/catalog-route';
import { createSample, listSamples } from '@/lib/sample-requests';

// The signed-in customer's own sample requests (2026-11-26). GET: newest first. POST { family_id, spec, quantity, note }.
export async function GET() {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  return NextResponse.json({ samples: await listSamples(me.admin, { customerId: me.customer.id }) });
}
export async function POST(req: NextRequest) {
  const me = await getSessionCustomer(); if ('denied' in me) return me.denied;
  const body = await readJson(req); if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const r = await createSample(me.admin, me.customer, body);
  if (r.status >= 400) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ sample: { id: r.sample!.id, status: r.sample!.status, quantity: r.sample!.quantity }, handledBy: r.handledBy }, { status: 201 });
}
