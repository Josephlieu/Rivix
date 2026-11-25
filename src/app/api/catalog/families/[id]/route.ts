import { NextResponse } from 'next/server';
import { catalogViewer, loadSettings, publishedFamily } from '@/lib/catalog-public';
import { isId } from '@/lib/catalog-route';

// One published family (2026-11-26). Unpublished, switched off and unknown families all answer the same 404.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await catalogViewer(); if ('denied' in v) return v.denied;
  const { id } = await params;
  if (!isId(id)) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  const [family, s, savedRow] = await Promise.all([
    publishedFamily(v.admin, id), loadSettings(v.admin),
    v.kind === 'customer' ? v.admin.from('saved_families').select('family_id').eq('customer_id', v.customer.id).eq('family_id', id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!family) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  const saved = Boolean(savedRow.data);
  return NextResponse.json({ family, settings: { min_order_qty: s.min_order_qty, note_below_qty: s.note_below_qty }, saved, viewer: v.kind });
}
