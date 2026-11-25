import { NextResponse } from 'next/server';
import { catalogViewer, loadSettings } from '@/lib/catalog-public';

// The customer minimum per line and the gentle-note level (2026-11-26). Any signed-in catalogue viewer.
export async function GET() {
  const v = await catalogViewer(); if ('denied' in v) return v.denied;
  const s = await loadSettings(v.admin);
  return NextResponse.json({ settings: { min_order_qty: s.min_order_qty, note_below_qty: s.note_below_qty } });
}
