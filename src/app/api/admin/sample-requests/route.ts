import { NextResponse } from 'next/server';
import { adminCtx } from '@/lib/catalog-route';
import { listSamples } from '@/lib/sample-requests';

// Every customer's sample requests, newest first (2026-11-26). Two-step admins only.
export async function GET() {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  return NextResponse.json({ samples: await listSamples(c.admin, {}) });
}
