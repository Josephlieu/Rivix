// Product compliance (2026-11-21). Pure: "today" is passed in (the business day, YYYY-MM-DD, America/Vancouver), so the
// rule never reads the clock. A product is compliant for a claimed standard ONLY with an admin-verified, unexpired
// certificate for that exact product and that exact standard edition (a standards row is one edition). A certificate is
// valid through the end of its expiry day. A claim against a standard that is not checked yet shows "Standard not checked".
export type ClaimStatus = 'compliant' | 'expired' | 'certificate_needed' | 'standard_not_checked';
export const CLAIM_LABEL: Record<ClaimStatus, string> = {
  compliant: 'Compliant', expired: 'Expired', certificate_needed: 'Certificate needed', standard_not_checked: 'Standard not checked',
};
export interface CertFacts { product_id: string; standard_id: string; status: 'uploaded' | 'verified' | string; expires_on: string | null }

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Day number of a YYYY-MM-DD date (exact, no time zone involved), or null. */
export function dayNumber(d: string | null | undefined): number | null {
  if (!d || !DAY.test(d)) return null;
  const [y, m, dd] = d.split('-').map((x) => parseInt(x, 10));
  const t = Date.UTC(y, m - 1, dd);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== dd) return null;
  return Math.round(t / 86_400_000);
}

/** Valid on `today` when verified and today is on or before the expiry day. A verified certificate with no expiry date
 *  does not count (an expiry date is needed to rely on it). */
export const isValidOn = (c: CertFacts, today: string): boolean => {
  const exp = dayNumber(c.expires_on), now = dayNumber(today);
  return c.status === 'verified' && exp !== null && now !== null && now <= exp;
};

export function claimStatus(claim: { product_id: string; standard_id: string }, standard: { checked: boolean }, certificates: CertFacts[], today: string): ClaimStatus {
  if (dayNumber(today) === null) throw new Error('claimStatus: today must be YYYY-MM-DD');
  if (!standard.checked) return 'standard_not_checked';
  const mine = certificates.filter((c) => c.product_id === claim.product_id && c.standard_id === claim.standard_id && c.status === 'verified');
  if (mine.some((c) => isValidOn(c, today))) return 'compliant';
  if (mine.some((c) => c.expires_on && dayNumber(c.expires_on) !== null)) return 'expired';
  return 'certificate_needed';
}

/** Days until a certificate expires (0 = expires today, negative = expired), or null without a date. */
export function daysToExpiry(expiresOn: string | null, today: string): number | null {
  const e = dayNumber(expiresOn), t = dayNumber(today);
  return e === null || t === null ? null : e - t;
}
/** Expiry warning: 'expired', 'within_30', 'within_60' or null. */
export function expiryWarning(expiresOn: string | null, today: string): 'expired' | 'within_30' | 'within_60' | null {
  const d = daysToExpiry(expiresOn, today);
  if (d === null) return null;
  return d < 0 ? 'expired' : d <= 30 ? 'within_30' : d <= 60 ? 'within_60' : null;
}

/** The business day (YYYY-MM-DD) in the app's time zone. Only server code calls this; the rule itself takes `today`. */
export const BUSINESS_TZ = 'America/Vancouver';
export function businessToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
