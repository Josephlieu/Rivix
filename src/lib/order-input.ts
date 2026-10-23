import { NextResponse } from 'next/server';
import { cleanSizeLabel, sizesToText, totalQty as sumSizes, type SizeQty } from '@/lib/sizes';

// Checks the body of "create an order" and turns it into clean values. Shared by the sales-rep route and the
// admin route, so both enforce exactly the same rules.
export const MAX_ITEMS = 50;
export const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export type OrderItemInput = { product_name: string; quantity: number; sizing: string; size_breakdown: SizeQty[]; branding: string | null; position: number };

export function parseOrderBody(body: Record<string, any>): { error: NextResponse } | { customerId: string; items: OrderItemInput[] } { // eslint-disable-line @typescript-eslint/no-explicit-any
  const fail = (error: string) => ({ error: NextResponse.json({ error }, { status: 400 }) });
  const customerId = String(body.customer_id || '');
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!customerId) return fail('Choose a customer.');
  if (rawItems.length === 0) return fail('Add at least one product.');
  if (rawItems.length > MAX_ITEMS) return fail(`An order can have at most ${MAX_ITEMS} products.`);

  const items: OrderItemInput[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i];
    const name = clean(it?.product_name, 200);
    if (!name) return fail(`Product ${i + 1}: enter a product name.`);

    const rawSizes = Array.isArray(it?.sizes) ? it.sizes : [];
    if (rawSizes.length < 1 || rawSizes.length > 40) {
      return fail(`Product ${i + 1}: enter a quantity for at least one size.`);
    }
    const sizes: SizeQty[] = [];
    const seen = new Set<string>();
    for (const rs of rawSizes) {
      const size = cleanSizeLabel(rs?.size);
      const qty = Number(rs?.qty);
      if (!size) return fail(`Product ${i + 1}: a size is missing its name.`);
      if (!Number.isInteger(qty) || qty < 1 || qty > 1_000_000) {
        return fail(`Product ${i + 1}: size ${size} needs a whole number of at least 1.`);
      }
      if (seen.has(size.toLowerCase())) {
        return fail(`Product ${i + 1}: size ${size} is listed twice.`);
      }
      seen.add(size.toLowerCase());
      sizes.push({ size, qty });
    }

    items.push({
      product_name: name,
      quantity: sumSizes(sizes),
      sizing: sizesToText(sizes).slice(0, 500),
      size_breakdown: sizes,
      branding: clean(it?.branding, 1000) || null,
      position: i,
    });
  }
  return { customerId, items };
}
