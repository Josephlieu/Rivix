import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, isId } from '@/lib/catalog-route';
import { CERT_COLUMNS } from '@/lib/catalog-server';
import { audit } from '@/lib/audit';

// An admin verifies a certificate (2026-11-21): they have checked the file against the product, the standard edition, the
// issuer and the dates. Records who and when. Every document needs its issuing body (for a declaration, the manufacturer);
// a third-party certificate or lab report also needs an expiry date (a declaration never counts as proof, so it may have none).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Certificate not found.', 404);
  const { data: cert } = await c.admin.from('certificates').select('id, status, expires_on, document_type, issuing_body').eq('id', id).maybeSingle();
  if (!cert) return bad('Certificate not found.', 404);
  if (cert.status === 'verified') return bad('This certificate is already verified.', 409);
  if (!cert.issuing_body?.trim()) return bad('Add who issued it ("Issued by") before verifying. For a manufacturer declaration, that is the manufacturer.');
  if (!cert.expires_on && cert.document_type !== 'manufacturer_declaration') return bad('Add the expiry date before verifying: a certificate without one is never counted.');
  const at = new Date().toISOString();
  const { data, error } = await c.admin.from('certificates').update({ status: 'verified', verified_by: c.who.userId, verified_by_email: c.who.email, verified_at: at })
    .eq('id', id).eq('status', 'uploaded').select(CERT_COLUMNS).maybeSingle();
  if (error) return bad(error.message);
  if (!data) return bad('This certificate is already verified.', 409);
  const audited = await audit(c.admin, c.actor, { action: 'certificate.verify', table: 'certificates', id, route: 'POST /api/admin/certificates/[id]/verify', before: { status: 'uploaded' }, after: { status: 'verified', verified_by_email: c.who.email, document_type: cert.document_type } });
  return NextResponse.json({ certificate: data, ...audited });
}
