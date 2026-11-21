// Pricing engine: money is integer cents (bigint) with an ISO currency code. Amounts of different currencies are never
// added or compared; conversion happens only in fx.ts, with an explicit rate, date and source.
import { PricingError, ZERO, mul, parseNumber, rat, roundHalfUp, roundUp, scaledToText, type NumberInput, type Rational } from './decimal';

export interface Money { cents: bigint; currency: string }
export interface AmountInput { amount: NumberInput; currency: string }

/** Where a breakdown value came from: a plain input, an input left at its documented default or overridden, a required
 *  input with no default, or a computed value. */
export type Basis = 'input' | 'required' | 'default' | 'override' | 'computed';
export interface Line {
  key: string;      // stable id, e.g. "line.A.supplierCost"
  label: string;    // plain words for the quote
  money?: Money;    // a money amount (cents)
  value?: string;   // a non-money value (rate, weight, percentage) as text
  source: string;   // the input path it came from, or the formula
  basis: Basis;
  note?: string;
}

export type Result<T> =
  | { ok: true; value: T; breakdown: Line[]; warnings: string[] }
  | { ok: false; error: { code: PricingError['code']; message: string } };

/** Runs a calculation; a PricingError becomes { ok: false } (any other error is a bug and is thrown). */
export function run<T>(fn: (b: Line[], w: string[]) => T): Result<T> {
  const breakdown: Line[] = [], warnings: string[] = [];
  try {
    const value = fn(breakdown, warnings);
    return { ok: true, value, breakdown, warnings };
  } catch (e) {
    if (e instanceof PricingError) return { ok: false, error: { code: e.code, message: e.message } };
    throw e;
  }
}

export const money = (cents: bigint, currency: string): Money => ({ cents, currency });
export const checkCurrency = (c: unknown, what: string): string => {
  if (typeof c !== 'string' || !/^[A-Z]{3}$/.test(c)) throw new PricingError('BAD_CURRENCY', `${what}: the currency must be a 3-letter ISO code such as "CAD" or "USD".`);
  return c;
};

/** Reads an amount ("12.34" + currency). At most `maxDecimals` decimals (2 for money; unit costs may have up to 4). */
export function parseAmount(v: AmountInput | undefined, what: string, opts: { maxDecimals?: number } = {}): { value: Rational; currency: string } {
  if (!v || typeof v !== 'object') throw new PricingError('MISSING_REQUIRED', `${what} is required.`);
  return { value: parseNumber(v.amount, what, { maxDecimals: opts.maxDecimals ?? 2 }), currency: checkCurrency(v.currency, what) };
}
/** An amount that must be whole cents. */
export function parseMoney(v: AmountInput | undefined, what: string): Money {
  const a = parseAmount(v, what);
  return money(roundHalfUp(a.value, 2), a.currency); // exact: at most 2 decimals
}

export function sameCurrency(a: Money, b: Money, what: string) {
  if (a.currency !== b.currency) throw new PricingError('CURRENCY_MISMATCH', `${what}: ${a.currency} and ${b.currency} cannot be combined without a conversion.`);
}
export const plus = (a: Money, b: Money, what = 'Sum'): Money => { sameCurrency(a, b, what); return money(a.cents + b.cents, a.currency); };
export const minus = (a: Money, b: Money, what = 'Difference'): Money => { sameCurrency(a, b, what); return money(a.cents - b.cents, a.currency); };
export function sum(list: Money[], currency: string, what = 'Total'): Money {
  return list.reduce((s, m) => plus(s, m, what), money(ZERO, currency));
}
export const asRational = (m: Money): Rational => rat(m.cents, BigInt(100));
/** amount × factor, rounded to the cent: half up (the rule everywhere) or up (price from target margin only). */
export function times(m: Money, factor: Rational, rounding: 'half_up' | 'up' = 'half_up'): Money {
  const exact = mul(asRational(m), factor);
  return money(rounding === 'up' ? roundUp(exact, 2) : roundHalfUp(exact, 2), m.currency);
}
/** An exact amount (e.g. unit cost × quantity) rounded half up to the cent. */
export const toMoney = (r: Rational, currency: string): Money => money(roundHalfUp(r, 2), currency);
export const moneyText = (m: Money) => `${m.currency} ${scaledToText(m.cents, 2)}`;
export const multiply = (m: Money, k: bigint): Money => money(m.cents * k, m.currency);
