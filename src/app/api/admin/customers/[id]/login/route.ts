import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateTempPassword } from '@/lib/temp-password';

// Set a fresh temporary password for a customer (the old one stops working).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: customer } = await admin
    .from('customers')
    .select('id, user_id, contact_email')
    .eq('id', id)
    .maybeSingle();
  if (!customer?.user_id) return NextResponse.json({ error: 'This client has no login.' }, { status: 404 });

  const password = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(customer.user_id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ credentials: { email: customer.contact_email, password }, reset: true });
}
