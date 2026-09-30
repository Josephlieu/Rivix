import Link from 'next/link';
import { Users, FileText, Truck, ArrowUpRight, Plus, Eye } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getCurrentRep } from '@/lib/current-rep';
import { isAdminUser } from '@/lib/admin-auth';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import NoRepProfile from './NoRepProfile';

export default async function RepHome() {
  const rep = await getCurrentRep();
  if (!rep) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return <NoRepProfile isAdmin={isAdminUser(user)} />;
  }

  // Everything below is filtered by the rep worked out from the session,
  // so a rep can only ever see their own customers and orders.
  const admin = createAdminClient();
  const { data: customers } = await admin.from('customers').select('id').eq('rep_id', rep.id);
  const customerIds = (customers || []).map((c: any) => c.id);

  const { data: orders } = customerIds.length
    ? await admin
        .from('orders')
        .select('id, batch_number, product_name, quantity, status, created_at, customers(company_name)')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
    : { data: [] as any[] };

  const all = orders || [];
  const inProgress = all.filter((o: any) => !['Delivered', 'Cancelled'].includes(o.status)).length;

  const stats = [
    { label: 'My Customers', value: customerIds.length, icon: Users, color: 'text-rivix' },
    { label: 'Total Orders', value: all.length, icon: FileText, color: 'text-slate-700' },
    { label: 'In Progress', value: inProgress, icon: Truck, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="bg-gradient-to-r from-rivix to-rivix-dark rounded-2xl lg:rounded-3xl p-6 lg:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-start gap-3 lg:gap-4">
          <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
            Sales Portal
          </div>
          <h1 className="text-2xl lg:text-4xl font-bold tracking-tight">Welcome back, {rep.name}</h1>
          <p className="text-white/80 max-w-lg mb-2 lg:mb-4 text-sm lg:text-base">
            {customerIds.length === 0
              ? 'No customers are assigned to you yet. Once admin assigns some, you can create their orders here.'
              : `You have ${customerIds.length} customer${customerIds.length === 1 ? '' : 's'} and ${inProgress} order${inProgress === 1 ? '' : 's'} in progress.`}
          </p>
          {customerIds.length > 0 && (
            <Link href="/rep/orders/new" className="bg-white text-rivix px-6 py-3 rounded-xl font-bold text-sm hover:bg-white/90 active:scale-95 transition-all shadow-lg flex items-center gap-2">
              <Plus size={18} />
              New Order
            </Link>
          )}
        </div>
        <div className="absolute -right-20 -bottom-20 w-40 h-40 lg:w-80 lg:h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute right-20 top-0 w-20 h-20 lg:w-40 lg:h-40 bg-white/20 rounded-full blur-2xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 lg:p-8 rounded-2xl shadow-sm border border-slate-100 group hover:border-rivix/20 transition-all">
            <div className="p-3 lg:p-4 rounded-xl inline-block mb-4 lg:mb-6 bg-slate-50 group-hover:bg-rivix/5 transition-colors">
              <stat.icon className={`${stat.color} w-6 h-6 lg:w-7 lg:h-7`} />
            </div>
            <p className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-2xl lg:text-3xl font-extrabold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 sm:p-8 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Recent Orders</h3>
          <Link href="/rep/orders" className="text-sm font-bold text-rivix hover:text-rivix-dark transition-colors">View All</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[560px]">
            <thead className="bg-slate-50/50">
              <tr>
                {['Order #', 'Customer', 'Product', 'Status', 'Actions'].map((h) => (
                  <th key={h} className={`px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {all.length === 0 && (
                <tr><td colSpan={5} className="px-4 sm:px-8 py-10 text-center text-sm text-slate-400">No orders yet.</td></tr>
              )}
              {all.slice(0, 5).map((o: any) => (
                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-4 sm:px-8 py-6 font-bold text-slate-700 whitespace-nowrap">{o.batch_number}</td>
                  <td className="px-4 sm:px-8 py-6 text-slate-600 font-medium">{o.customers?.company_name}</td>
                  <td className="px-4 sm:px-8 py-6 text-slate-600 font-medium">{o.product_name} <span className="text-slate-400">× {o.quantity}</span></td>
                  <td className="px-4 sm:px-8 py-6"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 sm:px-8 py-6 text-right">
                    <Link href={`/rep/orders/${o.id}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-rivix hover:text-rivix transition-all whitespace-nowrap"><Eye size={14} />View details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
