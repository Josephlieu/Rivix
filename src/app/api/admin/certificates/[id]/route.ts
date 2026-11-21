import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, beforeAfter, isId, readJson } from '@/lib/catalog-route';
import { CERT_COLUMNS } from '@/lib/catalog-server';
import { checkValue } from '@/lib/catalog-fields';
import { CERT_BUCKET } from '@/lib/certificate-files';
import { audit } from '@/lib/audit';

// One certificate (2026-11-21, admin only). GET: a 10-minute download link (always as a download). PATCH: issuer and dates;
// changing a verified certificate sets it back to "uploaded" (it must be verified again). DELETE: only while "uploaded"
// (remove the verification first, so a verified record is never deleted by one click).
type P = { params: Promise<{ id: string }> };
export async function GET(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Certificate not found.', 404);
  const { data: cert } = await c.admin.from('certificates').select('id, file_path, file_name').eq('id', id).maybeSingle();
  if (!cert) return bad('Certificate not found.', 404);
  const { data, error } = await c.admin.storage.from(CERT_BUCKET).createSignedUrl(cert.file_path, 600, { download: cert.file_name });
  if (error || !data) return bad('Could not make a download link.', 500);
  return NextResponse.json({ url: data.signedUrl, fileName: cert.file_name });
}

export async function PATCH(req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Certificate not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  const { data: before } = await c.admin.from('certificates').select(CERT_COLUMNS).eq('id', id).maybeSingle();
  if (!before) return bad('Certificate not found.', 404);
  const values: Record<string, unknown> = {}, errors: string[] = [];
  for (const [k, kind, label] of [['issuing_body', { t: 'text', max: 200 }, 'Issued by'], ['issued_on', { t: 'date' }, 'Issue date'], ['expires_on', { t: 'date' }, 'Expiry date']] as const) {
    if (!(k in body)) continue;
    const r = checkValue(body[k], kind, label);
    if ('error' in r) errors.push(r.error); else values[k] = r.value;
  }
  if (errors.length) return bad(errors.join(' '));
  const d = beforeAfter(before, values);
  if (!d.changed) return NextResponse.json({ certificate: before, changed: false });
  const unverify = before.status === 'verified';
  const update = { ...d.after, ...(unverify ? { status: 'uploaded', verified_by: null, verified_by_email: null, verified_at: null } : {}) };
  const { data, error } = await c.admin.from('certificates').update(update).eq('id', id).select(CERT_COLUMNS).single();
  if (error) return bad(error.message);
  const audited = await audit(c.admin, c.actor, { action: 'certificate.edit', table: 'certificates', id, route: 'PATCH /api/admin/certificates/[id]', before: { ...d.before, ...(unverify ? { status: 'verified' } : {}) }, after: { ...d.after, ...(unverify ? { status: 'uploaded' } : {}) } });
  return NextResponse.json({ certificate: data, changed: true, verificationRemoved: unverify, ...audited });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Certificate not found.', 404);
  const { data: cert } = await c.admin.from('certificates').select('id, status, file_path, file_name, file_sha256, product_id, standard_id').eq('id', id).maybeSingle();
  if (!cert) return bad('Certificate not found.', 404);
  if (cert.status === 'verified') return bad('This certificate is verified. Remove the verification first, then delete it.', 409);
  const { error } = await c.admin.from('certificates').delete().eq('id', id);
  if (error) return bad(error.message, 500);
  await c.admin.storage.from(CERT_BUCKET).remove([cert.file_path]);
  const audited = await audit(c.admin, c.actor, { action: 'certificate.delete', table: 'certificates', id, route: 'DELETE /api/admin/certificates/[id]', before: { file_name: cert.file_name, file_sha256: cert.file_sha256, product_id: cert.product_id, standard_id: cert.standard_id, status: cert.status }, after: null });
  return NextResponse.json({ ok: true, ...audited });
}
