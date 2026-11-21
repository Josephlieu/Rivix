// Pricing engine (2026-11-21): exact numbers. A Rational is n/d with bigint parts (d > 0), so nothing is ever a
// floating-point number. Inputs are decimal text ("0.18", "12.50") or whole numbers; a JS number with a fraction is refused.
// Rounding (decision 3, audit-docs/41-pricing-decisions.md): half up, away from zero, to the cent; price from target
// margin rounds UP. Ratios (margin, markup) are shown to 0.01% with the same half-up rule.
export type ErrorCode =
  | 'NOT_A_NUMBER' | 'TOO_MANY_DECIMALS' | 'NEGATIVE' | 'NOT_WHOLE' | 'ZERO_QUANTITY' | 'MISSING_REQUIRED' | 'CURRENCY_MISMATCH'
  | 'BAD_CURRENCY' | 'BAD_FX' | 'MARGIN_TOO_HIGH' | 'DIVIDE_BY_ZERO' | 'DOUBLE_COUNTED' | 'INCONSISTENT' | 'BAD_INPUT';

export class PricingError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) { super(message); this.code = code; this.name = 'PricingError'; }
}

export interface Rational { n: bigint; d: bigint }

export const ZERO = BigInt(0);
export const ONE = BigInt(1);
export const TWO = BigInt(2);
export const TEN = BigInt(10);

export const pow10 = (k: number): bigint => { let r = ONE; for (let i = 0; i < k; i++) r *= TEN; return r; };
const abs = (x: bigint) => (x < ZERO ? -x : x);
export const gcd = (a: bigint, b: bigint): bigint => { a = abs(a); b = abs(b); while (b !== ZERO) { const t = a % b; a = b; b = t; } return a; };
export const lcm = (a: bigint, b: bigint): bigint => (a === ZERO || b === ZERO ? ZERO : abs(a * b) / gcd(a, b));

export function rat(n: bigint, d: bigint = ONE): Rational {
  if (d === ZERO) throw new PricingError('DIVIDE_BY_ZERO', 'Division by zero.');
  if (d < ZERO) { n = -n; d = -d; }
  const g = gcd(n, d) || ONE;
  return { n: n / g, d: d / g };
}
export const int = (x: bigint): Rational => ({ n: x, d: ONE });
export const add = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational) => {
  if (b.n === ZERO) throw new PricingError('DIVIDE_BY_ZERO', 'Division by zero.');
  return rat(a.n * b.d, a.d * b.n);
};
export const cmp = (a: Rational, b: Rational): number => { const x = a.n * b.d - b.n * a.d; return x === ZERO ? 0 : x > ZERO ? 1 : -1; };
export const max = (a: Rational, b: Rational) => (cmp(a, b) >= 0 ? a : b);
export const isZero = (a: Rational) => a.n === ZERO;
export const isNegative = (a: Rational) => a.n < ZERO;

/** Round a rational to `places` decimals, half up (away from zero). Returns the scaled integer (e.g. cents for places = 2). */
export function roundHalfUp(r: Rational, places: number): bigint {
  const n = r.n * pow10(places);
  const q = abs(n) / r.d, rem = abs(n) % r.d;
  const up = rem * TWO >= r.d ? q + ONE : q;
  return n < ZERO ? -up : up;
}
/** Round a rational UP (toward +infinity) to `places` decimals. Returns the scaled integer. */
export function roundUp(r: Rational, places: number): bigint {
  const n = r.n * pow10(places);
  const q = n / r.d; // truncates toward zero
  return n > ZERO && n % r.d !== ZERO ? q + ONE : q;
}
/** A scaled integer as decimal text: (12345, 2) -> "123.45". */
export function scaledToText(x: bigint, places: number): string {
  const neg = x < ZERO; const s = abs(x).toString().padStart(places + 1, '0');
  const whole = places ? s.slice(0, s.length - places) : s, frac = places ? s.slice(s.length - places) : '';
  return `${neg ? '-' : ''}${whole}${places ? `.${frac}` : ''}`;
}
export const ratText = (r: Rational, places: number) => scaledToText(roundHalfUp(r, places), places);

export type NumberInput = string | number | bigint;

/**
 * Reads a number given as decimal text or a whole number. Refused: a JS number with a fraction (give it as text), more than
 * `maxDecimals` decimals, exponents, empty values, and (unless allowNegative) anything below zero.
 */
export function parseNumber(v: unknown, what: string, opts: { maxDecimals?: number; allowNegative?: boolean } = {}): Rational {
  const maxDecimals = opts.maxDecimals ?? 6;
  if (v === undefined || v === null || v === '') throw new PricingError('MISSING_REQUIRED', `${what} is required.`);
  let text: string;
  if (typeof v === 'bigint') text = v.toString();
  else if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) throw new PricingError('NOT_A_NUMBER', `${what}: give decimals as text (for example "0.18"), never as a floating-point number.`);
    text = String(v);
  } else if (typeof v === 'string') text = v.trim();
  else throw new PricingError('NOT_A_NUMBER', `${what} is not a number.`);
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) throw new PricingError('NOT_A_NUMBER', `${what} is not a plain decimal number: "${text}".`);
  const frac = m[3] ?? '';
  if (frac.length > maxDecimals) throw new PricingError('TOO_MANY_DECIMALS', `${what} has more than ${maxDecimals} decimals: "${text}".`);
  const r = rat(BigInt((m[1] ?? '') + m[2] + frac), pow10(frac.length));
  if (isNegative(r) && !opts.allowNegative) throw new PricingError('NEGATIVE', `${what} cannot be negative.`);
  return r;
}

/** A whole number of at least 1 (quantities, package counts). Zero is refused (decision 7). */
export function parseCount(v: unknown, what: string): bigint {
  const r = parseNumber(v, what, { maxDecimals: 0 });
  if (r.n === ZERO) throw new PricingError('ZERO_QUANTITY', `${what} cannot be zero.`);
  return r.n;
}

/** A ratio as a percentage, rounded half up to `places` decimals, trailing zeros dropped: 0.02 -> "2%", 0.2308 -> "23.08%". */
export function percentText(r: Rational, places = 2): string {
  const s = ratText(mul(r, int(BigInt(100))), places);
  return `${s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s}%`;
}
