// Pricing engine: shared cost allocation (decision 12). A shared amount (the freight bill, brokerage, ...) is split over the
// product lines in proportion to their weights; the parts always add up EXACTLY to the amount. Each part is first rounded
// down to the cent; the cents left over go one each to the lines with the largest remainders (ties: the earlier line).
import { PricingError, ZERO, ONE, isNegative, lcm, type Rational } from './decimal';
import { money, run, type Money, type Result } from './money';

/** The largest-remainder split of `total` by `weights` (non-negative; at least one above zero). */
export function splitCents(total: Money, weights: Rational[]): Money[] {
  if (!weights.length) throw new PricingError('BAD_INPUT', 'There are no lines to allocate to.');
  if (weights.some(isNegative)) throw new PricingError('NEGATIVE', 'Allocation weights cannot be negative.');
  if (total.cents < ZERO) throw new PricingError('NEGATIVE', 'A negative amount cannot be allocated.');
  const den = weights.reduce((l, w) => lcm(l, w.d), ONE);
  const w = weights.map((x) => x.n * (den / x.d)); // the same proportions as whole numbers
  const all = w.reduce((s, x) => s + x, ZERO);
  if (all === ZERO) throw new PricingError('DIVIDE_BY_ZERO', 'Every allocation weight is zero: there is nothing to allocate by.');
  const parts = w.map((x) => ({ floor: (total.cents * x) / all, rem: (total.cents * x) % all }));
  let left = total.cents - parts.reduce((s, p) => s + p.floor, ZERO);
  const order = parts.map((p, i) => ({ i, rem: p.rem })).sort((a, b) => (a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1));
  const extra = parts.map(() => ZERO);
  for (const o of order) { if (left === ZERO) break; extra[o.i] = ONE; left -= ONE; }
  return parts.map((p, i) => money(p.floor + extra[i], total.currency));
}

/** The same split as a Result (for use on its own, and in the tests). */
export function allocate(total: Money, weights: Rational[]): Result<Money[]> {
  return run(() => splitCents(total, weights));
}
