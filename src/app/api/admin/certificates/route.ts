import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminCtx, bad, isId, readJson } from '@/lib/catalog-route';
import { CERT_COLUMNS, today } from '@/lib/catalog-server';
import { CERT_SPEC, accreditationProblem, checkFields } from '@/lib/catalog-fields';
import { CERT_BUCKET, checkCertificateFile, safeName } from '@/lib/certificate-files';
import { CLAIM_LABEL, claimStatus, daysToExpiry, expiryWarning, type CertFacts } from '@/lib/compliance';
import { audit } from '@/lib/audit';

// Certificates (2026-11-21, admin only). GET: every certificate with its product, standard, days to expiry and warning
// (expired, within 30 or 60 days); ?warning=expired|within_30|within_60, ?status=uploaded|verified, ?product=<id>.
// POST: record a file uploaded with upload-url (checked by its content; stored once); a new certificate is "uploaded" until
// an admin verifies it. The document type is required (2026-11-25); accreditation is for accredited lab reports only.
export async function GET(req: NextRequest) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  let q = c.admin.from('certificates').select(`${CERT_COLUMNS}, product:products(id, code, name), standard:standards(id, designation, checked)`).order('expires_on', { ascending: true, nullsFirst: false });
  const sp = req.nextUrl.searchParams;
  if (sp.get('status') === 'uploaded' || sp.get('status') === 'verified') q = q.eq('status', sp.get('status'));
  if (isId(sp.get('product'))) q = q.eq('product_id', sp.get('product'));
  const { data, error } = await q;
  if (error) return bad('Could not read the certificates.', 500);
  const day = today(), all = (data ?? []) as unknown as Array<Record<string, unknown> & CertFacts & { standard: { checked: boolean } }>;
  const w = sp.get('warning');
  const rows = all.map((x) => ({ ...x, daysToExpiry: daysToExpiry(x.expires_on, day), warning: expiryWarning(x.expires_on, day), ruleStatus: CLAIM_LABEL[claimStatus(x, x.standard, [x], day)] }))
    .filter((x) => !w || x.warning === w);
  return NextResponse.json({ certificates: rows, today: day });
}

export async function POST(req: NextRequest) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const body = await readJson(req); if (!body) return bad('Bad request');
  const path = String(body.path ?? '');
  if (!/^pending\/[0-9a-f-]{36}$/.test(path)) return bad('Upload the file first.');
  if (!isId(body.product_id) || !isId(body.standard_id)) return bad('Choose the product and the standard.');
  const f = checkFields(CERT_SPEC, body, 'create');
  if (!f.values.document_type) f.errors.push('Choose the document type (third-party certificate, accredited lab report or manufacturer declaration).');
  const ap = accreditationProblem(f.values.document_type, f.values.accreditation); if (ap) f.errors.push(ap);
  if (f.errors.length) { await c.admin.storage.from(CERT_BUCKET).remove([path]); return bad(f.errors.join(' ')); }
  const v = f.values as { document_type: string; issuing_body: string | null; accreditation: string | null; issued_on: string | null; expires_on: string | null };
  const [p, s] = await Promise.all([c.admin.from('products').select('id, code, name').eq('id', body.product_id).maybeSingle(), c.admin.from('standards').select('id, designation').eq('id', body.standard_id).maybeSingle()]);
  if (!p.data || !s.data) { await c.admin.storage.from(CERT_BUCKET).remove([path]); return bad('Product or standard not found.', 404); }
  const { data: blob } = await c.admin.storage.from(CERT_BUCKET).download(path);
  if (!blob) return bad('The upload did not finish. Please try again.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chk = checkCertificateFile(bytes);
  if ('error' in chk) { await c.admin.storage.from(CERT_BUCKET).remove([path]); return bad(`Refused: ${chk.error}.`); }
  const finalPath = `${p.data.id}/${crypto.randomUUID()}.${chk.ext}`;
  const mv = await c.admin.storage.from(CERT_BUCKET).move(path, finalPath);
  if (mv.error) return bad('The file could not be stored.', 500);
  const row = {
    product_id: p.data.id, standard_id: s.data.id, document_type: v.document_type, issuing_body: v.issuing_body, accreditation: v.accreditation, issued_on: v.issued_on, expires_on: v.expires_on,
    file_path: finalPath, file_name: safeName(String(body.file_name ?? `certificate.${chk.ext}`)), file_size: bytes.length, mime_type: chk.type,
    file_sha256: crypto.createHash('sha256').update(bytes).digest('hex'), status: 'uploaded', uploaded_by: c.who.userId, uploaded_by_email: c.who.email,
  };
  const { data, error } = await c.admin.from('certificates').insert(row).select(CERT_COLUMNS).single();
  if (error) { await c.admin.storage.from(CERT_BUCKET).remove([finalPath]); return bad(error.message); }
  const audited = await audit(c.admin, c.actor, { action: 'certificate.upload', table: 'certificates', id: data.id, route: 'POST /api/admin/certificates', after: { product: p.data.code ?? p.data.name, standard: s.data.designation, file_name: row.file_name, file_sha256: row.file_sha256, document_type: row.document_type, issuing_body: row.issuing_body, accreditation: row.accreditation, issued_on: row.issued_on, expires_on: row.expires_on, status: 'uploaded' } });
  return NextResponse.json({ certificate: data, ...audited }, { status: 201 });
}
