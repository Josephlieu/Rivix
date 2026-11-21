// Pricing engine (2026-11-21, audit-docs/41-pricing-decisions.md). Offline: no server, no database, no network.
//   - each approved formula, with cent-exact expectations worked out by hand (not copied from the code);
//   - edge cases: zero quantity, missing freight, margin of 100% or more, negative values, currency mismatch, missing
//     required inputs, double counting under DDP/FOB/CIF;
//   - shared-cost allocation always adds up exactly (largest remainder);
//   - two end-to-end worked examples, "illustrative, not RIVIX data": an EXW air-cargo order and a DDP order;
//   - the rule that the library reads no network, database, clock, randomness or environment (import scan + a run with
//     the network blocked), and that money is never a floating-point number.
// Run: node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/pricing.test.mjs
import fs from 'fs';
import path from 'path';

const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);

// Block the network for the whole run: any attempt is recorded (and fails).
const attempts = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (...a) => { attempts.push(`fetch ${String(a[0])}`); return Promise.reject(new Error('network blocked in pricing tests')); };
const http = (await import('http')).default, https = (await import('https')).default, net = (await import('net')).default;
const block = (mod, name, fn) => { const real = mod[fn]; mod[fn] = (...a) => { attempts.push(`${name}.${fn}`); throw new Error('network blocked'); }; return () => { mod[fn] = real; }; };
const restore = [block(http, 'http', 'request'), block(http, 'http', 'get'), block(https, 'https', 'request'), block(https, 'https', 'get'), block(net, 'net', 'connect'), block(net, 'net', 'createConnection')];

const P = await import('../../src/lib/pricing/index.ts');
const cad = (s) => ({ amount: s, currency: 'CAD' }), usd = (s) => ({ amount: s, currency: 'USD' });
const cents = (m) => (m ? `${m.currency} ${P.scaledToText(m.cents, 2)}` : String(m));
const eq = (m, text) => cents(m) === text;
const err = (r) => (r.ok ? 'ok' : r.error.code);
const line = (r, key) => (r.ok ? r.breakdown.find((l) => l.key === key) : undefined);
const FX = [{ from: 'USD', to: 'CAD', rate: '1.3500', date: '2026-11-20', source: 'illustrative rate, not RIVIX data' }];

// =====================================================================================================================
// Exact numbers, money, rounding
// =====================================================================================================================
const parse = (v, o) => { try { return P.parseNumber(v, 'x', o); } catch (e) { return e.code; } };
ok('a JS number with a fraction is refused (money is never floating point); whole numbers and decimal text are read exactly', parse(0.1) === 'NOT_A_NUMBER' && parse(3).n === BigInt(3) && P.ratText(parse('0.10'), 2) === '0.10');
ok('exponents, empty values, negative values and too many decimals are refused', parse('1e3') === 'NOT_A_NUMBER' && parse('') === 'MISSING_REQUIRED' && parse('-1') === 'NEGATIVE' && parse('1.234', { maxDecimals: 2 }) === 'TOO_MANY_DECIMALS');
const R = (n, d) => P.rat(BigInt(n), BigInt(d));
ok('rounding is half up (away from zero) to the cent: 0.025 → 0.03, 0.0249 → 0.02, −0.025 → −0.03', P.roundHalfUp(R(25, 1000), 2) === BigInt(3) && P.roundHalfUp(R(249, 10000), 2) === BigInt(2) && P.roundHalfUp(R(-25, 1000), 2) === BigInt(-3));
ok('rounding up (price from target margin only): 8.504 → 8.51, 8.50 stays 8.50', P.roundUp(R(8504, 1000), 2) === BigInt(851) && P.roundUp(R(850, 100), 2) === BigInt(850));
ok('amount × rate rounds once: CAD 80.946 → 80.95 (2% of 4,047.30), CAD 0.05 × 0.5 → 0.03', eq(P.times(P.money(BigInt(404730), 'CAD'), R(2, 100)), 'CAD 80.95') && eq(P.times(P.money(BigInt(5), 'CAD'), R(1, 2)), 'CAD 0.03'));
let threw = null; try { P.plus(P.money(BigInt(100), 'CAD'), P.money(BigInt(100), 'USD')); } catch (e) { threw = e.code; }
ok('currency mismatch: adding CAD and USD is refused', threw === 'CURRENCY_MISMATCH');
threw = null; try { P.parseMoney({ amount: '1.00', currency: 'cad' }, 'x'); } catch (e) { threw = e.code; }
ok('a currency must be a 3-letter ISO code', threw === 'BAD_CURRENCY');

