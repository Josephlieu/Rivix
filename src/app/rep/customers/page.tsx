import { Mail, Phone, Eye, Plus } from 'lucide-react';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getCurrentRep } from '@/lib/current-rep';
import { isAdminUser } from '@/lib/admin-auth';
import NoRepProfile from '../NoRepProfile';

export default async function RepCustomers() {
  const rep = await getCurrentRep();
  if (!rep) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return <NoRepProfile isAdmin={isAdminUser(user)} />;
  }

  const { data: customers } = await createAdminClient()
    .from('customers')
    .select('id, customer_code, company_name, contact_email, contact_phone, orders(count)')
    .eq('rep_id', rep.id)
    .order('company_name', { ascending: true });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Customers</h1>
        <p className="text-slate-500">The customers assigned to you. Create their orders from here.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-left min-w-[560px]">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              {['Customer', 'Contact', 'Orders', 'Actions'].map((h) => (
                <th key={h} className={`px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(!customers || customers.length === 0) && (
              <tr><td colSpan={4} className="px-8 py-10 text-center text-sm text-slate-400">No customers assigned to you yet.</td></tr>
            )}
            {customers?.map((c: any) => (
              <tr key={c.id}>
                <td className="px-4 sm:px-8 py-5">
                  <Link href={`/rep/customers/${c.id}`} className="font-bold text-slate-900 hover:text-rivix transition-colors">{c.company_name}</Link>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{c.customer_code}</p>
                </td>
                <td className="px-4 sm:px-8 py-5 text-sm text-slate-600 space-y-1">
                  <p className="flex items-center gap-2"><Mail size={14} className="text-slate-400" />{c.contact_email}</p>
                  {c.contact_phone && <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400" />{c.contact_phone}</p>}
                </td>
                <td className="px-4 sm:px-8 py-5 text-sm font-bold text-slate-700">{c.orders?.[0]?.count ?? 0}</td>
                <td className="px-4 sm:px-8 py-5 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <Link href={`/rep/customers/${c.id}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-rivix hover:text-rivix transition-all">
                      <Eye size={14} />View details
                    </Link>
                    <Link href={`/rep/orders/new?customer=${c.id}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rivix text-xs font-bold text-white shadow-md shadow-rivix/20 hover:bg-rivix-dark active:scale-95 transition-all">
                      <Plus size={14} />New order
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
