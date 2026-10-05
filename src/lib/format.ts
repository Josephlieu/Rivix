// One date style everywhere in the portal: "Oct 3, 2026" and "Oct 3, 2026, 6:25 PM".
// Unambiguous (no 03/10 vs 10/03 confusion) and the same in every browser.
//
// Every date and time is shown, and every "which day is this?" decision is made, in the
// BUSINESS time zone (RIVIX is Vancouver-based, so Pacific time), not the time zone of
// whoever happens to be looking. To change it for the whole portal, change this one line.
export const BUSINESS_TZ = 'America/Vancouver';

type DateInput = string | number | Date | null | undefined;

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toDate = (v: DateInput): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: 'short', day: 'numeric' });
// A plain calendar date ("2026-10-03") has no time of day or zone; show it as that same day everywhere.
const plainDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, month: 'long', year: 'numeric' });
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const formatDate = (v: DateInput, empty = '—') => {
  if (typeof v === 'string' && PLAIN_DATE.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return plainDateFmt.format(new Date(Date.UTC(y, m - 1, d)));
  }
  const d = toDate(v);
  return d ? dateFmt.format(d) : empty;
};

export const formatDateTime = (v: DateInput, empty = '—') => {
  const d = toDate(v);
  return d ? dateTimeFmt.format(d) : empty;
};

/** "October 2026" for a timestamp, in business time. */
export const formatMonthYear = (v: DateInput, empty = '—') => {
  const d = toDate(v);
  return d ? monthFmt.format(d) : empty;
};

/** The calendar day ("2026-10-03") a moment falls on in business time. Defaults to now. */
export const businessDateKey = (v: DateInput = new Date()): string => {
  const d = toDate(v);
  return d ? keyFmt.format(d) : ''; // en-CA formats as YYYY-MM-DD
};
