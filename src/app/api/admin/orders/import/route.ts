import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { invalidateDashboard } from '@/lib/dashboard-data';
import { MAX_IMPORT_ROWS, batchMatchGroups, batchMatchList, checkHeaders, checkRows, codeKey, normalizeHeader, type ImportValues } from '@/lib/order-import';

type Result = { line: number; ok: boolean; batch_number: string; customer?: string; reason?: string };

// Admin CSV order import. The browser sends the parsed rows; the server checks every one itself (rules in
// src/lib/order-import.ts, plus unknown customer codes and batch numbers that already exist).
//   dryRun: true  -> the preview: each line OK or the reason it would be skipped. Nothing is saved.
//   dryRun: false -> the same checks again, then only the OK rows are saved.
// Saved orders get the customer's rep (one rep per customer), one product line, and a hidden timeline note.
// No alerts or emails are sent: an import is usually past orders.
export async function POST(req: NextRequest) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.rows)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const dryRun = body.dryRun !== false;
  if (body.rows.length === 0) return NextResponse.json({ error: 'The file has no rows.' }, { status: 400 });
  if (body.rows.length > MAX_IMPORT_ROWS) return NextResponse.json({ error: `A file can have at most ${MAX_IMPORT_ROWS} rows. Split it into smaller files.` }, { status: 400 });

  // Header names are normalized here too: the browser is not trusted to have done it.
  const rawHeaders: string[] = Array.isArray(body.headers) ? body.headers.map(String) : Object.keys(body.rows[0] ?? {});
  const { missing, ignored } = checkHeaders(rawHeaders);
  if (missing.length) return NextResponse.json({ error: `The file is missing these columns: ${missing.join(', ')}. Use the template.` }, { status: 400 });
  const rows = (body.rows as unknown[]).map((r) =>
    Object.fromEntries(Object.entries(r && typeof r === 'object' ? (r as Record<string, unknown>) : {}).map(([k, v]) => [normalizeHeader(k), v]))
  );

  const checks = checkRows(rows);
  const admin = createAdminClient();

  // Customers by code (trimmed, any capitals).
  const { data: customers, error: custErr } = await admin.from('customers').select('id, customer_code, company_name, rep_id');
  if (custErr) return NextResponse.json({ error: custErr.message }, { status: 500 });
  const byCode = new Map((customers || []).filter((c) => c.customer_code).map((c) => [codeKey(c.customer_code), c]));

  // Batch numbers already in the portal, ignoring capitals (the same rule as inside the file). One query for a normal
  // file; a very large one is split only to keep the request address short enough.
  const wanted = Array.from(new Set(checks.flatMap((c) => (c.ok && c.values.batch_number ? [c.values.batch_number] : []))));
  const taken = new Set<string>();
  for (const group of batchMatchGroups(wanted)) {
    const { data, error } = await admin.from('orders').select('batch_number').filter('batch_number', 'ilike(any)', batchMatchList(group));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // The match is exact apart from capitals; PostgREST also reads '*' as a wildcard, which can only find extra
    // numbers, never miss one, and the exact comparison below ignores any extras.
    (data || []).forEach((o) => taken.add(String(o.batch_number).toLowerCase()));
  }

  const results: Result[] = [];
  const toSave: { values: ImportValues; customer: { id: string; rep_id: string | null; company_name: string } }[] = [];
  for (const c of checks) {
    if (!c.ok) { results.push({ line: c.line, ok: false, batch_number: c.batch_number, reason: c.reason }); continue; }
    const customer = byCode.get(codeKey(c.values.customer_code));
    const batch = c.values.batch_number;
    if (!customer) { results.push({ line: c.line, ok: false, batch_number: batch, reason: `no customer with code "${c.values.customer_code}"` }); continue; }
    if (batch && taken.has(batch.toLowerCase())) { results.push({ line: c.line, ok: false, batch_number: batch, reason: 'an order with this batch number already exists' }); continue; }
    results.push({ line: c.line, ok: true, batch_number: batch, customer: customer.company_name });
    toSave.push({ values: c.values, customer });
  }

  const skipped = results.filter((r) => !r.ok).length;
  if (dryRun || toSave.length === 0) {
    return NextResponse.json({ dryRun, results, ok: toSave.length, imported: 0, skipped, ignored });
  }

  // Save. The database creates the ids, and numbers blank batch numbers (ORD-0001, ...).
  const { data: saved, error: insErr } = await admin
    .from('orders')
    .insert(toSave.map(({ values: v, customer }) => ({
      customer_id: customer.id,
      rep_id: customer.rep_id ?? null,
      batch_number: v.batch_number, // '' = numbered by the database
      product_name: v.product_name,
      quantity: v.quantity,
      material: v.material,
      safety_standard: v.safety_standard,
      origin: v.origin,
      order_date: v.order_date,
      ship_date: v.ship_date,
      status: v.status,
    })))
    .select('id, batch_number, product_name, quantity');
  if (insErr || !saved) return NextResponse.json({ error: insErr?.message || 'Could not save the orders.' }, { status: 500 });

  const ids = saved.map((o) => o.id);
  const undo = async (message: string) => {
    await admin.from('orders').delete().in('id', ids); // never leave half an import behind
    return NextResponse.json({ error: `Nothing was imported: ${message}` }, { status: 500 });
  };
  // The saved rows come back in the order they were sent; check before linking product lines to them.
  const sameOrder = saved.length === toSave.length && saved.every((o, i) => o.product_name === toSave[i].values.product_name && o.quantity === toSave[i].values.quantity);
  if (!sameOrder) return undo('the saved orders could not be matched to the file rows.');

  const { error: itemsErr } = await admin.from('order_items').insert(
    saved.map((o) => ({ order_id: o.id, product_name: o.product_name, quantity: o.quantity, sizing: null, size_breakdown: null, branding: null, position: 0 }))
  );
  if (itemsErr) return undo(itemsErr.message);

  const { error: noteErr } = await admin.from('order_events').insert(
    saved.map((o) => ({ order_id: o.id, note: `Imported from CSV by ${who.email}`, customer_visible: false, created_by: who.email }))
  );
  if (noteErr) return undo(noteErr.message);

  invalidateDashboard(); // new orders change the stage counts and the chart

  // Report the batch numbers the database gave blank rows.
  let i = 0;
  for (const r of results) if (r.ok) r.batch_number = saved[i++].batch_number;
  return NextResponse.json({ dryRun: false, results, ok: saved.length, imported: saved.length, skipped, ignored });
}
