// Pricing engine: one quote, end to end, with a breakdown line for every amount (what it is, the input it came from, and
// whether a value was a default, an override or a required input). Order of work:
//   1. required inputs: Incoterm, importer of record, freight mode, commission rate (no defaults);
//   2. each product line: supplier cost = unit cost × quantity (rounded half up), converted to CAD with its FX buffer line;
//      duties per line;
//   3. shared order costs (freight, insurance, brokerage, ...): checked against the Incoterm (a supplier-paid line given a
//      value is refused), converted with their own FX buffer lines, and allocated over the lines (largest remainder, exact);
//   4. landed cost per line and per order (taxes never included);
//   5. selling price per unit (given, or from a target margin, rounded UP), extended = unit × quantity; gross profit,
//      margin and markup on the extended amounts;
//   6. import taxes (recoverable or not, never in landed cost), sales taxes on the selling price, commission on the order's
//      gross profit.
import { PricingError, ZERO, div, int, isZero, parseNumber, percentText, ratText, type NumberInput, type Rational } from './decimal';
import { asRational, money, moneyText, multiply, parseAmount, parseMoney, plus, run, sum, toMoney, type AmountInput, type Money, type Result } from './money';
import { DEFAULTS, EXW_SUPPLIER_IMPORTER_WARNING, SEA_TERMS_WARNING, pick, type AllocationBasis } from './defaults';
import { HOME, readFx, toCad, type FxRateInput } from './fx';
import { chargeBasis, checkMode, measureShipment, packageTotals, type Chargeable, type FreightMode, type PackageInput } from './freight';
import { splitCents } from './allocate';
import { lineDuties, type DutyInput } from './duty';
import { COST_KEYS, COST_LABEL, checkImporter, checkIncoterm, checkPayer, type CostKey, type ImporterOfRecord, type Incoterm } from './incoterms';
import { importTaxLines, salesTaxLines, type ImportTaxesInput, type SalesTaxLineInput } from './tax';
import { grossProfitOf, marginOf, markupOf, priceForMargin, readTargetMargin } from './profit';
import { commissionOn } from './commission';

export interface QuoteLineInput {
  id: string;
  description?: string;
  quantity: NumberInput;
  /** Up to 4 decimals (e.g. USD 0.3850 per pair). */
  supplierUnitCost: AmountInput;
  /** Needed to allocate shared costs by freight mode. */
  packages?: PackageInput[];
  duties?: DutyInput;
  /** Exactly one of these two. The selling price is in CAD, excl. tax. */
  sellingUnitPrice?: AmountInput;
  targetMargin?: NumberInput;
}
type SharedKey = Exclude<CostKey, 'otherDirect'>;
export interface QuoteInput {
  incoterm: Incoterm;
  importerOfRecord: ImporterOfRecord;
  freightMode: FreightMode;
  commissionRate: NumberInput;
  fx?: FxRateInput[];
  fxBuffer?: NumberInput;
  roundingStepKg?: NumberInput | null;
  roundingStepCbm?: NumberInput | null;
  wmKgPerCbm?: NumberInput;
  cifDestinationHandlingPaidBy?: 'buyer' | 'supplier';
  /** Allocation basis per shared cost type (defaults: DEFAULTS.allocation). A cost's FX buffer follows that cost. */
  allocation?: Partial<Record<CostKey, AllocationBasis>>;
  costs?: Partial<Record<SharedKey, AmountInput>> & { otherDirect?: Array<{ label: string; amount: AmountInput }> };
  importTaxes?: ImportTaxesInput;
  salesTaxes?: SalesTaxLineInput[];
  lines: QuoteLineInput[];
}

export interface QuoteLineResult {
  id: string; quantity: string;
  supplierCost: Money; fxBuffer: Money; duties: Money; sharedCosts: Money; landedCost: Money; unitLandedCost: string;
  priceBasis: 'sellingUnitPrice' | 'targetMargin'; unitPrice: Money; extendedPrice: Money;
  grossProfit: Money; margin: string; markup: string | null;
}
export interface QuoteResult {
  incoterm: Incoterm; importerOfRecord: ImporterOfRecord; freightMode: FreightMode; shipment: Chargeable | null;
  lines: QuoteLineResult[];
  landedCost: Money; sellingTotal: Money; grossProfit: Money; margin: string; markup: string | null;
  salesTaxes: Money; totalInclTax: Money;
  importTaxes: { recoverable: Money; notRecoverable: Money; insideSupplierPrice: boolean };
  commission: Money;
}

