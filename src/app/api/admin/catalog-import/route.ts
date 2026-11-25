import { NextResponse } from 'next/server';
import { adminCtx, bad, readJson } from '@/lib/catalog-route';
import { applyPlan, preview } from '@/lib/catalog-server';
import { STANDARD_SPEC, checkFields, designationKey } from '@/lib/catalog-fields';
import { stagingPrefix } from '@/lib/certificate-files';
import { audit } from '@/lib/audit';

// The supplier and product import (2026-11-21, admin only). Body: { action, suppliersCsv?, productsCsv?, batch?, fingerprint?, designations? }
//   preview:       the dry run; writes nothing. Per row: create / update / unchanged / error, and every unknown standard.
//   add_standards: adds the listed unknown standards to the reference, UNCHECKED (each one audit-logged); then preview again.
//   confirm:       re-runs the preview on fresh data; refused if anything is in error or if it differs from the preview the
//                  admin saw (fingerprint); then writes it, one audit row per record created or changed, plus a summary row.
const MAX_CSV = 2 * 1024 * 1024;
export async function POST(req: Request) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const body = await readJson(req); if (!body) return bad('Bad request');
  const csv = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : undefined);
  const input = { suppliersCsv: csv('suppliersCsv'), productsCsv: csv('productsCsv') };
  if ((input.suppliersCsv?.length ?? 0) > MAX_CSV || (input.productsCsv?.length ?? 0) > MAX_CSV) return bad('Each CSV file must be 2 MB or smaller.');
  // The staged files: only this admin's own folder for this batch (import/<user id>/<batch>); a bad batch id is refused here,
  // before any file is listed, read, copied or deleted.
  const batch = body.batch === undefined || body.batch === null ? null : stagingPrefix(c.who.userId, body.batch) ?? undefined;
  if (batch === undefined) return bad('Bad import batch.');

  if (body.action === 'preview') return NextResponse.json({ plan: await preview(c.admin, input, batch) });

  if (body.action === 'add_standards') {
    const list = Array.isArray(body.designations) ? (body.designations as unknown[]).map((d) => String(d ?? '').trim()).filter(Boolean) : [];
    if (!list.length || list.length > 200) return bad('List the standards to add (at most 200).');
    const { data: have } = await c.admin.from('standards').select('designation');
    const known = new Set((have ?? []).map((s) => designationKey(s.designation)));
    const added: string[] = [];
    let audited: { auditWarning?: string } = {};
    for (const d of list) {
      if (known.has(designationKey(d))) continue;
      const f = checkFields(STANDARD_SPEC, { designation: d }, 'create');
      if (f.errors.length) return bad(f.errors.join(' '));
      const { data, error } = await c.admin.from('standards').insert({ designation: d, checked: false }).select('id').single();
      if (error) { if (error.code === '23505') continue; return bad(error.message); }
      known.add(designationKey(d)); added.push(d);
      const r = await audit(c.admin, c.actor, { action: 'standard.create', table: 'standards', id: data.id, route: 'POST /api/admin/catalog-import', after: { designation: d, checked: false }, note: 'added from the import as an unchecked standard' });
      if (r.auditWarning) audited = r;
    }
    return NextResponse.json({ added, plan: await preview(c.admin, input, batch), ...audited });
  }

  if (body.action === 'confirm') {
    const plan = await preview(c.admin, input, batch);
    if (!plan.canConfirm) return bad('The import has errors; fix them and preview again.', 400, { plan });
    if (plan.fingerprint !== body.fingerprint) return bad('The data changed since the preview (or the files are different). Preview again before confirming.', 409, { plan });
    const result = await applyPlan(c.admin, c.actor, plan, batch);
    const audited = result.auditWarning ? { auditWarning: result.auditWarning } : {};
    if (!result.ok) return bad(result.error, 500, { done: result.done, ...audited });
    return NextResponse.json({ ok: true, writes: result.done, summary: plan.summary, ...audited });
  }
  return bad("action must be 'preview', 'add_standards' or 'confirm'.");
}
