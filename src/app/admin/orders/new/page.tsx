import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase-admin';
import NewOrderForm from '@/app/rep/orders/new/NewOrderForm';

// Admin enters an order for any customer. (/admin/* is already limited to signed-in admins by proxy.ts.)
export default async function AdminNewOrderPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  const db = createAdminClient();
  const [{ data }, { data: repRows }] = await Promise.all([
    db.from('customers').select('id, customer_code, company_name, rep_id, rep:reps(name)').order('company_name', { ascending: true }),
    db.from('reps').select('id, name').eq('active', true).order('name', { ascending: true }),
  ]);

  const customers = (data || []).map((c: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: c.id as string,
    customer_code: c.customer_code as string,
    company_name: c.company_name as string,
    rep_id: (c.rep_id as string | null) ?? null,
    rep_name: (c.rep?.name as string | null) ?? null,
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/admin/orders" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2">
        <ArrowLeft size={16} />Back to orders
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New order</h1>
        <p className="text-slate-500">Enter an order for any customer and choose the sales rep. The customer and the rep are notified.</p>
      </div>
      <NewOrderForm
        customers={customers}
        initialCustomerId={customer}
        endpoint="/api/admin/orders"
        orderBasePath="/admin/orders"
        cancelPath="/admin/orders"
        reps={(repRows || []) as { id: string; name: string }[]}
        emptyMessage="There are no customers yet. Add one on the Clients page first."
      />
    </div>
  );
}
