'use client';

import { Plus, X } from 'lucide-react';
import { STANDARD_SIZES } from '@/lib/sizes';

export interface SizeGridValue {
  standard: Record<string, string>;      // size -> quantity typed
  custom: { label: string; qty: string }[]; // e.g. 32 / One size
}

export const emptySizeGrid = (): SizeGridValue => ({ standard: {}, custom: [] });

export const gridTotal = (v: SizeGridValue) =>
  Object.values(v.standard).reduce((n, q) => n + (parseInt(q, 10) || 0), 0) +
  v.custom.reduce((n, c) => n + (parseInt(c.qty, 10) || 0), 0);

// The list the API expects: [{ size, qty }], standard sizes first, in order.
export const gridToSizes = (v: SizeGridValue) => [
  ...STANDARD_SIZES.filter((s) => (parseInt(v.standard[s], 10) || 0) > 0).map((s) => ({ size: s, qty: parseInt(v.standard[s], 10) })),
  ...v.custom
    .filter((c) => c.label.trim() && (parseInt(c.qty, 10) || 0) > 0)
    .map((c) => ({ size: c.label.trim(), qty: parseInt(c.qty, 10) })),
];

const box =
  'w-full px-2 py-2.5 bg-slate-50 border-none rounded-xl text-sm text-center focus:ring-2 focus:ring-rivix/20 outline-none font-semibold placeholder:text-slate-300';

export default function SizeGrid({ value, onChange }: { value: SizeGridValue; onChange: (v: SizeGridValue) => void }) {
  const total = gridTotal(value);

  const setStd = (size: string, q: string) => {
    const digits = q.replace(/\D/g, '').slice(0, 7);
    onChange({ ...value, standard: { ...value.standard, [size]: digits } });
  };
  const setCustom = (i: number, patch: Partial<{ label: string; qty: string }>) =>
    onChange({
      ...value,
      custom: value.custom.map((c, idx) => (idx === i ? { ...c, ...patch, ...(patch.qty !== undefined ? { qty: patch.qty.replace(/\D/g, '').slice(0, 7) } : {}) } : c)),
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {STANDARD_SIZES.map((s) => (
          <div key={s} className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{s}</p>
            <input
              inputMode="numeric"
              aria-label={`Quantity for size ${s}`}
              className={box}
              value={value.standard[s] || ''}
              onChange={(e) => setStd(s, e.target.value)}
              placeholder="0"
            />
          </div>
        ))}
      </div>

      {value.custom.map((c, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custom size</p>
            <input
              className={`${box} !text-left px-4`}
              value={c.label}
              maxLength={30}
              onChange={(e) => setCustom(i, { label: e.target.value })}
              placeholder="e.g. 34, One size"
              aria-label="Custom size name"
            />
          </div>
          <div className="w-28 space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</p>
            <input inputMode="numeric" className={box} value={c.qty} onChange={(e) => setCustom(i, { qty: e.target.value })} placeholder="0" aria-label="Custom size quantity" />
          </div>
          <button type="button" onClick={() => onChange({ ...value, custom: value.custom.filter((_, idx) => idx !== i) })} className="p-2.5 text-slate-400 hover:text-red-500" aria-label="Remove custom size">
            <X size={16} />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onChange({ ...value, custom: [...value.custom, { label: '', qty: '' }] })} className="text-xs font-bold text-rivix hover:underline inline-flex items-center gap-1.5">
          <Plus size={14} />Custom size (numbers, one size…)
        </button>
        <p className="text-sm font-bold text-slate-700">
          Total: <span className={total > 0 ? 'text-slate-900' : 'text-slate-300'}>{total}</span>
        </p>
      </div>
    </div>
  );
}