// =====================================================================================================================
// Freight measures
// =====================================================================================================================
const box = (count, l, w, h, kg) => ({ count, lengthCm: l, widthCm: w, heightCm: h, weightKg: kg });
let r = P.volumetricWeight({ mode: 'express_courier', packages: [box(1, 50, 50, 40, '5')] });
ok('express courier: volumetric = 50×50×40 cm³ / 5000 = 20 kg', r.ok && r.value === '20.000', JSON.stringify(r));
r = P.volumetricWeight({ mode: 'air_cargo', packages: [box(1, 50, 50, 40, '5')] });
ok('air cargo: volumetric = 100,000 cm³ / 6000 = 16.667 kg', r.ok && r.value === '16.667');
ok('the divisors are named constants: courier 5000, air 6000', P.VOLUMETRIC_DIVISOR_CM3_PER_KG.express_courier === 5000 && P.VOLUMETRIC_DIVISOR_CM3_PER_KG.air_cargo === 6000);
r = P.chargeable({ mode: 'air_cargo', packages: [box(1, 60, 50, 40, '25.2')] }); // volumetric 120,000/6000 = 20 kg; actual 25.2
ok('air: chargeable = greater of actual (25.2) and volumetric (20), rounded UP to the next 0.5 kg (default) = 25.5', r.ok && r.value.chargeable === '25.500' && line(r, 'shipment.roundingStep').basis === 'default');
r = P.chargeable({ mode: 'air_cargo', packages: [box(1, 60, 50, 40, '25.2')], roundingStepKg: '0' });
ok('  the step is an input: with no step the chargeable weight is exact (25.2), marked "override"', r.ok && r.value.chargeable === '25.200' && line(r, 'shipment.roundingStep').basis === 'override');
r = P.chargeable({ mode: 'express_courier', packages: [box(3, 40, 30, 30, '4')] }); // 108,000/5000 = 21.6 vol; actual 12
ok('courier: volumetric wins (21.6 kg > 12 kg) and rounds up to 22.0', r.ok && r.value.volumetricKg === '21.600' && r.value.chargeable === '22.000');
r = P.chargeable({ mode: 'ocean', packages: [box(2, 100, 100, 100, '1250')] }); // 2 CBM; 2500 kg / 1000 = 2.5
ok('ocean: greater of CBM (2) and W/M (2500 kg / 1000 = 2.5) = 2.5, exact by default', r.ok && r.value.cbm === '2.000000' && r.value.weightMeasure === '2.500000' && r.value.chargeable === '2.500' && line(r, 'shipment.roundingStep').value === 'none (exact)');
r = P.chargeable({ mode: 'ocean', packages: [box(2, 100, 100, 100, '500')], wmKgPerCbm: '333', roundingStepCbm: '0.1' }); // 1000/333 = 3.003 → 3.1
ok('ocean: W/M ratio and a CBM step are inputs (1000 kg / 333 = 3.003 → 3.1 CBM), marked "override"', r.ok && r.value.chargeable === '3.100' && line(r, 'shipment.wmRatio').basis === 'override');
r = P.chargeable({ mode: 'air_cargo', packages: [box(1, 10, 10, 10, '-1')] });
ok('a negative weight is refused', err(r) === 'NEGATIVE');
r = P.chargeable({ mode: 'air_cargo', packages: [box(0, 10, 10, 10, '1')] });
ok('a package count of zero is refused', err(r) === 'ZERO_QUANTITY');
r = P.chargeable({ packages: [box(1, 10, 10, 10, '1')] });
ok('the freight mode is required (no default)', err(r) === 'MISSING_REQUIRED');

// =====================================================================================================================
// Allocation: always exactly the bill (largest remainder)
// =====================================================================================================================
const split = (c, ws) => P.allocate(P.money(BigInt(c), 'CAD'), ws.map((w) => P.parseNumber(w, 'w')));
r = split(10000, ['1', '1', '1']);
ok('CAD 100.00 over 3 equal lines: 33.34 + 33.33 + 33.33 (the leftover cent goes to the first on a tie)', r.ok && r.value.map(cents).join(',') === 'CAD 33.34,CAD 33.33,CAD 33.33');
r = split(1000, ['1', '2']);
ok('CAD 10.00 split 1:2: 3.33 + 6.67 (the larger remainder gets the cent)', r.ok && r.value.map(cents).join(',') === 'CAD 3.33,CAD 6.67');
r = split(1, ['0.2', '0.5', '0.3']);
ok('one cent split 0.2/0.5/0.3 goes to the largest share', r.ok && r.value.map((m) => m.cents.toString()).join(',') === '0,1,0');
let exact = true, near = true;
for (const total of [1, 2, 99, 100, 101, 12345, 99999, 1000003]) {
  for (const ws of [['1', '1', '1'], ['1', '2', '3', '4'], ['0.333', '0.333', '0.334'], ['7', '0', '13'], ['160', '40'], ['1.5', '2.25', '3.125', '0.001']]) {
    const s = split(total, ws); if (!s.ok) { exact = false; continue; }
    const got = s.value.reduce((a, m) => a + m.cents, BigInt(0));
    if (got !== BigInt(total)) exact = false;
    const W = ws.map((w) => P.parseNumber(w, 'w')).reduce((a, w) => P.add(a, w), P.int(BigInt(0)));
    s.value.forEach((m, i) => { const share = P.mul(P.int(BigInt(total)), P.div(P.parseNumber(ws[i], 'w'), W)); const diff = P.sub(P.int(m.cents), share); if (P.cmp(diff, P.int(BigInt(1))) >= 0 || P.cmp(diff, P.int(BigInt(-1))) <= 0) near = false; });
  }
}
ok('48 splits: the parts always add up EXACTLY to the bill', exact);
ok('  and each part is within one cent of its exact share', near);
ok('a zero weight gets nothing; all-zero weights are refused', split(1000, ['0', '1']).ok && split(1000, ['0', '1']).value[0].cents === BigInt(0) && err(split(1000, ['0', '0'])) === 'DIVIDE_BY_ZERO');

