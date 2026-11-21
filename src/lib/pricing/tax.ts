// Pricing engine: taxes (decision 8). Taxes are NEVER part of landed cost, price or margin. Rates and bases are inputs.
//   Import taxes (GST/HST/PST at the border): base is an input (no CBSA "value for tax" rules in code). Each line has a
//   recoverable flag: default GST/HST recoverable ("subject to accountant confirmation"), PST not recoverable. If the supplier
//   is importer of record, the import taxes are inside the supplier price and not recoverable by RIVIX.
//   Sales taxes (on RIVIX's selling price): each kind on the selling price excl. tax, shown separately.
import { PricingError, parseNumber, percentText, type NumberInput } from './decimal';
import { money, parseAmount, sum, times, toMoney, type AmountInput, type Line, type Money } from './money';
import { DEFAULTS, RECOVERABLE_NOTE, pick } from './defaults';
import { HOME } from './fx';

export type TaxKind = 'GST' | 'HST' | 'PST';
const KINDS: readonly TaxKind[] = ['GST', 'HST', 'PST'];
export interface ImportTaxLineInput { kind: TaxKind; rate: NumberInput; recoverable?: boolean }
export interface ImportTaxesInput { base: AmountInput; lines: ImportTaxLineInput[] }
export interface SalesTaxLineInput { kind: TaxKind; rate: NumberInput }

const kind = (k: unknown, at: string): TaxKind => { if (!KINDS.includes(k as TaxKind)) throw new PricingError('BAD_INPUT', `${at}.kind must be GST, HST or PST.`); return k as TaxKind; };

export interface ImportTaxResult { recoverable: Money; notRecoverable: Money; lines: Array<{ kind: TaxKind; amount: Money; recoverable: boolean }> }

export function importTaxLines(input: ImportTaxesInput, b: Line[]): ImportTaxResult {
  const a = parseAmount(input.base, 'importTaxes.base');
  if (a.currency !== HOME) throw new PricingError('CURRENCY_MISMATCH', `importTaxes.base is in ${HOME} (an input; the CBSA value-for-tax rules are not coded).`);
  const base = toMoney(a.value, HOME);
  b.push({ key: 'importTaxes.base', label: 'Import tax base', money: base, source: 'importTaxes.base', basis: 'input' });
  const lines = (input.lines ?? []).map((l, i) => {
    const at = `importTaxes.lines[${i}]`;
    const k = kind(l?.kind, at);
    const rate = parseNumber(l.rate, `${at}.rate`, { maxDecimals: 6 });
    const rec = pick(l.recoverable, DEFAULTS.recoverable[k]);
    const amount = times(base, rate);
    b.push({ key: `importTaxes.${k}`, label: `Import ${k} (${percentText(rate, 4)}), ${rec.value ? 'recoverable' : 'not recoverable'}: not in landed cost`, money: amount, value: rec.value ? 'recoverable' : 'not recoverable', source: `${at}.rate × importTaxes.base; recoverable: ${at}.recoverable`, basis: rec.basis, note: rec.value && (k === 'GST' || k === 'HST') ? RECOVERABLE_NOTE : undefined });
    return { kind: k, amount, recoverable: rec.value };
  });
  return { recoverable: sum(lines.filter((l) => l.recoverable).map((l) => l.amount), HOME), notRecoverable: sum(lines.filter((l) => !l.recoverable).map((l) => l.amount), HOME), lines };
}

export function salesTaxLines(price: Money, input: SalesTaxLineInput[] | undefined, b: Line[]): { total: Money; lines: Array<{ kind: TaxKind; amount: Money }> } {
  const lines = (input ?? []).map((l, i) => {
    const at = `salesTaxes[${i}]`;
    const k = kind(l?.kind, at);
    const rate = parseNumber(l.rate, `${at}.rate`, { maxDecimals: 6 });
    const amount = times(price, rate);
    b.push({ key: `salesTaxes.${k}`, label: `${k} (${percentText(rate, 4)}) on the selling price excl. tax: not in price or margin`, money: amount, source: `${at}.rate × selling price excl. tax`, basis: 'input' });
    return { kind: k, amount };
  });
  return { total: sum(lines.map((l) => l.amount), price.currency), lines };
}
export const noTax = () => money(BigInt(0), HOME);
