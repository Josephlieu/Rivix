'use client';
// The locale in the browser (2026-11-27). The root layout provides the customer-side locale; the rep and admin layouts
// provide their own (English for now), so every page gets the right one. Only that locale's messages reach the browser.
import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, type Locale } from './config';
import { translator, type Messages, type T } from './translate';

type Ctx = { selected: Locale; locale: Locale; messages: Messages };
const I18nContext = createContext<Ctx>({ selected: DEFAULT_LOCALE, locale: DEFAULT_LOCALE, messages: {} });

export function I18nProvider({ selected, locale, messages, children }: Ctx & { children: React.ReactNode }) {
  const value = useMemo(() => ({ selected, locale, messages }), [selected, locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
/** The locale this page is drawn in (language and formats). */
export const useLocale = (): Locale => useContext(I18nContext).locale;
/** What the person chose in the switcher (may differ: staff pages stay in English). */
export const useSelectedLocale = (): Locale => useContext(I18nContext).selected;
export function useT(): T {
  const { locale, messages } = useContext(I18nContext);
  return useMemo(() => translator(locale, messages), [locale, messages]);
}