// =====================================================================================================================
// Duties
// =====================================================================================================================
const hs = { hsCode: '6116.10', countryOfOrigin: 'CN', tariffTreatment: 'MFN' };
r = P.duties({ ...hs, dutyBase: cad('1000.00'), customs_duty: { rate: '0.18' }, surtax: { rate: '0.10', base: cad('500.00') }, anti_dumping: { perUnit: cad('0.25') }, countervailing: { rate: '0.02', perUnit: cad('0.10') } }, 100);
// 180.00 + 50.00 + 25.00 + (20.00 + 10.00) = 285.00
ok('duties: customs 18% of 1,000 (180.00) + surtax 10% of its own base 500 (50.00) + anti-dumping 0.25/unit × 100 (25.00) + countervailing 2% + 0.10/unit (30.00) = 285.00', r.ok && eq(r.value, 'CAD 285.00'), JSON.stringify(r.ok ? cents(r.value) : r));
ok('  each part is its own breakdown line, with its source', r.ok && ['duty.customs_duty.adValorem', 'duty.surtax.adValorem', 'duty.anti_dumping.specific', 'duty.countervailing.adValorem', 'duty.countervailing.specific'].every((k) => line(r, k)));
ok('a rate without a base is refused; a USD duty base is refused (the CAD customs value is an input)', err(P.duties({ ...hs, customs_duty: { rate: '0.18' } }, 1)) === 'MISSING_REQUIRED' && err(P.duties({ ...hs, dutyBase: usd('10.00'), customs_duty: { rate: '0.18' } }, 1)) === 'CURRENCY_MISMATCH');
ok('the HS code, origin and tariff treatment are required', err(P.duties({ countryOfOrigin: 'CN', tariffTreatment: 'MFN', customs_duty: { perUnit: cad('1') } }, 1)) === 'MISSING_REQUIRED');
ok('a negative duty rate is refused', err(P.duties({ ...hs, dutyBase: cad('1'), customs_duty: { rate: '-0.1' } }, 1)) === 'NEGATIVE');

// =====================================================================================================================
// Profit, margin, markup, price from target margin, commission
// =====================================================================================================================
const m = (s, c = 'CAD') => P.parseMoney({ amount: s, currency: c }, 'm');
r = P.profit(m('150.00'), m('100.00'));
ok('gross profit 150 − 100 = 50.00; margin 50/150 = 33.33%; markup 50/100 = 50%', r.ok && eq(r.value.grossProfit, 'CAD 50.00') && r.value.margin === '33.33%' && r.value.markup === '50%');
r = P.profit(m('90.00'), m('100.00'));
ok('a loss: gross profit −10.00, margin −11.11%, markup −10%', r.ok && eq(r.value.grossProfit, 'CAD -10.00') && r.value.margin === '-11.11%' && r.value.markup === '-10%');
ok('margin with a selling price of 0 is refused (division by zero)', err(P.profit(m('0.00'), m('10.00'))) === 'DIVIDE_BY_ZERO');
ok('profit of CAD and USD amounts is refused', err(P.profit(m('10.00'), m('5.00', 'USD'))) === 'CURRENCY_MISMATCH');
r = P.priceFromTargetMargin(m('100.00'), '0.35');
ok('price from target margin: 100 / (1 − 35%) = 153.846… → rounded UP to 153.85; margin 35.0016% (never below 35%)', r.ok && eq(r.value.price, 'CAD 153.85') && r.value.margin === '35.0016%');
r = P.priceFromTargetMargin(m('0.01'), '0.5');
ok('  tiny amounts: 0.01 / 0.5 = 0.02 exactly', r.ok && eq(r.value.price, 'CAD 0.02'));
let never = true;
for (const landed of ['0.01', '0.99', '1.00', '3.33', '57.17', '1234.56', '99999.99']) for (const tm of ['0.01', '0.1', '0.333', '0.35', '0.5', '0.9', '0.999']) {
  const x = P.priceFromTargetMargin(m(landed), tm); if (!x.ok) { never = false; continue; }
  const gp = x.value.price.cents - m(landed).cents;
  if (P.cmp(P.rat(gp, x.value.price.cents), P.parseNumber(tm, 't')) < 0) never = false;
}
ok('49 cases: the margin at the rounded-up price is never below the target', never);
ok('a target margin of 100% or more is refused; a negative one too', err(P.priceFromTargetMargin(m('10.00'), '1')) === 'MARGIN_TOO_HIGH' && err(P.priceFromTargetMargin(m('10.00'), '1.5')) === 'MARGIN_TOO_HIGH' && err(P.priceFromTargetMargin(m('10.00'), '-0.1')) === 'NEGATIVE');
r = P.commission(m('1000.00'), '0.075');
ok('commission: 7.5% of gross profit 1,000.00 = 75.00 (the rate is a required input)', r.ok && eq(r.value, 'CAD 75.00') && line(r, 'commission').basis === 'required');
ok('commission: zero or negative gross profit gives 0 (no clawback)', eq(P.commission(m('0.00'), '0.1').value, 'CAD 0.00') && eq(P.commission(P.money(BigInt(-5000), 'CAD'), '0.1').value, 'CAD 0.00') && /no clawback/.test(line(P.commission(P.money(BigInt(-5000), 'CAD'), '0.1'), 'commission').note));
ok('commission: no rate given is refused (no default)', err(P.commission(m('10.00'))) === 'MISSING_REQUIRED');

