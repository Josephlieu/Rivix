// The rules for the admin CSV order import. Pure (no database), so the server route and the e2e test use exactly
// the same checks. A blank cell is saved as null, never as a made-up value.
// Relative imports on purpose: the e2e test loads this file directly.
import { ORDER_STAGES, type OrderStage } from './order-stages';
import { plainDateDay } from './format';
import { normalizeStandard } from './safety-standards';

// The columns the importer accepts, in template order. Keep public/rivix_import_template.csv in step with this list.
export const IMPORT_COLUMNS = [
  'batch_number',
  'customer_code',
  'product_name',
  'quantity',
  'material',
  'safety_standard',
  'origin',
  'order_date',
  'ship_date',
  'status',
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export const REQUIRED_COLUMNS: readonly ImportColumn[] = ['customer_code', 'product_name', 'quantity'];
export const MAX_IMPORT_ROWS = 1000;
export const DEFAULT_IMPORT_STAGE: OrderStage = 'Order Received';

// "Order Date" or " ORDER_DATE " in a file header both mean order_date.
export const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, '_');

// A customer code compared the same way everywhere: trimmed, any capitals.
export const codeKey = (v: string) => v.trim().toLowerCase();

// The values one OK row saves (customer_code is turned into the customer by the server).
export type ImportValues = {
  batch_number: string; // '' = the database numbers it (ORD-0001, ...)
  customer_code: string;
  product_name: string;
  quantity: number;
  material: string | null;
  safety_standard: string | null;
  origin: string | null;
  order_date: string | null;
  ship_date: string | null;
  status: OrderStage;
};

export type RowCheck = { line: number; ok: true; values: ImportValues } | { line: number; ok: false; reason: string; batch_number: string };

const MAX_LEN: Record<string, number> = { batch_number: 100, customer_code: 50, product_name: 200, material: 500, safety_standard: 200, origin: 200 };
const cell = (row: Record<string, unknown>, k: string) => String(row[k] ?? '').trim();
const optional = (row: Record<string, unknown>, k: string) => cell(row, k).slice(0, MAX_LEN[k] ?? 500) || null;

// Checks one row on its own (not duplicates or the database). `line` is the line number in the file (header = line 1).
export function checkRow(row: Record<string, unknown>, line: number): RowCheck {
  const batch = cell(row, 'batch_number').slice(0, MAX_LEN.batch_number);
  const fail = (reason: string): RowCheck => ({ line, ok: false, reason, batch_number: batch });

  const code = cell(row, 'customer_code').slice(0, MAX_LEN.customer_code);
  if (!code) return fail('customer_code is empty');
  const product = cell(row, 'product_name').slice(0, MAX_LEN.product_name);
  if (!product) return fail('product_name is empty');

  const qtyText = cell(row, 'quantity');
  if (!qtyText) return fail('quantity is empty');
  if (!/^\d+$/.test(qtyText) || Number(qtyText) < 1 || Number(qtyText) > 1_000_000) return fail(`quantity "${qtyText}" is not a whole number above 0`);

  const dates: Record<'order_date' | 'ship_date', string | null> = { order_date: null, ship_date: null };
  for (const k of ['order_date', 'ship_date'] as const) {
    const v = cell(row, k);
    if (!v) continue;
    if (plainDateDay(v) === null) return fail(`${k} "${v}" is not a real date in YYYY-MM-DD form`);
    dates[k] = v;
  }

  const stageText = cell(row, 'status').toLowerCase();
  const status = ORDER_STAGES.find((s) => s.toLowerCase() === stageText) ?? DEFAULT_IMPORT_STAGE;

  return {
    line,
    ok: true,
    values: {
      batch_number: batch,
      customer_code: code,
      product_name: product,
      quantity: Number(qtyText),
      material: optional(row, 'material'),
      safety_standard: normalizeStandard(optional(row, 'safety_standard')), // a list value gets the list's exact spelling
      origin: optional(row, 'origin'),
      order_date: dates.order_date,
      ship_date: dates.ship_date,
      status,
    },
  };
}

// Checks every row, then marks repeated batch numbers inside the file (blank ones are numbered by the database, so they
// never clash). Rows must already have normalized header names.
export function checkRows(rows: Record<string, unknown>[]): RowCheck[] {
  const seen = new Map<string, number>();
  return rows.map((row, i) => {
    const r = checkRow(row, i + 2);
    if (!r.ok || !r.values.batch_number) return r;
    const key = r.values.batch_number.toLowerCase();
    const first = seen.get(key);
    if (first) return { line: r.line, ok: false, reason: `same batch number as line ${first}`, batch_number: r.values.batch_number };
    seen.set(key, r.line);
    return r;
  });
}

// Batch numbers as one case-insensitive database filter value: `.filter('batch_number', 'ilike(any)', value)`.
// Each number is an exact match: LIKE wildcards (% and _) and backslashes are escaped, and every item is double-quoted
// so commas, braces and quotes in a batch number cannot break the list.
export const batchMatchList = (batches: string[]) =>
  `{${batches.map((b) => `"${b.replace(/[\\%_]/g, (ch) => `\\${ch}`).replace(/[\\"]/g, (ch) => `\\${ch}`)}"`).join(',')}}`;

// Splits batch numbers into as few lists as possible, each under `maxChars` once written as a filter, so a request
// address never gets too long. A normal file is one list (one query); only a very large file needs more.
export function batchMatchGroups(batches: string[], maxChars = 6000): string[][] {
  const groups: string[][] = [];
  let cur: string[] = [];
  let len = 2;
  for (const b of batches) {
    const add = batchMatchList([b]).length - 1; // the item plus its comma
    if (cur.length && len + add > maxChars) { groups.push(cur); cur = []; len = 2; }
    cur.push(b); len += add;
  }
  if (cur.length) groups.push(cur);
  return groups;
}

// Header problems that stop the whole file: a required column missing. Unknown columns are only reported.
export function checkHeaders(headers: string[]): { missing: string[]; ignored: string[] } {
  const norm = headers.map(normalizeHeader).filter(Boolean);
  return {
    missing: REQUIRED_COLUMNS.filter((c) => !norm.includes(c)),
    ignored: norm.filter((h) => !(IMPORT_COLUMNS as readonly string[]).includes(h)),
  };
}
