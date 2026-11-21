// Pricing engine: freight measures (decision 2). Weights and sizes are exact decimals (kg, cm), never floating point.
//   express_courier and air_cargo: chargeable weight = max(actual, volumetric), volumetric kg = L×W×H cm³ / divisor,
//     rounded UP to the mode's step (default 0.5 kg).
//   ocean: chargeable = max(CBM, kg / W/M ratio) (default 1 CBM = 1000 kg), exact by default, optional step in CBM.
import { PricingError, ZERO, ONE, add, cmp, div, int, isZero, max, mul, parseCount, parseNumber, ratText, type NumberInput, type Rational } from './decimal';
import { run, type Line, type Result } from './money';
import { DEFAULTS, VOLUMETRIC_DIVISOR_CM3_PER_KG, pick } from './defaults';

export type FreightMode = 'express_courier' | 'air_cargo' | 'ocean';
export const FREIGHT_MODES: readonly FreightMode[] = ['express_courier', 'air_cargo', 'ocean'];
export interface PackageInput { count: NumberInput; lengthCm: NumberInput; widthCm: NumberInput; heightCm: NumberInput; weightKg: NumberInput }

export function checkMode(m: unknown): FreightMode {
  if (m === undefined || m === null || m === '') throw new PricingError('MISSING_REQUIRED', 'The freight mode is required (express_courier, air_cargo or ocean).');
  if (!FREIGHT_MODES.includes(m as FreightMode)) throw new PricingError('BAD_INPUT', `Unknown freight mode "${String(m)}".`);
  return m as FreightMode;
}

const CM3_PER_CBM = int(BigInt(1_000_000));
/** Totals of a list of packages: actual kg and volume in cm³ (count × L × W × H). */
export function packageTotals(pkgs: PackageInput[] | undefined, what: string): { kg: Rational; cm3: Rational } {
  if (!Array.isArray(pkgs) || !pkgs.length) throw new PricingError('MISSING_REQUIRED', `${what}: the packages (count, size and weight) are required.`);
  let kg = int(ZERO), cm3 = int(ZERO);
  pkgs.forEach((p, i) => {
    const at = `${what}.packages[${i}]`;
    const n = int(parseCount(p?.count, `${at}.count`));
    const l = parseNumber(p?.lengthCm, `${at}.lengthCm`, { maxDecimals: 2 }), w = parseNumber(p?.widthCm, `${at}.widthCm`, { maxDecimals: 2 }), h = parseNumber(p?.heightCm, `${at}.heightCm`, { maxDecimals: 2 });
    const wt = parseNumber(p?.weightKg, `${at}.weightKg`, { maxDecimals: 3 });
    kg = add(kg, mul(n, wt));
    cm3 = add(cm3, mul(mul(mul(n, l), w), h));
  });
  return { kg, cm3 };
}

/** The measure freight is charged on, before any rounding step: kg for air and courier, CBM (or W/M) for ocean. */
export function chargeBasis(t: { kg: Rational; cm3: Rational }, mode: FreightMode, wmKgPerCbm: Rational) {
  if (mode === 'ocean') {
    const cbm = div(t.cm3, CM3_PER_CBM), wm = div(t.kg, wmKgPerCbm);
    return { unit: 'CBM' as const, measure: max(cbm, wm), cbm, wm, volumetricKg: null as Rational | null };
  }
  const volumetricKg = div(t.cm3, int(BigInt(VOLUMETRIC_DIVISOR_CM3_PER_KG[mode])));
  return { unit: 'kg' as const, measure: max(t.kg, volumetricKg), cbm: null as Rational | null, wm: null as Rational | null, volumetricKg };
}

/** Round UP to the next multiple of `step` (no step, or a zero step: exact). */
export function roundUpToStep(x: Rational, step: Rational | null): Rational {
  if (!step || isZero(step)) return x;
  const q = div(x, step);
  let k = q.n / q.d; if (cmp(int(k), q) < 0) k += ONE;
  return mul(int(k), step);
}

export interface ChargeableInput { mode: FreightMode; packages: PackageInput[]; roundingStepKg?: NumberInput | null; roundingStepCbm?: NumberInput | null; wmKgPerCbm?: NumberInput }
export interface Chargeable { mode: FreightMode; unit: 'kg' | 'CBM'; actualKg: string; volumetricKg: string | null; cbm: string | null; weightMeasure: string | null; exact: string; chargeable: string; chargeableExact: Rational }

