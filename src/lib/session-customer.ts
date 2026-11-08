import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAdminUser, isRepUser } from '@/lib/admin-auth';

export const CUSTOMER_COLUMNS = 'id, user_id, customer_code, company_name, contact_name, contact_email, contact_phone, billing_address, shipping_address, rep_id';
export type CurrentCustomer = {
  id: string; user_id: string; customer_code: string; company_name: string; contact_name: string | null; contact_email: string | null;
  contact_phone: string | null; billing_address: string | null; shipping_address: string | null; rep_id: string | null;
};

// The signed-in customer, worked out on the server from the session only (the browser never names a customer).
// Returns a response to send back instead when the caller is signed out, staff, or has no customer record.
export async function getSessionCustomer(): Promise<{ denied: NextResponse } | { customer: CurrentCustomer; loginEmail: string; admin: ReturnType<typeof createAdminClient> }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { denied: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (isAdminUser(user) || isRepUser(user)) return { denied: NextResponse.json({ error: 'Only customers can use this.' }, { status: 403 }) };
  const admin = createAdminClient();
  const { data } = await admin.from('customers').select(CUSTOMER_COLUMNS).eq('user_id', user.id).maybeSingle();
  if (!data) return { denied: NextResponse.json({ error: 'Only customers can use this.' }, { status: 403 }) };
  return { customer: data as CurrentCustomer, loginEmail: (user.email || '').toLowerCase(), admin };
}
