'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ComboInputProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

// A text box with a styled suggestion list underneath. The user can pick a
// suggestion or type anything else (e.g. a carrier that isn't in the list).
export default function ComboInput({ value, onChange, options, placeholder, className = '' }: ComboInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const q = value.trim().toLowerCase();
  const shown = options.filter((o) => !q || o.toLowerCase().includes(q) || o.toLowerCase() === q);
  const list = shown.length ? shown : [];

  return (
    <div className="relative" ref={ref}>
      <input
        className={className}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setOpen((v) => !v)}
        aria-label="Show options"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        <ChevronDown size={16} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && list.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-2 z-30 max-h-56 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-in fade-in zoom-in-95 duration-100">
          {list.map((o) => (
            <li key={o}>
              <button
                type="button"
                onClick={() => { onChange(o); setOpen(false); }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-rivix transition-colors text-left"
              >
                {o}
                {o === value && <Check size={14} className="text-rivix" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
