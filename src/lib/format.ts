// One date style everywhere in the portal: "Oct 3, 2026" and "Oct 3, 2026, 6:25 PM".
// Unambiguous (no 03/10 vs 10/03 confusion) and the same in every browser.
type DateInput = string | number | Date | null | undefined;

const toDate = (v: DateInput): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  // A plain date like "2026-10-03" has no time zone: read it as that calendar day
  // (new Date("2026-10-03") would be midnight UTC and can show as the day before).
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const dateFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const formatDate = (v: DateInput, empty = '—') => {
  const d = toDate(v);
  return d ? dateFmt.format(d) : empty;
};

export const formatDateTime = (v: DateInput, empty = '—') => {
  const d = toDate(v);
  return d ? dateTimeFmt.format(d) : empty;
};
