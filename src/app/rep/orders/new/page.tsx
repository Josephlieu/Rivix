import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import NewOrderForm from './NewOrderForm';

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  const rep = await getCurrentRep();

  if (!rep) {
    return (
      <div className="space-y-4">
        <Link href="/rep/customers" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2"><ArrowLeft size={16} />Back</Link>
        <p className="text-sm text-slate-500">Only sales reps can create orders.</p>
      </div>
    );
  }

  const { data: customers } = await createAdminClient()
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
      <NewOrderForm customers={customers || []} initialCustomerId={customer} />
    </div>
  );
}
