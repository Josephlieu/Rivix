// Pricing engine: the documented defaults (audit-docs/41-pricing-decisions.md). Every one can be overridden per quote; the
// breakdown marks each value as "default" or "override". Inputs with NO default (Incoterm, importer of record, freight mode,
// commission rate, exchange rates, quantities) are required and marked "required".
import type { Basis } from './money';
import type { CostKey } from './incoterms';
import type { NumberInput } from './decimal';

export type AllocationBasis = 'line_value' | 'freight_mode' | { manual: NumberInput[] };

/** Volumetric divisors in cm³ per kg (decision 2). Fixed per freight mode: choose the mode, not the divisor. */
export const VOLUMETRIC_DIVISOR_CM3_PER_KG = { express_courier: 5000, air_cargo: 6000 } as const;

export const DEFAULTS = {
  /** FX buffer on every amount converted from another currency, as its own landed-cost line (decisions 4, follow-up 2). */
  fxBuffer: '0.02',
  /** Ocean weight-or-measure: 1 CBM = 1000 kg (decision 2). */
  wmKgPerCbm: '1000',
  /** Chargeable weight rounds UP to this step, in kg (decision 2). */
  roundingStepKg: { express_courier: '0.5', air_cargo: '0.5' },
  /** Ocean: exact CBM; a step (in CBM) is optional (follow-up 1). */
  roundingStepCbm: null as string | null,
  /** Recoverable flag per tax kind (decision 8): import GST/HST recoverable (subject to accountant confirmation), PST not. */
  recoverable: { GST: true, HST: true, PST: false },
  /** CIF: destination terminal handling is a buyer line (follow-up 4). */
  cifDestinationHandlingPaidBy: 'buyer' as 'buyer' | 'supplier',
  /** Allocation basis per shared cost type (decision 12, correction 2): insurance, brokerage, clearance and other direct
   *  costs by line value (converted supplier cost); transport, freight, handling and delivery by the freight-mode basis
   *  (chargeable weight for air and courier, CBM or W/M for ocean). Manual weights are an override. */
  allocation: {
    originTransport: 'freight_mode', exportHandling: 'freight_mode', freight: 'freight_mode', destinationHandling: 'freight_mode', domesticDelivery: 'freight_mode',
    insurance: 'line_value', extraBuyerInsurance: 'line_value', brokerage: 'line_value', clearance: 'line_value', otherDirect: 'line_value',
  } as Record<CostKey, AllocationBasis>,
} as const;

export const RECOVERABLE_NOTE = 'subject to accountant confirmation';
export const SEA_TERMS_WARNING = 'FOB/CIF are sea terms; consider FCA/CPT/CIP';
export const EXW_SUPPLIER_IMPORTER_WARNING = 'EXW normally means RIVIX imports; check the importer of record';

/** The value to use and whether it was the default or an override. */
export function pick<T>(given: T | undefined | null, fallback: T): { value: T; basis: Basis } {
  return given === undefined || given === null ? { value: fallback, basis: 'default' } : { value: given, basis: 'override' };
}
