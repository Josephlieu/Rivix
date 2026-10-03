import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import SizeBreakdown from '@/components/SizeBreakdown';
import DocumentList from '@/components/DocumentList';

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex justify-between gap-6 text-sm border-b border-slate-50 pb-3">
    <span className="text-slate-400">{label}</span>
    <span className="text-slate-900 font-semibold text-right">{value || '—'}</span>
  </div>
);

// Read-only: the rep follows the order, admin runs it.
export default async function RepOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rep = await getCurrentRep();
  if (!rep) notFound();

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('*, customers(company_name, customer_code, rep_id)')
    .eq('id', id)
    .maybeSingle();

  // Only orders of this rep's own customers
  if (!order || (order as any).customers?.rep_id !== rep.id) notFound();

  const [{ data: items }, { data: events }, { data: documents }] = await Promise.all([
    admin.from('order_items').select('*').eq('order_id', id).order('position'),
    admin.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    admin.from('documents').select('id, customer_id, order_id, title, doc_type, file_name, file_size, mime_type, created_at').eq('order_id', id).order('created_at', { ascending: false }),
  ]);

  const customer = (order as any).customers;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/rep/orders" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2">
        <ArrowLeft size={16} />Back to orders
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-900">{order.batch_number}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="text-slate-500 text-sm -mt-3">
        <Link href={`/rep/customers/${order.customer_id}`} className="hover:text-rivix font-semibold">{customer?.company_name}</Link> · {customer?.customer_code}
      </p>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-3">
        <h3 className="font-bold text-slate-900 mb-2">Order details</h3>
        <Row label="Delivery location" value={order.delivery_location} />
        <Row label="PO number" value={order.po_number} />
        <Row label="Pricing" value={order.pricing} />
        <Row label="Special requirements" value={order.special_requirements} />
        <Row label="Carrier" value={order.carrier} />
        <Row label="Tracking number" value={order.tracking_number} />
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
        <h3 className="font-bold text-slate-900">Products</h3>
        {(items || []).map((it: any) => (
          <div key={it.id} className="rounded-2xl border border-slate-100 p-4 text-sm space-y-1">
            <p className="font-bold text-slate-900">{it.product_name} <span className="text-slate-400 font-semibold">× {it.quantity}</span></p>
            <SizeBreakdown sizes={it.size_breakdown} fallbackText={it.sizing} />
            {it.branding && <p className="text-slate-500">Branding: {it.branding}</p>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
        <h3 className="font-bold text-slate-900">Documents</h3>
        <DocumentList documents={(documents as any[]) || []} empty="No documents uploaded for this order yet." />
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-3">
        <h3 className="font-bold text-slate-900">Progress</h3>
        {(events || []).map((e: any) => (
          <div key={e.id} className="text-sm border-l-2 border-slate-100 pl-4">
            <p className="font-semibold text-slate-900">{e.status || 'Note'}{!e.customer_visible && <span className="ml-2 text-[10px] font-black uppercase text-slate-400">internal</span>}</p>
            {e.note && <p className="text-slate-500">{e.note}</p>}
            <p className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