// =====================================================================================================================
// Worked example 1: EXW, air cargo (ILLUSTRATIVE, NOT RIVIX DATA). Worked by hand:
//   FX USD→CAD 1.3500 (2026-11-20), FX buffer 2% (default) on every converted amount.
//   Line A, gloves: 1000 × USD 2.5000 = USD 2,500.00 → CAD 3,375.00; buffer 67.50. 10 cartons 60×40×40 cm, 12.5 kg:
//     actual 125 kg, volumetric 960,000/6000 = 160 kg → weight 160. Customs duty 18% of CAD 3,375.00 = 607.50. Target margin 35%.
//   Line B, glasses: 500 × USD 1.2000 = USD 600.00 → CAD 810.00; buffer 16.20. 2 cartons 50×30×30, 20 kg: actual 40,
//     volumetric 90,000/6000 = 15 → weight 40. Customs duty 5% of 810.00 = 40.50; anti-dumping CAD 0.10 × 500 = 50.00.
//     Selling CAD 3.50.
//   Shared (EXW: all buyer lines), each by its own basis (defaults):
//     by the freight-mode basis, chargeable weight 160:40 (80% / 20%): origin transport USD 100 → 135.00 (108.00 / 27.00)
//       + buffer 2.70 (2.16 / 0.54); export handling CAD 50 (40.00 / 10.00); freight USD 900 → 1,215.00 (972.00 / 243.00)
//       + buffer 24.30 (19.44 / 4.86); domestic delivery 200 (160.00 / 40.00);
//     by line value, converted supplier cost 3,375.00 : 810.00 = 25 : 6 (25/31 and 6/31), largest remainder:
//       insurance 30.00 → 2419.35 / 580.65 cents → 24.19 / 5.81 (the leftover cent to B, remainder 20/31 > 11/31);
//       clearance 40.00 → 3225.81 / 774.19 → 32.26 / 7.74 (cent to A, 25/31 > 6/31);
//       brokerage 150.00 → 12096.77 / 2903.23 → 120.97 / 29.03 (cent to A, 24/31 > 7/31).
//     Total 1,847.00: A 1,479.02, B 367.98. The supplier-cost FX buffers (67.50, 16.20) stay on their own lines.
//   A landed = 3,375.00 + 67.50 + 607.50 + 1,479.02 = 5,529.02; unit 5.52902 / 0.65 = 8.50618 → UP 8.51; × 1000 = 8,510.00;
//     GP 2,980.98; margin 35.03%; markup 53.92% (2,980.98 / 5,529.02 = 0.539152 > 0.53915).
//   B landed = 810.00 + 16.20 + 90.50 + 367.98 = 1,284.68; 500 × 3.50 = 1,750.00; GP 465.32; margin 26.59%; markup 36.22%.
//   Order: landed 6,813.70; selling 10,260.00; GP 3,446.30; margin 33.59%; markup 50.58%.
//   Import taxes (RIVIX importer): base CAD 5,000.00 (input): GST 5% = 250.00 recoverable (default, "subject to accountant
//     confirmation"); PST 7% = 350.00 not recoverable (default). Neither is in landed cost.
//   Sales taxes on 10,260.00: GST 5% = 513.00, PST 7% = 718.20; total incl. tax 11,491.20. Commission 10% of 3,446.30 = 344.63.
//   Shipment: actual 165 kg, volumetric 175 kg → chargeable 175.0 kg.
// =====================================================================================================================
const exw = {
  incoterm: 'EXW', importerOfRecord: 'rivix', freightMode: 'air_cargo', commissionRate: '0.10', fx: FX,
  lines: [
    { id: 'A', description: 'Nitrile-coated gloves (illustrative)', quantity: 1000, supplierUnitCost: usd('2.5000'), packages: [box(10, 60, 40, 40, '12.5')],
      duties: { ...hs, dutyBase: cad('3375.00'), customs_duty: { rate: '0.18' } }, targetMargin: '0.35' },
    { id: 'B', description: 'Safety glasses (illustrative)', quantity: 500, supplierUnitCost: usd('1.2000'), packages: [box(2, 50, 30, 30, '20')],
      duties: { hsCode: '9004.90', countryOfOrigin: 'CN', tariffTreatment: 'MFN', dutyBase: cad('810.00'), customs_duty: { rate: '0.05' }, anti_dumping: { perUnit: cad('0.10') } }, sellingUnitPrice: cad('3.50') },
  ],
  costs: { originTransport: usd('100.00'), exportHandling: cad('50.00'), freight: usd('900.00'), insurance: cad('30.00'), clearance: cad('40.00'), brokerage: cad('150.00'), domesticDelivery: cad('200.00') },
  importTaxes: { base: cad('5000.00'), lines: [{ kind: 'GST', rate: '0.05' }, { kind: 'PST', rate: '0.07' }] },
  salesTaxes: [{ kind: 'GST', rate: '0.05' }, { kind: 'PST', rate: '0.07' }],
};
r = P.quote(exw);
const A = r.ok && r.value.lines[0], B = r.ok && r.value.lines[1];
ok('EXAMPLE 1 (EXW air, illustrative): the quote is calculated', r.ok, r.ok ? '' : JSON.stringify(r.error));
ok('  line A: supplier CAD 3,375.00, FX buffer 67.50, duties 607.50, shared 1,479.02, landed 5,529.02', A && eq(A.supplierCost, 'CAD 3375.00') && eq(A.fxBuffer, 'CAD 67.50') && eq(A.duties, 'CAD 607.50') && eq(A.sharedCosts, 'CAD 1479.02') && eq(A.landedCost, 'CAD 5529.02'), A && [A.supplierCost, A.fxBuffer, A.duties, A.sharedCosts, A.landedCost].map(cents).join(' | '));
ok('  line A: unit landed 5.5290, unit price 8.51 (rounded up from 8.50618), extended 8,510.00, GP 2,980.98, margin 35.03%, markup 53.92%', A && A.unitLandedCost === '5.5290' && eq(A.unitPrice, 'CAD 8.51') && eq(A.extendedPrice, 'CAD 8510.00') && eq(A.grossProfit, 'CAD 2980.98') && A.margin === '35.03%' && A.markup === '53.92%', A && `${A.unitLandedCost} ${cents(A.unitPrice)} ${A.margin} ${A.markup}`);
ok('  line B: supplier 810.00, buffer 16.20, duties 90.50, shared 367.98, landed 1,284.68; 1,750.00; GP 465.32; 26.59% / 36.22%', B && eq(B.supplierCost, 'CAD 810.00') && eq(B.fxBuffer, 'CAD 16.20') && eq(B.duties, 'CAD 90.50') && eq(B.sharedCosts, 'CAD 367.98') && eq(B.landedCost, 'CAD 1284.68') && eq(B.extendedPrice, 'CAD 1750.00') && eq(B.grossProfit, 'CAD 465.32') && B.margin === '26.59%' && B.markup === '36.22%', B && [B.duties, B.sharedCosts, B.landedCost, B.margin, B.markup].map(String).join(' | '));
ok('  order: landed 6,813.70, selling 10,260.00, GP 3,446.30, margin 33.59%, markup 50.58%', r.ok && eq(r.value.landedCost, 'CAD 6813.70') && eq(r.value.sellingTotal, 'CAD 10260.00') && eq(r.value.grossProfit, 'CAD 3446.30') && r.value.margin === '33.59%' && r.value.markup === '50.58%');
ok('  taxes kept apart: import GST 250.00 recoverable, PST 350.00 not recoverable; sales taxes 1,231.20; total incl. tax 11,491.20', r.ok && eq(r.value.importTaxes.recoverable, 'CAD 250.00') && eq(r.value.importTaxes.notRecoverable, 'CAD 350.00') && eq(r.value.salesTaxes, 'CAD 1231.20') && eq(r.value.totalInclTax, 'CAD 11491.20'));
ok('  commission 10% of 3,446.30 = 344.63', r.ok && eq(r.value.commission, 'CAD 344.63'));
ok('  shipment: actual 165 kg, volumetric 175 kg, chargeable 175.0 kg', r.ok && r.value.shipment.actualKg === '165.000' && r.value.shipment.volumetricKg === '175.000' && r.value.shipment.chargeable === '175.000');
const share = (rr, id, k) => cents(line(rr, `line.${id}.allocated.costs.${k}`)?.money);
ok('  freight, its FX buffer, origin transport, export handling and delivery split by chargeable weight 160:40', r.ok && share(r, 'A', 'freight') === 'CAD 972.00' && share(r, 'B', 'freight') === 'CAD 243.00' && share(r, 'A', 'freight.fxBuffer') === 'CAD 19.44' && share(r, 'B', 'freight.fxBuffer') === 'CAD 4.86'
  && share(r, 'A', 'originTransport') === 'CAD 108.00' && share(r, 'A', 'originTransport.fxBuffer') === 'CAD 2.16' && share(r, 'B', 'exportHandling') === 'CAD 10.00' && share(r, 'A', 'domesticDelivery') === 'CAD 160.00');
