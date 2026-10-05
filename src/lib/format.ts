// One date style everywhere in the portal: "Oct 3, 2026" and "Oct 3, 2026, 6:25 PM".
// Unambiguous (no 03/10 vs 10/03 confusion) and the same in every browser.
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

// One formatter per (style, zone), created on first use.
const cache = new Map<string, Intl.DateTimeFormat>();
const fmt = (style: string, timeZone: string, opts: Intl.DateTimeFormatOptions) => {
  const k = `${style}|${timeZone}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, ...opts });
    cache.set(k, f);
  }
  return f;
};

export const formatDate = (v: DateInput, empty = '—') => {
  // A plain calendar date ("2026-10-03") has no time of day or zone: show it as that same day for everyone.
  if (typeof v === 'string' && PLAIN_DATE.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return fmt('date', 'UTC', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d)));
  }
  const d = toDate(v);
  return d ? fmt('date', activeTimeZone(), { year: 'numeric', month: 'short', day: 'numeric' }).format(d) : empty;
};

export const formatDateTime = (v: DateInput, empty = '—') => {
  const d = toDate(v);
  return d
    ? fmt('datetime', activeTimeZone(), { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
    : empty;
};

/** "October 2026" for a timestamp. */
export const formatMonthYear = (v: DateInput, empty = '—') => {
  const d = toDate(v);
  return d ? fmt('month', activeTimeZone(), { month: 'long', year: 'numeric' }).format(d) : empty;
};

/** The calendar day ("2026-10-03") a moment falls on. Defaults to now. */
export const localDateKey = (v: DateInput = new Date()): string => {
  const d = toDate(v);
  return d ? fmt('key', activeTimeZone(), { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) : ''; // en-CA gives YYYY-MM-DD
};
