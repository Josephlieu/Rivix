import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getCurrentRep } from '@/lib/current-rep';
import { isAdminUser } from '@/lib/admin-auth';
import NoRepProfile from '../NoRepProfile';
import RepOrdersList from './RepOrdersList';

export default async function RepOrders() {
  const rep = await getCurrentRep();
  if (!rep) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return <NoRepProfile isAdmin={isAdminUser(user)} />;
  }

  const admin = createAdminClient();
  const { data: customers } = await admin.from('customers').select('id').eq('rep_id', rep.id);
  const ids = (customers || []).map((c: any) => c.id);

  const { data: orders } = ids.length
    ? await admin
        .from('orders')
        .select('id, batch_number, product_name, quantity, status, created_at, customers(company_name)')
        .in('customer_id', ids)
        .order('created_at', { ascending: false })
    : { data: [] as any[] };

  const rows = (orders || []).map((o: any) => ({
    id: o.id,
    batch_number: o.batch_number,
    customer: o.customers?.company_name || '',
    product_name: o.product_name,
    quantity: o.quantity,
    status: o.status,
    created_at: o.created_at,
  }));

  return <RepOrdersList orders={rows} />;
}
