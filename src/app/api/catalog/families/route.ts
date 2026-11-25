import { NextRequest, NextResponse } from 'next/server';
import { catalogViewer, loadSettings, publishedFamilies } from '@/lib/catalog-public';

// The customer catalogue (2026-11-26): published, active product families, grouped by RIVIX category on the page.
// Any signed-in customer, active rep or two-step admin. Customer-safe fields only (catalog-public.ts familyView).
// ?q= matches the name or code; ?category=<key> filters.
export async function GET(req: NextRequest) {
  const v = await catalogViewer(); if ('denied' in v) return v.denied;
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').slice(0, 100), category = (sp.get('category') ?? '').slice(0, 100);
  const [families, cats, settings] = await Promise.all([
    publishedFamilies(v.admin, { q, category: category || undefined }),
    v.admin.from('garment_categories').select('key, label, sort').eq('active', true).order('sort'),
    loadSettings(v.admin),
  ]);
  return NextResponse.json({
    families,
    categories: ((cats.data ?? []) as Array<{ key: string; label: string }>).map((c) => ({ key: c.key, label: c.label })),
    settings: { min_order_qty: settings.min_order_qty, note_below_qty: settings.note_below_qty },
    viewer: v.kind,
  });
}
