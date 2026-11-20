import { NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { audit, adminActor, type AuditAction } from '@/lib/audit';

// Audit log (2026-11-21): the two-step page calls this after every successful code. Setting up an authenticator happens in
// the browser (Supabase), so the server cannot see it happen; instead it reads the admin's VERIFIED authenticators itself
// (never trusting the browser) and records each one not recorded yet: exactly one "admin_2fa.enrolled" row per authenticator
// (the database allows only one). An authenticator set up some other way is recorded at that admin's next two-step sign-in;
// factor_created_at says when it was really set up. Only the factor id and dates are stored, never the secret or a code.
const ACTION: AuditAction = 'admin_2fa.enrolled';

export async function POST() {
  const who = await getAdminIdentity(); // a signed-in admin who has passed the two-step sign-in (aal2)
  if ('denied' in who) return who.denied;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: who.userId });
  if (error) return NextResponse.json({ error: 'Could not read the authenticators.' }, { status: 500 });
  const verified = (data?.factors || []).filter((f) => f.status === 'verified');
  if (!verified.length) return NextResponse.json({ ok: true, recorded: 0 });

  const { data: done } = await admin.from('audit_log').select('record_id').eq('action', ACTION).in('record_id', verified.map((f) => f.id));
  const known = new Set((done || []).map((r) => r.record_id as string));
  let recorded = 0;
  let warning: { auditWarning?: string } = {};
  for (const f of verified.filter((x) => !known.has(x.id))) {
    const r = await audit(admin, adminActor(who), {
      action: ACTION, table: 'auth.mfa_factors', id: f.id, route: 'POST /api/admin/mfa/enrolled',
      before: { status: null }, after: { status: 'verified', factor_type: f.factor_type, factor_created_at: f.created_at ?? null },
    }, { once: true });
    if (r.auditWarning) warning = r; else recorded++;
  }
  return NextResponse.json({ ok: true, recorded, ...warning });
}
