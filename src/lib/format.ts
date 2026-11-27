// One date style everywhere in the portal: "Oct 3, 2026" and "Oct 3, 2026, 6:25 PM" (en-CA), written the way the chosen
// region writes it (fr-CA "3 oct. 2026", en-US "Oct 3, 2026"), always with the month as a word: unambiguous (no 03/10 vs
// 10/03 confusion). The locale only changes how dates and numbers are WRITTEN (2026-11-27); calendar-day keys
// (localDateKey) stay YYYY-MM-DD, and money always keeps the account's currency (formatMoney).
//
// Dates and times are shown, and every "which day is this?" decision is made, in the time
// zone of the person looking (detected from their browser), so a client in Canada sees
// Canadian time and anyone elsewhere sees their own. Server code has no viewer, so it falls
// back to DEFAULT_TZ (RIVIX is Vancouver-based). Stored timestamps are always UTC.
export const DEFAULT_TZ = 'America/Vancouver';

/** The viewer's IANA time zone (e.g. "America/Toronto"); DEFAULT_TZ on the server. */
export const activeTimeZone = (): string => {
  if (typeof window === 'undefined') return DEFAULT_TZ;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
};

type DateInput = string | number | Date | null | undefined;

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toDate = (v: DateInput): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/** The locale dates and numbers are written in when none is given (CA·EN). */
export const FORMAT_LOCALE = 'en-CA';
// One formatter per (style, zone, locale), created on first use.
const cache = new Map<string, Intl.DateTimeFormat>();
const fmt = (style: string, timeZone: string, opts: Intl.DateTimeFormatOptions, locale: string = FORMAT_LOCALE) => {
  const k = `${style}|${timeZone}|${locale}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone, ...opts });
    cache.set(k, f);
  }
  return f;
};

/** A date in a given time zone (LocalDate uses DEFAULT_TZ for the first render, the same on the server and in the browser). */
export const formatDateIn = (v: DateInput, timeZone: string, empty = '—', locale: string = FORMAT_LOCALE) => {
  // A plain calendar date ("2026-10-03") has no time of day or zone: show it as that same day for everyone.
  if (typeof v === 'string' && PLAIN_DATE.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return fmt('date', 'UTC', { year: 'numeric', month: 'short', day: 'numeric' }, locale).format(new Date(Date.UTC(y, m - 1, d)));
  }
  const d = toDate(v);
  return d ? fmt('date', timeZone, { year: 'numeric', month: 'short', day: 'numeric' }, locale).format(d) : empty;
};
export const formatDate = (v: DateInput, empty = '—', locale: string = FORMAT_LOCALE) => formatDateIn(v, activeTimeZone(), empty, locale);

/** A date and time in a given time zone (LocalDate uses DEFAULT_TZ for the first render, the same on server and browser). */
export const formatDateTimeIn = (v: DateInput, timeZone: string, empty = '—', locale: string = FORMAT_LOCALE) => {
  const d = toDate(v);
  return d
    ? fmt('datetime', timeZone, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }, locale).format(d)
    : empty;
};
export const formatDateTime = (v: DateInput, empty = '—', locale: string = FORMAT_LOCALE) => formatDateTimeIn(v, activeTimeZone(), empty, locale);

/** "October 2026" for a timestamp. */
export const formatMonthYear = (v: DateInput, empty = '—', locale: string = FORMAT_LOCALE) => {
  const d = toDate(v);
  return d ? fmt('month', activeTimeZone(), { month: 'long', year: 'numeric' }, locale).format(d) : empty;
};

/** A number written the region's way ("1,234.5" en-CA / en-US, "1 234,5" fr-CA). */
export const formatNumber = (n: number, locale: string = FORMAT_LOCALE, opts: Intl.NumberFormatOptions = {}) => new Intl.NumberFormat(locale, opts).format(n);
/**
 * Money: the CURRENCY ALWAYS COMES FROM THE ACCOUNT (or the document), never from the region; the locale only decides how
 * it is written. formatMoney(1234.5, 'CAD', 'en-US') → "CA$1,234.50"; 'fr-CA' → "1 234,50 $"; 'en-CA' → "$1,234.50".
 */
export const formatMoney = (amount: number, currency: string, locale: string = FORMAT_LOCALE) => {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('formatMoney: a 3-letter currency from the account is required');
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
};

/** The calendar day ("2026-10-03") a moment falls on. Defaults to now. */
export const localDateKey = (v: DateInput = new Date()): string => {
  const d = toDate(v);
  return d ? fmt('key', activeTimeZone(), { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA').format(d) : ''; // en-CA gives YYYY-MM-DD, whatever the region
};

/** Day number (days since 1970-01-01) of a real "YYYY-MM-DD" calendar date, or null if it is not one (2026-02-30 is not). */
export const plainDateDay = (key: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return Math.round(t / 86400000);
};
