// Pricing engine: commission (decision 9). On gross profit, per order. The rate is a REQUIRED input with no default: the
// real terms depend on the account and are earned only when payment clears (audit-docs/42-commission-terms.md); those rules
// belong to the Phase 3 commission ledger, not here. Zero or negative gross profit gives 0 commission (no clawback).
import { PricingError, ZERO, parseNumber, percentText, type NumberInput } from './decimal';
import { money, moneyText, run, times, type Line, type Money, type Result } from './money';

export function commissionOn(gp: Money, rate: NumberInput | undefined, b: Line[]): Money {
  if (rate === undefined || rate === null || rate === '') throw new PricingError('MISSING_REQUIRED', 'commissionRate is required (no default: the rate depends on the account).');
  const r = parseNumber(rate, 'commissionRate', { maxDecimals: 6 });
  const amount = gp.cents > ZERO ? times(gp, r) : money(ZERO, gp.currency);
  b.push({ key: 'commission', label: `Commission: ${percentText(r, 4)} × gross profit ${moneyText(gp)}`, money: amount, value: percentText(r, 4), source: 'commissionRate × order gross profit', basis: 'required',
    note: gp.cents > ZERO ? 'estimate only: earned when the customer payment clears (Phase 3 ledger)' : 'zero or negative gross profit: no commission, no clawback' });
  return amount;
}
export function commission(grossProfit: Money, rate: NumberInput | undefined): Result<Money> {
  return run((b) => commissionOn(grossProfit, rate, b));
}
