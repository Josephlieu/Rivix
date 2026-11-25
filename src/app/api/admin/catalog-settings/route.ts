import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, readJson } from '@/lib/catalog-route';
import { loadSettings } from '@/lib/catalog-public';
import { checkSettings } from '@/lib/catalog-families';
import { audit } from '@/lib/audit';

// The customer minimum per line (1 to 50: never block above 50) and the gentle-note level (default 300) (2026-11-26).
export async function GET() {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  return NextResponse.json({ settings: await loadSettings(c.admin) });
}
export async function PATCH(req: NextRequest) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const body = await readJson(req); if (!body) return bad('Bad request');
  const before = await loadSettings(c.admin);
  const r = checkSettings(body, before);
  if ('error' in r) return bad(r.error);
  if (r.value.min_order_qty === before.min_order_qty && r.value.note_below_qty === before.note_below_qty) return NextResponse.json({ settings: before, changed: false });
  const { error } = await c.admin.from('catalog_settings').update({ ...r.value, updated_by: c.who.userId, updated_by_email: c.who.email }).eq('id', 1);
  if (error) return bad(error.message);
  const audited = await audit(c.admin, c.actor, { action: 'catalog_settings.edit', table: 'catalog_settings', id: 1, route: 'PATCH /api/admin/catalog-settings', before: { min_order_qty: before.min_order_qty, note_below_qty: before.note_below_qty }, after: r.value });
  return NextResponse.json({ settings: await loadSettings(c.admin), changed: true, ...audited });
}