ok('  insurance, clearance and brokerage split by line value 25:6, leftover cents by largest remainder: 24.19/5.81, 32.26/7.74, 120.97/29.03', r.ok && share(r, 'A', 'insurance') === 'CAD 24.19' && share(r, 'B', 'insurance') === 'CAD 5.81' && share(r, 'A', 'clearance') === 'CAD 32.26' && share(r, 'B', 'clearance') === 'CAD 7.74' && share(r, 'A', 'brokerage') === 'CAD 120.97' && share(r, 'B', 'brokerage') === 'CAD 29.03',
  ['insurance', 'clearance', 'brokerage'].map((k) => `${share(r, 'A', k)}/${share(r, 'B', k)}`).join(' '));
ok('  the basis of each cost type is in the breakdown, marked "default"', r.ok && /line value/.test(line(r, 'allocation.insurance').label) && /freight mode/.test(line(r, 'allocation.freight').label) && ['freight', 'insurance', 'brokerage', 'clearance'].every((k) => line(r, `allocation.${k}`).basis === 'default'));
ok("  each line's own supplier-cost FX buffer stays on that line (never shared)", r.ok && !r.breakdown.some((l) => /allocated\..*supplierCost/.test(l.key)) && A.fxBuffer.cents === BigInt(6750) && B.fxBuffer.cents === BigInt(1620));
const byValue = P.quote({ ...exw, allocation: { freight: 'line_value' } });
ok('  a shared FX buffer follows its cost: freight by line value → 979.84/235.16 and its buffer 19.60/4.70, marked "override"', byValue.ok && share(byValue, 'A', 'freight') === 'CAD 979.84' && share(byValue, 'B', 'freight') === 'CAD 235.16' && share(byValue, 'A', 'freight.fxBuffer') === 'CAD 19.60' && share(byValue, 'B', 'freight.fxBuffer') === 'CAD 4.70' && line(byValue, 'allocation.freight').basis === 'override'
  && byValue.value.landedCost.cents === r.value.landedCost.cents, byValue.ok ? `${share(byValue, 'A', 'freight')} ${share(byValue, 'A', 'freight.fxBuffer')}` : JSON.stringify(byValue.error));
