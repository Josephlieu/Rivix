// Pricing engine: who pays which cost line under each Incoterm (decision 6, follow-up 5), so nothing is counted twice.
// The Incoterm is a REQUIRED input with no default. A line the supplier pays is inside the supplier price: giving it a value
// is refused as double counting.
//   EXW: the buyer pays everything from the supplier's door: origin transport, export handling, freight, insurance,
//        clearance and brokerage, duties, taxes and final delivery.
//   FOB: the supplier pays origin transport and export handling; the buyer pays freight, insurance and all import costs.
//   CIF: the supplier also pays the main freight and (minimum) insurance to the destination port; an extra buyer insurance
//        line is allowed; destination terminal handling is a buyer line by default (overridable).
//   DDP: delivery, clearance, duties and taxes are inside the supplier price.
import { PricingError } from './decimal';

export type Incoterm = 'EXW' | 'FOB' | 'CIF' | 'DDP';
export const INCOTERMS: readonly Incoterm[] = ['EXW', 'FOB', 'CIF', 'DDP'];
export type ImporterOfRecord = 'rivix' | 'supplier';
export type CostKey = 'originTransport' | 'exportHandling' | 'freight' | 'insurance' | 'extraBuyerInsurance' | 'clearance' | 'brokerage'
  | 'destinationHandling' | 'domesticDelivery' | 'otherDirect';
export const COST_KEYS: readonly CostKey[] = ['originTransport', 'exportHandling', 'freight', 'insurance', 'extraBuyerInsurance', 'clearance', 'brokerage', 'destinationHandling', 'domesticDelivery', 'otherDirect'];
export const COST_LABEL: Record<CostKey, string> = {
  originTransport: 'Origin transport', exportHandling: 'Export handling', freight: 'Freight', insurance: 'Insurance',
  extraBuyerInsurance: 'Extra buyer insurance', clearance: 'Customs clearance', brokerage: 'Brokerage',
  destinationHandling: 'Port / terminal handling (destination)', domesticDelivery: 'Domestic delivery', otherDirect: 'Other direct costs',
};
/** Who pays: 'buyer' (a RIVIX cost line), 'supplier' (inside the supplier price) or 'not_used' (this line does not exist under the term). */
export type Payer = 'buyer' | 'supplier' | 'not_used';
export type Covered = CostKey | 'duties' | 'importTaxes';

export function checkIncoterm(v: unknown): Incoterm {
  if (v === undefined || v === null || v === '') throw new PricingError('MISSING_REQUIRED', 'The Incoterm is required (EXW, FOB, CIF or DDP); there is no default.');
  if (!INCOTERMS.includes(v as Incoterm)) throw new PricingError('BAD_INPUT', `Incoterm "${String(v)}" is not supported (EXW, FOB, CIF, DDP).`);
  return v as Incoterm;
}
export function checkImporter(v: unknown): ImporterOfRecord {
  if (v !== 'rivix' && v !== 'supplier') throw new PricingError('MISSING_REQUIRED', "importerOfRecord is required: 'rivix' or 'supplier'.");
  return v;
}

export function payer(term: Incoterm, line: Covered, opts: { cifDestinationHandlingPaidBy: 'buyer' | 'supplier' }): Payer {
  if (line === 'otherDirect') return 'buyer';
  if (line === 'extraBuyerInsurance') return term === 'CIF' ? 'buyer' : 'not_used';
  switch (term) {
    case 'EXW': return 'buyer';
    case 'FOB': return line === 'originTransport' || line === 'exportHandling' ? 'supplier' : 'buyer';
    case 'CIF':
      if (line === 'originTransport' || line === 'exportHandling' || line === 'freight' || line === 'insurance') return 'supplier';
      if (line === 'destinationHandling') return opts.cifDestinationHandlingPaidBy;
      return 'buyer';
    case 'DDP': return 'supplier'; // everything to the named place, duties and taxes included (otherDirect handled above)
  }
}

/** Refuses a supplier-paid (or unused) line that was given a value. */
export function checkPayer(term: Incoterm, line: Covered, hasValue: boolean, opts: { cifDestinationHandlingPaidBy: 'buyer' | 'supplier' }, label: string): Payer {
  const p = payer(term, line, opts);
  if (hasValue && p === 'supplier') throw new PricingError('DOUBLE_COUNTED', `${label}: under ${term} the supplier pays this; it is inside the supplier price, so a separate amount would count it twice.`);
  if (hasValue && p === 'not_used') throw new PricingError('BAD_INPUT', `${label}: only CIF has an extra buyer insurance line (CIF cover is the minimum); under ${term} use "insurance".`);
  return p;
}
