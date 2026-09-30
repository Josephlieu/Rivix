import type { SizeQty } from '@/lib/sizes';

// Read-only display of an item's sizes. Older orders only have the free-text
// `sizing`, so that's shown when there's no structured breakdown.
export default function SizeBreakdown({ sizes, fallbackText }: { sizes?: SizeQty[] | null; fallbackText?: string | null }) {
  if (sizes && sizes.length > 0) {
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        {sizes.map((s) => (
          <span key={s.size} className="inline-flex items-center gap-1.5 bg-slate-50 rounded-lg px-2.5 py-1 text-xs">
            <span className="font-black text-slate-500 uppercase">{s.size}</span>
            <span className="font-bold text-slate-900">{s.qty}</span>
          </span>
        ))}
      </div>
    );
  }
  return fallbackText ? <p className="text-slate-500">Sizing: {fallbackText}</p> : null;
}
