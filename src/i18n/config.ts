// Languages and regions (2026-11-27, approved). Pure: relative imports only; the tests load this file directly.
//   Customer side: CA·EN (en-CA), QC·FR (fr-CA), US·EN (en-US).   Supplier side: English (en-CA), 简体中文 (zh-CN).
//   Staff (rep and admin) pages: the switcher is shown, but they stay in English for now (en-CA, or en-US formats).
// A region sets ONLY the language and the date/number format. Currency, tax and prices always come from the account.
export const LOCALES = ['en-CA', 'fr-CA', 'en-US', 'zh-CN'] as const;
export type Locale = (typeof LOCALES)[number];
export type Side = 'customer' | 'staff' | 'supplier';
export const DEFAULT_LOCALE: Locale = 'en-CA';
export const LOCALE_COOKIE = 'rivix_locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

/** What the switcher offers on each side, with its label (the label is never translated). */
export const SIDE_LOCALES: Record<Side, readonly Locale[]> = {
  customer: ['en-CA', 'fr-CA', 'en-US'],
  staff: ['en-CA', 'fr-CA', 'en-US'],
  supplier: ['en-CA', 'zh-CN'],
};
export const LOCALE_LABEL: Record<Side, Partial<Record<Locale, string>>> = {
  customer: { 'en-CA': 'CA · EN', 'fr-CA': 'QC · FR', 'en-US': 'US · EN' },
  staff: { 'en-CA': 'CA · EN', 'fr-CA': 'QC · FR', 'en-US': 'US · EN' },
  supplier: { 'en-CA': 'English', 'zh-CN': '简体中文' },
};

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);

/**
 * The locale a page of this side is actually drawn in, from the one the person chose.
 *   customer: their choice if the customer side offers it, else CA·EN;
 *   staff: English for now (US·EN keeps US date and number formats; anything else is CA·EN);
 *   supplier: their choice if the supplier side offers it, else English.
 */
export function effectiveLocale(selected: Locale | null | undefined, side: Side): Locale {
  if (side === 'staff') return selected === 'en-US' ? 'en-US' : 'en-CA';
  return selected && SIDE_LOCALES[side].includes(selected) ? selected : DEFAULT_LOCALE;
}

/**
 * The starting language from the visitor's approximate location (2026-11-27, approved). Used ONLY to choose the language a
 * page first opens in, and only when nothing was chosen or saved: never stored, logged or used for anything else.
 *   customer pages: Quebec (CA + QC) → QC·FR; anywhere else, nothing (China stays CA·EN on customer pages);
 *   supplier pages: China (CN) → 简体中文;
 *   staff pages: nothing (English for now).
 */
export type Geo = { country: string | null; region: string | null };
export function locationLocale(geo: Geo | null, side: Side): Locale | null {
  if (!geo?.country) return null;
  const country = geo.country.toUpperCase(), region = (geo.region ?? '').toUpperCase().replace(/^[A-Z]{2}-/, '');
  if (side === 'customer' && country === 'CA' && region === 'QC') return 'fr-CA';
  if (side === 'supplier' && country === 'CN') return 'zh-CN';
  return null;
}
/**
 * Where the location comes from. On Vercel (VERCEL=1): Vercel's own x-vercel-ip-country and x-vercel-ip-country-region.
 * Elsewhere those headers do not exist; for tests ONLY, when RIVIX_TEST_GEO=1 is set (run-on-test-project.mjs) and the
 * app is NOT on Vercel, an x-rivix-test-geo header ("CA-QC", "CN") stands in. On Vercel the test header is always ignored.
 */
export function geoFrom(get: (name: string) => string | null | undefined, env: Record<string, string | undefined>): Geo | null {
  if (env.VERCEL === '1') {
    const country = get('x-vercel-ip-country');
    return country ? { country, region: get('x-vercel-ip-country-region') ?? null } : null;
  }
  if (env.RIVIX_TEST_GEO === '1') {
    const v = (get('x-rivix-test-geo') ?? '').trim().toUpperCase();
    const m = /^([A-Z]{2})(?:-([A-Z0-9]{1,3}))?$/.exec(v);
    return m ? { country: m[1], region: m[2] ?? null } : null;
  }
  return null;
}

/** The best locale for an Accept-Language header among those `offered` (all of them when not given), or null. */
export function fromAcceptLanguage(header: string | null | undefined, offered: readonly Locale[] = LOCALES): Locale | null {
  if (!header) return null;
  const wanted = header.split(',').map((part) => {
    const [tag, ...params] = part.trim().split(';');
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 };
  }).filter((w) => w.tag && w.q > 0).sort((a, b) => b.q - a.q);
  const pick = (tag: string): Locale | null => {
    const exact = LOCALES.find((l) => l.toLowerCase() === tag);
    if (exact) return exact;
    const lang = tag.split('-')[0];
    if (lang === 'fr') return 'fr-CA';
    if (lang === 'zh') return 'zh-CN';
    if (lang === 'en') return 'en-CA';
    return null;
  };
  // The first language the browser asks for that this side offers (a Chinese browser on a customer page moves on).
  for (const { tag } of wanted) { const l = pick(tag); if (l && offered.includes(l)) return l; }
  return null;
}