const ZERO_CAD = () => money(ZERO, HOME);
const SHARED_KEYS: readonly SharedKey[] = ['originTransport', 'exportHandling', 'freight', 'insurance', 'extraBuyerInsurance', 'clearance', 'brokerage', 'destinationHandling', 'domesticDelivery'];

export function quote(input: QuoteInput): Result<QuoteResult> {
  return run((b, warnings) => {
    if (!input || typeof input !== 'object') throw new PricingError('BAD_INPUT', 'A quote needs its inputs.');
    // 1. Required inputs (no defaults).
    const term = checkIncoterm(input.incoterm);
    const ior = checkImporter(input.importerOfRecord);
    const mode = checkMode(input.freightMode);
    if (input.commissionRate === undefined || input.commissionRate === null || input.commissionRate === '') throw new PricingError('MISSING_REQUIRED', 'commissionRate is required (no default: the rate depends on the account).');
    if (term === 'DDP' && ior === 'rivix') throw new PricingError('INCONSISTENT', 'DDP means the supplier delivers duty paid and clears the import: the importer of record must be the supplier.');
    b.push({ key: 'incoterm', label: 'Incoterm', value: term, source: 'incoterm', basis: 'required' });
    b.push({ key: 'importerOfRecord', label: 'Importer of record', value: ior, source: 'importerOfRecord', basis: 'required' });
    b.push({ key: 'freightMode', label: 'Freight mode', value: mode, source: 'freightMode', basis: 'required' });
    if (term === 'EXW' && ior === 'supplier') {
      warnings.push(EXW_SUPPLIER_IMPORTER_WARNING);
      b.push({ key: 'warning.exwImporter', label: 'Warning', value: EXW_SUPPLIER_IMPORTER_WARNING, source: 'incoterm + importerOfRecord', basis: 'computed' });
    }
    if ((term === 'FOB' || term === 'CIF') && mode !== 'ocean') {
      warnings.push(SEA_TERMS_WARNING);
      b.push({ key: 'warning.seaTerms', label: 'Warning', value: SEA_TERMS_WARNING, source: 'incoterm + freightMode', basis: 'computed' });
    }
    const fx = readFx(input.fx);
    const bufIn = pick(input.fxBuffer, DEFAULTS.fxBuffer as NumberInput);
    const buffer = { value: parseNumber(bufIn.value, 'fxBuffer', { maxDecimals: 6 }), basis: bufIn.basis };
    const cifIn = pick(input.cifDestinationHandlingPaidBy, DEFAULTS.cifDestinationHandlingPaidBy);
    if (cifIn.value !== 'buyer' && cifIn.value !== 'supplier') throw new PricingError('BAD_INPUT', "cifDestinationHandlingPaidBy must be 'buyer' or 'supplier'.");
    const opts = { cifDestinationHandlingPaidBy: cifIn.value };
    if (term === 'CIF') b.push({ key: 'cifDestinationHandlingPaidBy', label: 'CIF: destination terminal handling paid by', value: cifIn.value, source: 'cifDestinationHandlingPaidBy', basis: cifIn.basis });

    if (!Array.isArray(input.lines) || !input.lines.length) throw new PricingError('MISSING_REQUIRED', 'A quote needs at least one product line.');
    const ids = new Set<string>();

    // 2. Product lines: supplier cost (converted, with its FX buffer) and duties.
    const lines = input.lines.map((l, i) => {
      const src = `lines[${i}]`;
      if (!l || typeof l.id !== 'string' || !l.id.trim()) throw new PricingError('MISSING_REQUIRED', `${src}.id is required.`);
      if (ids.has(l.id)) throw new PricingError('BAD_INPUT', `${src}.id "${l.id}" is used twice.`);
      ids.add(l.id);
      const key = `line.${l.id}`;
      const qtyR = parseNumber(l.quantity, `${src}.quantity`, { maxDecimals: 0 });
      if (qtyR.n === ZERO) throw new PricingError('ZERO_QUANTITY', `${src}.quantity cannot be zero.`);
      const qty = qtyR.n;
      const unit = parseAmount(l.supplierUnitCost, `${src}.supplierUnitCost`, { maxDecimals: 4 });
      const ext = toMoney({ n: unit.value.n * qty, d: unit.value.d }, unit.currency);
      b.push({ key: `${key}.supplierCost`, label: `Supplier cost (${l.id}): ${qty} × ${unit.currency} ${ratText(unit.value, 4)}`, money: ext, source: `${src}.supplierUnitCost × ${src}.quantity`, basis: 'input' });
      const conv = toCad(ext, fx, buffer, `${key}.supplierCost`, `Supplier cost (${l.id})`, `${src}.supplierUnitCost`, b);
      let duties = ZERO_CAD();
      if (l.duties !== undefined) {
        checkPayer(term, 'duties', true, opts, `${src}.duties`);
        duties = lineDuties(l.duties, qty, key, `${src}.duties`, b);
      }
      return { src, key, l, qty, supplierCost: conv.cad, fxBuffer: conv.buffer, duties };
    });

    // 3. Shared order costs.
    const shared: Array<{ key: string; label: string; amount: Money; type: CostKey }> = [];
    const addShared = (k: CostKey, label: string, v: AmountInput | undefined, src: string) => {
      if (v === undefined) {
        if (k === 'freight' && checkPayer(term, 'freight', false, opts, src) === 'buyer') b.push({ key: 'costs.freight', label: 'Freight: not given (counted as 0)', money: ZERO_CAD(), source: src, basis: 'input' });
        return;
      }
      const m = parseMoney(v, src);
      checkPayer(term, k, m.cents !== ZERO, opts, `${src} (${label})`);
      if (m.cents === ZERO) return;
      const key = `costs.${k === 'otherDirect' ? `otherDirect.${shared.length}` : k}`;
      b.push({ key, label, money: m, source: src, basis: 'input' });
      const conv = toCad(m, fx, buffer, key, label, src, b);
      shared.push({ key, label, amount: conv.cad, type: k });
      // A buffer on a shared converted amount follows that amount's allocation (same type, same basis).
      if (conv.buffer.cents !== ZERO) shared.push({ key: `${key}.fxBuffer`, label: `FX buffer on ${label.toLowerCase()}`, amount: conv.buffer, type: k });
    };
    const costs = input.costs ?? {};
    for (const k of SHARED_KEYS) addShared(k, COST_LABEL[k], costs[k], `costs.${k}`);
    (costs.otherDirect ?? []).forEach((o, i) => {
      if (!o || typeof o.label !== 'string' || !o.label.trim()) throw new PricingError('MISSING_REQUIRED', `costs.otherDirect[${i}].label is required.`);
      addShared('otherDirect', `Other direct cost: ${o.label.trim()}`, o.amount, `costs.otherDirect[${i}].amount`);
    });

    // Freight measures: the shipment's chargeable weight or measure (shown), and each line's share basis.
    const allPackages = lines.every((x) => Array.isArray(x.l.packages) && x.l.packages.length);
    let shipment: Chargeable | null = null;
    if (allPackages) {
      shipment = measureShipment({ mode, packages: lines.flatMap((x) => x.l.packages as PackageInput[]), roundingStepKg: input.roundingStepKg, roundingStepCbm: input.roundingStepCbm, wmKgPerCbm: input.wmKgPerCbm }, b, 'shipment');
    }
    // Each shared cost type has its own basis (decision 12 + correction 2): line value (the line's converted supplier cost)
    // or the freight-mode basis (chargeable weight, or CBM / W-M), or manual weights. A line's own supplier-cost FX buffer
    // is never shared: it stays on that line.
    const allocated = lines.map(() => ZERO_CAD());
    const weightsFor = new Map<string, Rational[]>();
    const basisWeights = (type: CostKey, basis: AllocationBasis): { id: string; weights: Rational[]; describe: string } => {
      if (basis === 'line_value') {
        if (!weightsFor.has('line_value')) weightsFor.set('line_value', lines.map((x) => asRational(x.supplierCost)));
        return { id: 'line_value', weights: weightsFor.get('line_value') as Rational[], describe: 'line value (converted supplier cost)' };
      }
      if (basis === 'freight_mode') {
        if (!weightsFor.has('freight_mode')) {
          if (!allPackages) throw new PricingError('MISSING_REQUIRED', `Allocating ${COST_LABEL[type].toLowerCase()} by freight mode needs the packages of every product line (or choose line_value or manual for it).`);
          const wm = parseNumber(input.wmKgPerCbm ?? DEFAULTS.wmKgPerCbm, 'wmKgPerCbm', { maxDecimals: 3 });
          if (isZero(wm)) throw new PricingError('DIVIDE_BY_ZERO', 'The W/M ratio (kg per CBM) cannot be zero.');
          weightsFor.set('freight_mode', lines.map((x) => chargeBasis(packageTotals(x.l.packages, x.src), mode, wm).measure));
        }
        return { id: 'freight_mode', weights: weightsFor.get('freight_mode') as Rational[], describe: mode === 'ocean' ? 'freight mode: greater of CBM and W/M per line' : 'freight mode: chargeable weight per line (before the rounding step)' };
      }
      if (basis && typeof basis === 'object' && Array.isArray(basis.manual)) {
        if (basis.manual.length !== lines.length) throw new PricingError('BAD_INPUT', `allocation.${type}.manual needs one weight per product line (${lines.length}).`);
        return { id: `manual.${type}`, weights: basis.manual.map((w, i) => parseNumber(w, `allocation.${type}.manual[${i}]`, { maxDecimals: 6 })), describe: 'manual weights' };
      }
      throw new PricingError('BAD_INPUT', `allocation.${type}: use 'line_value', 'freight_mode' or { manual: [...] }.`);
    };
    for (const k of Object.keys(input.allocation ?? {})) if (!(COST_KEYS as readonly string[]).includes(k)) throw new PricingError('BAD_INPUT', `allocation.${k}: not a shared cost type (${COST_KEYS.join(', ')}).`);
    const shown = new Set<string>();
    for (const s of shared) {
      const chosen = pick(input.allocation?.[s.type], DEFAULTS.allocation[s.type] as AllocationBasis);
      const w = basisWeights(s.type, chosen.value);
      if (!shown.has(s.type)) {
        shown.add(s.type);
        b.push({ key: `allocation.${s.type}`, label: `${COST_LABEL[s.type]}: allocated by ${w.describe}`, value: w.weights.map((x, i) => `${lines[i].l.id} ${ratText(x, 6)}`).join(', '), source: `allocation.${s.type}`, basis: chosen.basis });
      }
      splitCents(s.amount, w.weights).forEach((p, i) => {
        allocated[i] = plus(allocated[i], p);
        b.push({ key: `${lines[i].key}.allocated.${s.key}`, label: `${s.label}: share for ${lines[i].l.id}`, money: p, source: `${s.key} split by ${w.describe} (largest remainder)`, basis: 'computed' });
      });
    }

    // 4.-5. Landed cost, selling price, profit per line.
    const results: QuoteLineResult[] = lines.map((x, i) => {
      const landed = sum([x.supplierCost, x.fxBuffer, x.duties, allocated[i]], HOME, 'Landed cost');
      b.push({ key: `${x.key}.landedCost`, label: `Landed cost (${x.l.id}): supplier ${moneyText(x.supplierCost)} + FX buffer ${moneyText(x.fxBuffer)} + duties ${moneyText(x.duties)} + shared costs ${moneyText(allocated[i])}`, money: landed, source: 'formula (taxes never included)', basis: 'computed' });
      const unitLanded = div(asRational(landed), int(x.qty));
      const hasPrice = x.l.sellingUnitPrice !== undefined, hasMargin = x.l.targetMargin !== undefined;
      if (hasPrice === hasMargin) throw new PricingError('BAD_INPUT', `${x.src}: give exactly one of sellingUnitPrice or targetMargin.`);
      let unitPrice: Money;
      if (hasMargin) {
        const m = readTargetMargin(x.l.targetMargin, `${x.src}.targetMargin`);
        unitPrice = priceForMargin(unitLanded, m, HOME);
        b.push({ key: `${x.key}.unitPrice`, label: `Unit price (${x.l.id}): unit landed ${HOME} ${ratText(unitLanded, 4)} / (1 − ${percentText(m, 4)}), rounded up to the cent`, money: unitPrice, source: `${x.src}.targetMargin`, basis: 'input' });
      } else {
        unitPrice = parseMoney(x.l.sellingUnitPrice, `${x.src}.sellingUnitPrice`);
        if (unitPrice.currency !== HOME) throw new PricingError('CURRENCY_MISMATCH', `${x.src}.sellingUnitPrice: selling prices are in ${HOME} (landed cost is in ${HOME}).`);
        b.push({ key: `${x.key}.unitPrice`, label: `Unit price (${x.l.id}), excl. tax`, money: unitPrice, source: `${x.src}.sellingUnitPrice`, basis: 'input' });
      }
      const extended = multiply(unitPrice, x.qty);
      b.push({ key: `${x.key}.extendedPrice`, label: `Extended price (${x.l.id}): ${x.qty} × ${moneyText(unitPrice)}`, money: extended, source: 'unit price × quantity (exact)', basis: 'computed' });
      const gp = grossProfitOf(extended, landed);
      const margin = marginOf(gp, extended);
      const markup = landed.cents === ZERO ? null : markupOf(gp, landed);
      b.push({ key: `${x.key}.grossProfit`, label: `Gross profit (${x.l.id}): ${moneyText(extended)} − ${moneyText(landed)}`, money: gp, value: `margin ${percentText(margin)}, markup ${markup ? percentText(markup) : 'n/a'}`, source: 'extended price − landed cost', basis: 'computed' });
      return {
        id: x.l.id, quantity: x.qty.toString(), supplierCost: x.supplierCost, fxBuffer: x.fxBuffer, duties: x.duties, sharedCosts: allocated[i], landedCost: landed,
        unitLandedCost: ratText(unitLanded, 4), priceBasis: hasMargin ? 'targetMargin' : 'sellingUnitPrice', unitPrice, extendedPrice: extended,
        grossProfit: gp, margin: percentText(margin), markup: markup ? percentText(markup) : null,
      };
    });

    // Order totals. The landed cost must equal the sum of its parts exactly (a check on this code, not on the inputs).
    const landedCost = sum(results.map((r) => r.landedCost), HOME);
    const parts = sum([...lines.flatMap((x) => [x.supplierCost, x.fxBuffer, x.duties]), ...shared.map((s) => s.amount)], HOME);
    if (landedCost.cents !== parts.cents) throw new Error(`pricing: landed cost ${landedCost.cents} differs from its parts ${parts.cents}`);
    const sellingTotal = sum(results.map((r) => r.extendedPrice), HOME);
    const gp = grossProfitOf(sellingTotal, landedCost);
    const margin = marginOf(gp, sellingTotal);
    const markup = landedCost.cents === ZERO ? null : markupOf(gp, landedCost);
    b.push({ key: 'order.landedCost', label: 'Order landed cost (taxes never included)', money: landedCost, source: 'sum of the line landed costs', basis: 'computed' });
    b.push({ key: 'order.sellingTotal', label: 'Order selling price excl. tax', money: sellingTotal, source: 'sum of the extended prices', basis: 'computed' });
    b.push({ key: 'order.grossProfit', label: 'Order gross profit', money: gp, value: `margin ${percentText(margin)}, markup ${markup ? percentText(markup) : 'n/a'}`, source: 'selling price excl. tax − landed cost', basis: 'computed' });

    // 6. Taxes and commission.
    let recoverable = ZERO_CAD(), notRecoverable = ZERO_CAD();
    const inside = ior === 'supplier';
    if (inside) {
      if (input.importTaxes !== undefined) throw new PricingError('DOUBLE_COUNTED', 'importTaxes: the supplier is importer of record, so import taxes are inside the supplier price; a separate amount would count them twice.');
      b.push({ key: 'importTaxes.insideSupplierPrice', label: 'Import taxes: inside the supplier price (the supplier is importer of record), not recoverable by RIVIX', source: 'importerOfRecord', basis: 'required' });
    } else if (input.importTaxes !== undefined) {
      checkPayer(term, 'importTaxes', true, opts, 'importTaxes');
      const t = importTaxLines(input.importTaxes, b);
      recoverable = t.recoverable; notRecoverable = t.notRecoverable;
    }
    const st = salesTaxLines(sellingTotal, input.salesTaxes, b);
    const totalInclTax = plus(sellingTotal, st.total);
    b.push({ key: 'order.totalInclTax', label: 'Order total incl. sales taxes', money: totalInclTax, source: 'selling price excl. tax + sales taxes', basis: 'computed' });
    const commission = commissionOn(gp, input.commissionRate, b);

    return {
      incoterm: term, importerOfRecord: ior, freightMode: mode, shipment, lines: results,
      landedCost, sellingTotal, grossProfit: gp, margin: percentText(margin), markup: markup ? percentText(markup) : null,
      salesTaxes: st.total, totalInclTax, importTaxes: { recoverable, notRecoverable, insideSupplierPrice: inside }, commission,
    };
  });
}
