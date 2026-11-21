// Pricing engine: the approved profit formulas (decisions 3, 10, 11). All on extended (whole-line or whole-order) amounts.
//   gross profit = selling price excl. tax − landed cost
//   margin %     = gross profit / selling price
//   markup %     = gross profit / landed cost
//   price from target margin = landed cost / (1 − target margin), rounded UP to the cent (so the margin is never below the
//   target); a target margin of 100% or more is refused.
import { PricingError, ONE, cmp, div, int, isZero, parseNumber, percentText, rat, roundUp, sub, ZERO, type NumberInput, type Rational } from './decimal';
import { asRational, minus, money, moneyText, run, type Money, type Result } from './money';

export const grossProfitOf = (price: Money, landed: Money): Money => minus(price, landed, 'Gross profit');

/** A ratio of two amounts in the same currency (exact). */
function ratio(a: Money, b: Money, what: string): Rational {
  if (a.currency !== b.currency) throw new PricingError('CURRENCY_MISMATCH', `${what}: ${a.currency} and ${b.currency}.`);
  if (b.cents === ZERO) throw new PricingError('DIVIDE_BY_ZERO', `${what}: divides by ${moneyText(b)}.`);
  return rat(a.cents, b.cents);
}
export const marginOf = (gp: Money, price: Money): Rational => ratio(gp, price, 'Margin % (gross profit / selling price)');
export const markupOf = (gp: Money, landed: Money): Rational => ratio(gp, landed, 'Markup % (gross profit / landed cost)');

export function readTargetMargin(v: NumberInput | undefined, what: string): Rational {
  const m = parseNumber(v, what, { maxDecimals: 6 });
  if (cmp(m, int(ONE)) >= 0) throw new PricingError('MARGIN_TOO_HIGH', `${what}: a target margin of 100% or more is impossible (price = landed cost / (1 − margin)).`);
  return m;
}
/** Unit price for a target margin: landed / (1 − m), rounded UP to the cent. `landed` may be an exact unit cost. */
export function priceForMargin(landed: Rational, margin: Rational, currency: string): Money {
  return money(roundUp(div(landed, sub(int(ONE), margin)), 2), currency);
}

export interface ProfitView { grossProfit: Money; margin: string; markup: string | null }
/** Gross profit, margin and markup of a selling price (excl. tax) and a landed cost, in the same currency. */
export function profit(price: Money, landed: Money): Result<ProfitView> {
  return run((b) => {
    const gp = grossProfitOf(price, landed);
    const m = marginOf(gp, price);
    const mk = isZero(asRational(landed)) ? null : markupOf(gp, landed);
    b.push({ key: 'grossProfit', label: `Gross profit: ${moneyText(price)} − ${moneyText(landed)}`, money: gp, source: 'selling price excl. tax − landed cost', basis: 'computed' });
    b.push({ key: 'margin', label: 'Margin (gross profit / selling price)', value: percentText(m), source: 'formula', basis: 'computed' });
    b.push({ key: 'markup', label: 'Markup (gross profit / landed cost)', value: mk ? percentText(mk) : 'n/a (landed cost is 0)', source: 'formula', basis: 'computed' });
    return { grossProfit: gp, margin: percentText(m), markup: mk ? percentText(mk) : null };
  });
}

/** Selling price for a target margin, with its breakdown. */
export function priceFromTargetMargin(landed: Money, targetMargin: NumberInput): Result<{ price: Money; margin: string }> {
  return run((b) => {
    if (landed.cents < ZERO) throw new PricingError('NEGATIVE', 'Landed cost cannot be negative.');
    const m = readTargetMargin(targetMargin, 'targetMargin');
    const price = priceForMargin(asRational(landed), m, landed.currency);
    b.push({ key: 'targetMargin', label: 'Target margin', value: percentText(m, 4), source: 'targetMargin', basis: 'input' });
    b.push({ key: 'price', label: `Price: ${moneyText(landed)} / (1 − ${percentText(m, 4)}), rounded up to the cent`, money: price, source: 'landed cost / (1 − target margin)', basis: 'computed' });
    const gp = grossProfitOf(price, landed);
    const actual = price.cents === ZERO ? int(ZERO) : marginOf(gp, price);
    b.push({ key: 'margin', label: 'Margin at that price (never below the target)', value: percentText(actual, 4), source: 'formula', basis: 'computed' });
    return { price, margin: percentText(actual, 4) };
  });
}
