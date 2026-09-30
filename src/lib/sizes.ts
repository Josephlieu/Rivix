export const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] as const;

export interface SizeQty {
  size: string;
  qty: number;
}

export const cleanSizeLabel = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);

// "M x10, L x25" — the readable summary kept in order_items.sizing
export const sizesToText = (sizes: SizeQty[]) => sizes.map((s) => `${s.size} x${s.qty}`).join(', ');

export const totalQty = (sizes: SizeQty[]) => sizes.reduce((n, s) => n + s.qty, 0);