ok('  every converted amount has its own FX buffer line (supplier A, supplier B, origin transport, freight), marked "default"', r.ok && ['line.A.supplierCost.fxBuffer', 'line.B.supplierCost.fxBuffer', 'costs.originTransport.fxBuffer', 'costs.freight.fxBuffer'].every((k) => line(r, k)?.basis === 'default') && !line(r, 'costs.exportHandling.fxBuffer'));
ok('  the conversion lines name the rate, its date and its source', r.ok && /1\.3500 \(illustrative rate, not RIVIX data, 2026-11-20\)/.test(line(r, 'line.A.supplierCost.converted').label));
ok('  the import GST line says "subject to accountant confirmation"', r.ok && line(r, 'importTaxes.GST').note === 'subject to accountant confirmation' && line(r, 'importTaxes.GST').basis === 'default');
ok('  the required inputs are marked "required" (Incoterm, importer, freight mode, commission rate)', r.ok && ['incoterm', 'importerOfRecord', 'freightMode', 'commission'].every((k) => line(r, k)?.basis === 'required'));
ok('  no warnings (EXW with air)', r.ok && r.warnings.length === 0);
const noTaxes = P.quote({ ...exw, importTaxes: undefined, salesTaxes: undefined });
ok('  taxes never change landed cost, gross profit or margin', noTaxes.ok && noTaxes.value.landedCost.cents === r.value.landedCost.cents && noTaxes.value.grossProfit.cents === r.value.grossProfit.cents && noTaxes.value.margin === r.value.margin);

// =====================================================================================================================
// Worked example 2: DDP, express courier (ILLUSTRATIVE, NOT RIVIX DATA). Worked by hand:
//   Supplier is importer of record (DDP). Line C, hard hats: 200 × USD 14.9900 = USD 2,998.00 → CAD 4,047.30; buffer 2% =
//   80.946 → 80.95. No freight, clearance, duties or taxes (inside the DDP price). Other direct cost: pre-shipment
//   inspection CAD 120.00 (a buyer line under every term), all on line C. Landed = 4,047.30 + 80.95 + 120.00 = 4,248.25.
//   Selling 200 × CAD 29.00 = 5,800.00; GP 1,551.75; margin 26.75%; markup 36.53%. HST 13% = 754.00; total 6,554.00.
//   Commission 5% of 1,551.75 = 77.5875 → 77.59. 4 cartons 50×50×40 cm, 18 kg: volumetric 400,000/5000 = 80 kg > 72 kg.
// =====================================================================================================================
const ddp = {
  incoterm: 'DDP', importerOfRecord: 'supplier', freightMode: 'express_courier', commissionRate: '0.05', fx: FX,
  lines: [{ id: 'C', description: 'Hard hats (illustrative)', quantity: 200, supplierUnitCost: usd('14.9900'), packages: [box(4, 50, 50, 40, '18')], sellingUnitPrice: cad('29.00') }],
  costs: { otherDirect: [{ label: 'Pre-shipment inspection', amount: cad('120.00') }] },
  salesTaxes: [{ kind: 'HST', rate: '0.13' }],
};
r = P.quote(ddp);
const Cl = r.ok && r.value.lines[0];
ok('EXAMPLE 2 (DDP courier, illustrative): the quote is calculated', r.ok, r.ok ? '' : JSON.stringify(r.error));
ok('  line C: supplier CAD 4,047.30, FX buffer 80.95 (80.946 half up), duties 0, shared 120.00, landed 4,248.25', Cl && eq(Cl.supplierCost, 'CAD 4047.30') && eq(Cl.fxBuffer, 'CAD 80.95') && eq(Cl.duties, 'CAD 0.00') && eq(Cl.sharedCosts, 'CAD 120.00') && eq(Cl.landedCost, 'CAD 4248.25'));
ok('  selling 5,800.00, GP 1,551.75, margin 26.75%, markup 36.53%', Cl && eq(Cl.extendedPrice, 'CAD 5800.00') && eq(Cl.grossProfit, 'CAD 1551.75') && Cl.margin === '26.75%' && Cl.markup === '36.53%' && r.value.margin === '26.75%');
ok('  HST 754.00, total incl. tax 6,554.00, commission 77.59', r.ok && eq(r.value.salesTaxes, 'CAD 754.00') && eq(r.value.totalInclTax, 'CAD 6554.00') && eq(r.value.commission, 'CAD 77.59'));
ok('  the breakdown says the import taxes are inside the supplier price and not recoverable by RIVIX', r.ok && r.value.importTaxes.insideSupplierPrice === true && /inside the supplier price .* not recoverable by RIVIX/.test(line(r, 'importTaxes.insideSupplierPrice').label));
ok('  courier chargeable weight 80.0 kg (volumetric 80 > actual 72)', r.ok && r.value.shipment.chargeable === '80.000' && r.value.shipment.actualKg === '72.000');
for (const [what, extra] of [['freight', { costs: { ...ddp.costs, freight: cad('100.00') } }], ['brokerage', { costs: { brokerage: cad('10.00') } }], ['clearance', { costs: { clearance: cad('10.00') } }], ['domestic delivery', { costs: { domesticDelivery: cad('10.00') } }],
  ['duties', { lines: [{ ...ddp.lines[0], duties: { ...hs, dutyBase: cad('100.00'), customs_duty: { rate: '0.1' } } }] }], ['import taxes', { importTaxes: { base: cad('100.00'), lines: [{ kind: 'GST', rate: '0.05' }] } }]]) {
  ok(`DDP: a ${what} line given a value is refused as double counting`, err(P.quote({ ...ddp, ...extra })) === 'DOUBLE_COUNTED');
}
ok('DDP with RIVIX as importer of record is refused (DDP means the supplier clears the import)', err(P.quote({ ...ddp, importerOfRecord: 'rivix' })) === 'INCONSISTENT');
ok('DDP: a supplier-paid line given as 0 is not double counting', P.quote({ ...ddp, costs: { ...ddp.costs, freight: cad('0') } }).ok);

