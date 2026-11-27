'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { LOCALE_LABEL, SIDE_LOCALES, type Locale, type Side } from '@/i18n/config';
import { useSelectedLocale, useT } from '@/i18n/client';

// The language switcher (2026-11-27), top right of every page and the sign-in pages. The labels (CA · EN, QC · FR, US · EN;
// English, 简体中文) are never translated. A region sets only the language and date/number formats; currency, tax and
// prices always come from the account. Staff pages stay in English for now (the note says so).
export default function LanguageSwitcher({ side, className = '' }: { side: Side; className?: string }) {
  const selected = useSelectedLocale();
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const options = SIDE_LOCALES[side];
  const value = options.includes(selected) ? selected : options[0];
  return (
    <label className={`inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 ${className}`} title={side === 'staff' ? t('staff.switcherNote') : t('switcher.label')} data-testid="language-switcher">
      <Globe size={14} aria-hidden="true" />
      <span className="sr-only">{t('switcher.label')}</span>
      <select
        aria-label={t('switcher.label')}
        value={value}
        disabled={busy}
        translate="no"
        onChange={async (e) => {
          const locale = e.target.value as Locale;
          setBusy(true); setFailed(false);
          const r = await fetch('/api/me/locale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale }) }).catch(() => null);
          setBusy(false);
          if (!r || !r.ok) { setFailed(true); return; }
          router.refresh();
        }}
        className="bg-transparent border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-rivix/20"
      >
        {options.map((l) => <option key={l} value={l}>{LOCALE_LABEL[side][l]}</option>)}
      </select>
      {failed && <span role="alert" className="text-red-600">{t('switcher.failed')}</span>}
    </label>
  );
}

/** For the sign-in and other public pages: the switcher pinned to the top-right corner. */
export function CornerLanguageSwitcher({ side }: { side: Side }) {
  return <div className="fixed top-4 right-4 z-40 bg-white/90 rounded-xl px-2 py-1 shadow-sm"><LanguageSwitcher side={side} /></div>;
}