/** The shipment's chargeable weight (air, courier) or chargeable measure (ocean), with its breakdown. */
export function chargeable(input: ChargeableInput): Result<Chargeable> {
  return run((b) => measureShipment(input, b, 'shipment'));
}
/** Volumetric weight only (air, courier): L×W×H cm³ / divisor. */
export function volumetricWeight(input: { mode: FreightMode; packages: PackageInput[] }): Result<string> {
  return run((b) => {
    const mode = checkMode(input?.mode);
    if (mode === 'ocean') throw new PricingError('BAD_INPUT', 'Volumetric weight applies to express_courier and air_cargo; ocean uses CBM.');
    const t = packageTotals(input.packages, 'shipment');
    const v = chargeBasis(t, mode, int(ONE)).volumetricKg as Rational;
    b.push({ key: 'freight.volumetricKg', label: `Volumetric weight: ${ratText(t.cm3, 2)} cm³ / ${VOLUMETRIC_DIVISOR_CM3_PER_KG[mode]}`, value: `${ratText(v, 3)} kg`, source: 'packages × VOLUMETRIC_DIVISOR_CM3_PER_KG', basis: 'computed' });
    return ratText(v, 3);
  });
}

export function measureShipment(input: ChargeableInput, b: Line[], what: string): Chargeable {
  const mode = checkMode(input?.mode);
  const t = packageTotals(input.packages, what);
  const wmIn = pick(input.wmKgPerCbm, DEFAULTS.wmKgPerCbm as NumberInput);
  const wmKgPerCbm = parseNumber(wmIn.value, 'wmKgPerCbm', { maxDecimals: 3 });
  if (isZero(wmKgPerCbm)) throw new PricingError('DIVIDE_BY_ZERO', 'The W/M ratio (kg per CBM) cannot be zero.');
  const basis = chargeBasis(t, mode, wmKgPerCbm);
  const stepIn = mode === 'ocean' ? pick(input.roundingStepCbm, DEFAULTS.roundingStepCbm as NumberInput | null) : pick(input.roundingStepKg, DEFAULTS.roundingStepKg[mode] as NumberInput | null);
  const step = stepIn.value === null || stepIn.value === undefined ? null : parseNumber(stepIn.value, mode === 'ocean' ? 'roundingStepCbm' : 'roundingStepKg', { maxDecimals: 3 });
  const charged = roundUpToStep(basis.measure, step);
  b.push({ key: `${what}.actualKg`, label: 'Actual weight', value: `${ratText(t.kg, 3)} kg`, source: `${what}.packages`, basis: 'input' });
  if (mode === 'ocean') {
    b.push({ key: `${what}.cbm`, label: 'Volume', value: `${ratText(basis.cbm as Rational, 6)} CBM`, source: `${what}.packages`, basis: 'computed' });
    b.push({ key: `${what}.wmRatio`, label: 'Weight-or-measure ratio', value: `1 CBM = ${ratText(wmKgPerCbm, 3)} kg`, source: 'wmKgPerCbm', basis: wmIn.basis });
    b.push({ key: `${what}.weightMeasure`, label: 'Weight as measure (kg / ratio)', value: `${ratText(basis.wm as Rational, 6)} CBM`, source: 'formula', basis: 'computed' });
  } else {
    b.push({ key: `${what}.volumetricKg`, label: `Volumetric weight (cm³ / ${VOLUMETRIC_DIVISOR_CM3_PER_KG[mode]})`, value: `${ratText(basis.volumetricKg as Rational, 3)} kg`, source: 'VOLUMETRIC_DIVISOR_CM3_PER_KG', basis: 'computed' });
  }
  b.push({ key: `${what}.roundingStep`, label: 'Rounding step (up)', value: step ? `${ratText(step, 3)} ${basis.unit}` : 'none (exact)', source: mode === 'ocean' ? 'roundingStepCbm' : 'roundingStepKg', basis: stepIn.basis });
  b.push({ key: `${what}.chargeable`, label: mode === 'ocean' ? 'Chargeable measure (greater of CBM and W/M)' : 'Chargeable weight (greater of actual and volumetric)', value: `${ratText(charged, 3)} ${basis.unit}`, source: 'formula', basis: 'computed' });
  return {
    mode, unit: basis.unit, actualKg: ratText(t.kg, 3), volumetricKg: basis.volumetricKg ? ratText(basis.volumetricKg, 3) : null,
    cbm: basis.cbm ? ratText(basis.cbm, 6) : null, weightMeasure: basis.wm ? ratText(basis.wm, 6) : null,
    exact: ratText(basis.measure, 6), chargeable: ratText(charged, 3), chargeableExact: charged,
  };
}
