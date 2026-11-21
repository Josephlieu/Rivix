// Pricing engine: duties per product line (decision 5, follow-up 3). The HS code, country of origin and tariff treatment
// are inputs, recorded on the quote; there is NO tariff lookup in code, and the CBSA valuation rules are not coded: the duty
// base (customs value, in CAD) is an input. Each duty line (customs duty, surtax, anti-dumping, countervailing) can have an
// ad valorem rate of a base and/or a specific amount per unit. Brokerage and clearance are separate cost lines (quote.ts).
import { PricingError, ZERO, parseNumber, ratText, type NumberInput } from './decimal';
import { money, moneyText, parseAmount, run, sum, times, toMoney, type AmountInput, type Line, type Money, type Result } from './money';
import { HOME } from './fx';

export type DutyKind = 'customs_duty' | 'surtax' | 'anti_dumping' | 'countervailing';
export const DUTY_KINDS: readonly DutyKind[] = ['customs_duty', 'surtax', 'anti_dumping', 'countervailing'];
export const DUTY_LABEL: Record<DutyKind, string> = { customs_duty: 'Customs duty', surtax: 'Surtax', anti_dumping: 'Anti-dumping duty', countervailing: 'Countervailing duty' };

export interface DutyLineInput { rate?: NumberInput; base?: AmountInput; perUnit?: AmountInput }
export interface DutyInput {
  hsCode: string; countryOfOrigin: string; tariffTreatment: string;
  /** The customs value in CAD used by every ad valorem line that does not give its own base. */
  dutyBase?: AmountInput;
  customs_duty?: DutyLineInput; surtax?: DutyLineInput; anti_dumping?: DutyLineInput; countervailing?: DutyLineInput;
}

const cadBase = (v: AmountInput | undefined, what: string): Money => {
  const a = parseAmount(v, what);
  if (a.currency !== HOME) throw new PricingError('CURRENCY_MISMATCH', `${what}: the duty base is the customs value in ${HOME}, given as an input (this engine does not apply the CBSA valuation or exchange rules).`);
  return toMoney(a.value, HOME);
};
const text = (v: unknown, what: string) => { if (typeof v !== 'string' || !v.trim()) throw new PricingError('MISSING_REQUIRED', `${what} is required.`); return v.trim(); };

/** The duties of one product line, in CAD, with one breakdown line per duty part. */
export function lineDuties(d: DutyInput, quantity: bigint, key: string, source: string, b: Line[]): Money {
  b.push({ key: `${key}.hs`, label: 'HS code / origin / tariff treatment', value: `${text(d.hsCode, `${source}.hsCode`)} / ${text(d.countryOfOrigin, `${source}.countryOfOrigin`)} / ${text(d.tariffTreatment, `${source}.tariffTreatment`)}`, source, basis: 'input', note: 'no tariff lookup: rates are inputs' });
  const parts: Money[] = [];
  for (const kind of DUTY_KINDS) {
    const l = d[kind];
    if (l === undefined) continue;
    const at = `${source}.${kind}`;
    if (l.rate === undefined && l.perUnit === undefined) throw new PricingError('BAD_INPUT', `${at}: give an ad valorem rate (with a base) and/or a specific amount per unit.`);
    if (l.rate !== undefined) {
      const rate = parseNumber(l.rate, `${at}.rate`, { maxDecimals: 6 });
      const base = l.base !== undefined ? cadBase(l.base, `${at}.base`) : cadBase(d.dutyBase, `${source}.dutyBase (the base for ${at}.rate)`);
      const amt = times(base, rate);
      parts.push(amt);
      b.push({ key: `${key}.${kind}.adValorem`, label: `${DUTY_LABEL[kind]}: ${ratText(rate, 6).replace(/0+$/, '').replace(/\.$/, '')} × base ${moneyText(base)}`, money: amt, source: `${at}.rate × ${l.base !== undefined ? `${at}.base` : `${source}.dutyBase`}`, basis: 'input' });
    }
    if (l.perUnit !== undefined) {
      const per = parseAmount(l.perUnit, `${at}.perUnit`, { maxDecimals: 4 });
      if (per.currency !== HOME) throw new PricingError('CURRENCY_MISMATCH', `${at}.perUnit: a specific duty is given in ${HOME}.`);
      const amt = toMoney({ n: per.value.n * quantity, d: per.value.d }, HOME);
      parts.push(amt);
      b.push({ key: `${key}.${kind}.specific`, label: `${DUTY_LABEL[kind]}: ${HOME} ${ratText(per.value, 4)} per unit × ${quantity}`, money: amt, source: `${at}.perUnit × quantity`, basis: 'input' });
    }
  }
  const total = sum(parts, HOME, 'Duties');
  b.push({ key: `${key}.duties`, label: 'Duties (total)', money: total, source: 'sum of the duty lines', basis: 'computed' });
  return total;
}

/** One product line's duties on their own. */
export function duties(d: DutyInput, quantity: NumberInput): Result<Money> {
  return run((b) => {
    const q = parseNumber(quantity, 'quantity', { maxDecimals: 0 });
    if (q.n === ZERO) throw new PricingError('ZERO_QUANTITY', 'quantity cannot be zero.');
    return lineDuties(d, q.n, 'duty', 'duties', b);
  });
}
export const NO_DUTY = money(ZERO, HOME);