// =====================================================================================================================
// FOB, CIF, required inputs and the other edge cases
// =====================================================================================================================
const one = (o = {}) => ({ incoterm: 'EXW', importerOfRecord: 'rivix', freightMode: 'ocean', commissionRate: '0.1', lines: [{ id: 'X', quantity: 10, supplierUnitCost: cad('5.00'), packages: [box(1, 100, 100, 100, '100')], sellingUnitPrice: cad('8.00') }], ...o });
ok('FOB: origin transport and export handling are inside the supplier price (refused); freight and insurance are buyer lines', err(P.quote(one({ incoterm: 'FOB', costs: { originTransport: cad('5') } }))) === 'DOUBLE_COUNTED' && err(P.quote(one({ incoterm: 'FOB', costs: { exportHandling: cad('5') } }))) === 'DOUBLE_COUNTED' && P.quote(one({ incoterm: 'FOB', costs: { freight: cad('20'), insurance: cad('2') } })).ok);
ok('CIF: freight and insurance are inside the supplier price (refused)', err(P.quote(one({ incoterm: 'CIF', costs: { freight: cad('20') } }))) === 'DOUBLE_COUNTED' && err(P.quote(one({ incoterm: 'CIF', costs: { insurance: cad('2') } }))) === 'DOUBLE_COUNTED');
r = P.quote(one({ incoterm: 'CIF', costs: { extraBuyerInsurance: cad('3.00'), destinationHandling: cad('7.00') } }));
ok('CIF: an extra buyer insurance line is allowed; destination terminal handling is a buyer line by default', r.ok && eq(r.value.landedCost, 'CAD 60.00') && line(r, 'cifDestinationHandlingPaidBy').basis === 'default', r.ok ? cents(r.value.landedCost) : JSON.stringify(r.error));
ok('CIF: with destination handling overridden to the supplier, a value for it is refused', err(P.quote(one({ incoterm: 'CIF', cifDestinationHandlingPaidBy: 'supplier', costs: { destinationHandling: cad('7.00') } }))) === 'DOUBLE_COUNTED');
ok('extra buyer insurance under EXW is refused (use insurance)', err(P.quote(one({ costs: { extraBuyerInsurance: cad('3.00') } }))) === 'BAD_INPUT');
r = P.quote(one({ incoterm: 'FOB', freightMode: 'air_cargo' }));
ok('FOB with air cargo is not refused, but warns "FOB/CIF are sea terms; consider FCA/CPT/CIP"', r.ok && r.warnings.includes('FOB/CIF are sea terms; consider FCA/CPT/CIP') && line(r, 'warning.seaTerms'));
ok('CIF with express courier warns too; FOB with ocean does not', P.quote(one({ incoterm: 'CIF', freightMode: 'express_courier' })).warnings.length === 1 && P.quote(one({ incoterm: 'FOB' })).warnings.length === 0);
r = P.quote(one());
ok('missing freight under EXW is counted as 0, and the breakdown says "not given"', r.ok && /not given/.test(line(r, 'costs.freight').label) && eq(r.value.landedCost, 'CAD 50.00'));
for (const k of ['incoterm', 'importerOfRecord', 'freightMode', 'commissionRate']) ok(`${k} is required (no silent default)`, err(P.quote(one({ [k]: undefined }))) === 'MISSING_REQUIRED');
ok('zero quantity is refused', err(P.quote(one({ lines: [{ ...one().lines[0], quantity: 0 }] }))) === 'ZERO_QUANTITY');
ok('a negative supplier cost, selling price or freight is refused', ['supplierUnitCost', 'sellingUnitPrice'].every((k) => err(P.quote(one({ lines: [{ ...one().lines[0], [k]: cad('-1.00') }] }))) === 'NEGATIVE') && err(P.quote(one({ costs: { freight: cad('-1') } }))) === 'NEGATIVE');
ok('a selling price in USD is refused (landed cost is in CAD)', err(P.quote(one({ lines: [{ ...one().lines[0], sellingUnitPrice: usd('8.00') }] }))) === 'CURRENCY_MISMATCH');
ok('a USD amount with no USD rate is refused; a rate without a date or a source is refused', err(P.quote(one({ costs: { freight: usd('10') } }))) === 'BAD_FX' && err(P.quote(one({ fx: [{ ...FX[0], date: '' }] }))) === 'BAD_FX' && err(P.quote(one({ fx: [{ ...FX[0], source: ' ' }] }))) === 'BAD_FX');
ok('both a selling price and a target margin (or neither) is refused', err(P.quote(one({ lines: [{ ...one().lines[0], targetMargin: '0.3' }] }))) === 'BAD_INPUT' && err(P.quote(one({ lines: [{ ...one().lines[0], sellingUnitPrice: undefined }] }))) === 'BAD_INPUT');
ok('a target margin of 100% on a line is refused', err(P.quote(one({ lines: [{ ...one().lines[0], sellingUnitPrice: undefined, targetMargin: '1' }] }))) === 'MARGIN_TOO_HIGH');
ok('supplier as importer of record (EXW) with import taxes given is refused as double counting', err(P.quote(one({ importerOfRecord: 'supplier', importTaxes: { base: cad('10'), lines: [{ kind: 'GST', rate: '0.05' }] } }))) === 'DOUBLE_COUNTED');
r = P.quote(one({ fxBuffer: '0.03', fx: FX, costs: { freight: usd('10.00') }, importTaxes: { base: cad('50.00'), lines: [{ kind: 'GST', rate: '0.05', recoverable: false }, { kind: 'PST', rate: '0.07', recoverable: true }] } }));
ok('overrides are marked "override": FX buffer 3% (USD 10 → 13.50 + 0.41), recoverable flags', r.ok && line(r, 'costs.freight.fxBuffer').basis === 'override' && eq(line(r, 'costs.freight.fxBuffer').money, 'CAD 0.41') && line(r, 'importTaxes.GST').basis === 'override' && eq(r.value.importTaxes.notRecoverable, 'CAD 2.50') && eq(r.value.importTaxes.recoverable, 'CAD 3.50'));
r = P.quote(one({ lines: [one().lines[0], { ...one().lines[0], id: 'Y', packages: [box(1, 100, 100, 100, '300')] }], costs: { freight: cad('100.00') } }));
ok('ocean allocation by W/M: lines of 1 CBM/100 kg and 1 CBM/300 kg share freight 1:1 (CBM is greater for both): 50.00 each', r.ok && eq(line(r, 'line.X.allocated.costs.freight').money, 'CAD 50.00') && eq(line(r, 'line.Y.allocated.costs.freight').money, 'CAD 50.00'));
r = P.quote(one({ lines: [one().lines[0], { ...one().lines[0], id: 'Y' }, { ...one().lines[0], id: 'Z' }], costs: { freight: cad('100.00') }, allocation: { freight: { manual: ['1', '1', '1'] } } }));
ok('manual allocation: 100.00 over 3 → 33.34 + 33.33 + 33.33, marked "override"', r.ok && ['X', 'Y', 'Z'].map((id) => cents(line(r, `line.${id}.allocated.costs.freight`).money)).join(',') === 'CAD 33.34,CAD 33.33,CAD 33.33' && line(r, 'allocation.freight').basis === 'override');
ok('freight by freight mode without packages is refused; insurance (by line value) needs no packages', err(P.quote(one({ lines: [{ ...one().lines[0], packages: undefined }], costs: { freight: cad('10') } }))) === 'MISSING_REQUIRED' && P.quote(one({ lines: [{ ...one().lines[0], packages: undefined }], costs: { insurance: cad('10') } })).ok);
ok('an unknown allocation key is refused; line value with every supplier cost at 0 is refused (nothing to split by)', err(P.quote(one({ allocation: { method: 'manual' } }))) === 'BAD_INPUT' && err(P.quote(one({ lines: [{ ...one().lines[0], supplierUnitCost: cad('0') }], costs: { insurance: cad('1') } }))) === 'DIVIDE_BY_ZERO');
r = P.quote(one({ importerOfRecord: 'supplier' }));
ok('EXW with the supplier as importer of record: calculated, with the warning "EXW normally means RIVIX imports; check the importer of record"', r.ok && r.warnings.includes('EXW normally means RIVIX imports; check the importer of record') && line(r, 'warning.exwImporter'));
ok('  FOB with the supplier as importer of record does not get that warning', P.quote(one({ incoterm: 'FOB', importerOfRecord: 'supplier' })).warnings.length === 0);

