// Pricing engine: currency conversion (decision 4). Only with an explicit rate, its date and its source; every converted
// amount gets its own FX buffer line (default 2%), which is a landed-cost line. Landed cost is in CAD.
import { PricingError, cmp, int, parseNumber, percentText, ZERO, type Rational } from './decimal';
import { money, moneyText, times, type Line, type Money } from './money';

export interface FxRateInput { from: string; to: string; rate: string; date: string; source: string }
export interface Fx { from: string; rate: Rational; rateText: string; date: string; source: string }
export const HOME = 'CAD';

export function readFx(list: FxRateInput[] | undefined): Map<string, Fx> {
  const out = new Map<string, Fx>();
  for (const [i, f] of (list ?? []).entries()) {
    const at = `fx[${i}]`;
    if (!f || typeof f !== 'object') throw new PricingError('BAD_FX', `${at} is not an exchange rate.`);
    if (f.to !== HOME) throw new PricingError('BAD_FX', `${at}: rates must convert to ${HOME}.`);
    if (typeof f.from !== 'string' || !/^[A-Z]{3}$/.test(f.from) || f.from === HOME) throw new PricingError('BAD_FX', `${at}: "from" must be another 3-letter currency.`);
    if (typeof f.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.date) || Number.isNaN(Date.parse(`${f.date}T00:00:00Z`))) throw new PricingError('BAD_FX', `${at}: the rate's date is required (YYYY-MM-DD).`);
    if (typeof f.source !== 'string' || !f.source.trim()) throw new PricingError('BAD_FX', `${at}: the rate's source is required.`);
    const rate = parseNumber(f.rate, `${at}.rate`, { maxDecimals: 8 });
    if (cmp(rate, int(ZERO)) <= 0) throw new PricingError('BAD_FX', `${at}: the rate must be above zero.`);
    if (out.has(f.from)) throw new PricingError('BAD_FX', `${at}: two rates for ${f.from}.`);
    out.set(f.from, { from: f.from, rate, rateText: f.rate.trim(), date: f.date, source: f.source.trim() });
  }
  return out;
}

/**
 * An amount in CAD. A CAD amount is used as it is. Another currency is converted (rounded half up to the cent) and gets
 * its own FX buffer line. Returns both CAD amounts (the buffer is 0 for CAD).
 */
export function toCad(m: Money, fx: Map<string, Fx>, buffer: { value: Rational; basis: Line['basis'] }, key: string, label: string, source: string, out: Line[]): { cad: Money; buffer: Money } {
  if (m.currency === HOME) return { cad: m, buffer: money(ZERO, HOME) };
  const f = fx.get(m.currency);
  if (!f) throw new PricingError('BAD_FX', `${label}: no ${m.currency} to ${HOME} rate was given (rate, date and source are required).`);
  const cad = money(times(m, f.rate).cents, HOME);
  out.push({ key: `${key}.converted`, label: `${label}: ${moneyText(m)} × ${f.rateText} (${f.source}, ${f.date})`, money: cad, value: f.rateText, source: `${source} × fx[${m.currency}]`, basis: 'required' });
  const buf = times(cad, buffer.value);
  out.push({ key: `${key}.fxBuffer`, label: `FX buffer on ${label.toLowerCase()} (${pct(buffer.value)})`, money: buf, value: pct(buffer.value), source: 'fxBuffer', basis: buffer.basis });
  return { cad, buffer: buf };
}

const pct = (r: Rational) => percentText(r, 4);
