import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, isId } from '@/lib/catalog-route';
import { CERT_COLUMNS } from '@/lib/catalog-server';
import { audit } from '@/lib/audit';

// Remove a certificate's verification (2026-11-21, admin only): it goes back to "uploaded", and its claims show
// "Certificate needed" again. Who verified it before stays in the audit log.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Certificate not found.', 404);
  const { data: cert } = await c.admin.from('certificates').select('id, status, verified_by_email').eq('id', id).maybeSingle();
  if (!cert) return bad('Certificate not found.', 404);
  if (cert.status !== 'verified') return bad('This certificate is not verified.', 409);
  const { data, error } = await c.admin.from('certificates').update({ status: 'uploaded', verified_by: null, verified_by_email: null, verified_at: null })
    .eq('id', id).eq('status', 'verified').select(CERT_COLUMNS).maybeSingle();
  if (error) return bad(error.message);
  if (!data) return bad('This certificate is not verified.', 409);
  const audited = await audit(c.admin, c.actor, { action: 'certificate.unverify', table: 'certificates', id, route: 'POST /api/admin/certificates/[id]/unverify', before: { status: 'verified', verified_by_email: cert.verified_by_email }, after: { status: 'uploaded' } });
  return NextResponse.json({ certificate: data, ...audited });
}
