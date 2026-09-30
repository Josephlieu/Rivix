import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Plus, Eye } from 'lucide-react';
import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import OrderStatusBadge from '@/components/OrderStatusBadge';

// One of the rep's own customers: their details and every order they have.
export default async function RepCustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rep = await getCurrentRep();
  if (!rep) notFound();

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select('id, customer_code, company_name, contact_email, contact_phone, rep_id, created_at')
    .eq('id', id)
    .maybeSingle();

  // A rep can only open customers assigned to them
  if (!customer || customer.rep_id !== rep.id) notFound();

  const { data: orders } = await admin
    .from('orders')
    .select('id, batch_number, product_name, quantity, status, created_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8 max-w-4xl">
      <Link href="/rep/customers" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2">
        <ArrowLeft size={16} />Back to my customers
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{customer.company_name}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">{customer.customer_code}</p>
        </div>
        <Link href={`/rep/orders/new?customer=${customer.id}`} className="bg-rivix text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all flex items-center justify-center gap-2">
          <Plus size={18} />New order
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email</p>
          <p className="text-sm font-semibold text-slate-700 flex items-center gap-2 break-all"><Mail size={14} className="text-slate-400 shrink-0" />{customer.contact_email || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone</p>
          <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Phone size={14} className="text-slate-400 shrink-0" />{customer.contact_phone || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Customer since</p>
          <p className="text-sm font-semibold text-slate-700">{new Date(customer.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-8 py-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Orders ({orders?.length ?? 0})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[560px]">
            <thead className="bg-slate-50/50">
              <tr>
                {['Order #', 'Product', 'Created', 'Status', 'Actions'].map((h) => (
                  <th key={h} className={`px-4 sm:px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!orders || orders.length === 0) && (
                <tr><td colSpan={5} className="px-8 py-10 text-center text-sm text-slate-400">No orders yet for this customer.</td></tr>
              )}
              {orders?.map((o: any) => (
                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-4 sm:px-8 py-4 font-bold text-slate-700 whitespace-nowrap">{o.batch_number}</td>
                  <td className="px-4 sm:px-8 py-4 text-slate-600 font-medium">{o.product_name} <span className="text-slate-400">× {o.quantity}</span></td>
                  <td className="px-4 sm:px-8 py-4 text-sm text-slate-500 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 sm:px-8 py-4"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 sm:px-8 py-4 text-right">
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
