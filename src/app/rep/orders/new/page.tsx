import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import NewOrderForm from './NewOrderForm';
import { requestForOrderForm } from '@/lib/order-requests';

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ customer?: string; request?: string }> }) {
  const { customer, request } = await searchParams;
  const rep = await getCurrentRep();

  if (!rep) {
    return (
      <div className="space-y-4">
        <Link href="/rep/customers" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2"><ArrowLeft size={16} />Back</Link>
        <p className="text-sm text-slate-500">Only sales reps can create orders.</p>
      </div>
    );
  }

  const db = createAdminClient();
  // From a customer's request: only one of THIS rep's customers, and only while it is still open.
  const fromReq = await requestForOrderForm(db, request);
  const usable = fromReq && fromReq.customerRepId === rep.id ? fromReq : null;

  const { data: customers } = await db
    .from('customers')
    .select('id, customer_code, company_name')
    .eq('rep_id', rep.id)
    .order('company_name', { ascending: true });

  return (
    <div className="space-y-6">
      <Link href="/rep/customers" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2">
        <ArrowLeft size={16} />Back to my customers
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New order</h1>
        <p className="text-slate-500">Enter what your customer asked for. Admin takes it from here.</p>
      </div>
      {request && !usable && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">That request is no longer open (or is not one of your customers&apos;), so the form starts empty.</p>}
      <NewOrderForm customers={customers || []} initialCustomerId={usable ? usable.customerId : customer} fromRequest={usable?.form} />
    </div>
  );
}