// Every breakdown line has a label, a source and a basis; every money value is bigint cents.
const all = [P.quote(exw), P.quote(ddp)];
const badLines = all.flatMap((x) => x.breakdown).filter((l) => !l.label || !l.source || !['input', 'required', 'default', 'override', 'computed'].includes(l.basis) || (l.money && typeof l.money.cents !== 'bigint'));
ok('every breakdown line has a label, a source and a basis; every amount is bigint cents', badLines.length === 0 && all.every((x) => x.ok && x.breakdown.length >= 15), JSON.stringify(badLines.slice(0, 2), (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
const floats = [];
const walk = (v, at) => { if (typeof v === 'number') floats.push(at); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`); };
all.forEach((x, i) => walk(x.value, `quote${i}`));
ok('no JS number anywhere in a quote result (money is bigint cents; ratios and weights are exact text)', floats.length === 0, floats.slice(0, 5).join(', '));

// =====================================================================================================================
// The rule: no network, database, clock, randomness or environment; no floating-point money helpers
// =====================================================================================================================
const dir = 'src/lib/pricing';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
const bad = [];
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
  for (const m2 of s.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/gm)) { const spec = m2[1] ?? m2[2]; if (!spec.startsWith('./')) bad.push(`${f}: imports ${spec}`); }
  for (const [re, what] of [[/\bfetch\s*\(/, 'fetch('], [/\bprocess\./, 'process.'], [/Date\.now|new Date\s*\(/, 'the clock'], [/Math\.random|crypto/, 'randomness'], [/supabase|createClient|\.from\(\s*['"]/, 'database'],
    [/XMLHttpRequest|WebSocket|require\s*\(/, 'network/require'], [/parseFloat|Math\.round|toFixed\s*\(/, 'floating-point money helpers']]) if (re.test(s)) bad.push(`${f}: ${what}`);
}
ok(`the ${files.length} pricing files import only each other, and use no network, database, clock, randomness, environment or floating-point money`, files.length >= 12 && bad.length === 0, bad.join('; '));
ok('the whole run made no network attempt (fetch, http, https and net were blocked)', attempts.length === 0, attempts.join(', '));
restore.forEach((fn) => fn()); globalThis.fetch = realFetch;
