'use client';

import {
  ArrowLeft, 
  Download, 
  Package, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  ShieldCheck,
  RotateCw,
  FileDown,
  Eye,
  X
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getMyOrders, getCurrentCustomer } from '@/lib/storage';
import { supabaseBrowser } from '@/lib/supabase-browser';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import SizeBreakdown from '@/components/SizeBreakdown';
import DocumentList from '@/components/DocumentList';
import type { DocumentRow } from '@/lib/documents';

export default function OrderDetailPage({ params }: { params: Promise<{ batch: string }> }) {
  const [order, setOrder] = useState<any>(null);
  const [companyName, setCompanyName] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);


  useEffect(() => {
    const loadData = async () => {
      const { batch } = await params;
      const [myOrders, customer] = await Promise.all([getMyOrders(), getCurrentCustomer()]);
      setCompanyName(customer?.company_name || '');
      const found = myOrders.find(o => o.batch_number === batch);

      if (found) {
        // Both are protected by row security: a customer only ever gets their own
        // order's items and the timeline entries admin marked customer-visible.
        const [{ data: its }, { data: evs }, { data: dcs }] = await Promise.all([
          supabaseBrowser.from('order_items').select('*').eq('order_id', found.id).order('position'),
          supabaseBrowser.from('order_events').select('*').eq('order_id', found.id).order('created_at', { ascending: false }),
          supabaseBrowser.from('documents').select('*').eq('order_id', found.id).order('created_at', { ascending: false }),
        ]);
        setDocs((dcs as DocumentRow[]) || []);
        setItems(its || []);
        setEvents(evs || []);
        setOrder({
          ...found,
        });
      } else {
        // Not one of this customer's orders — either it doesn't exist,
        // or it belongs to someone else. Either way, don't show it.
        setNotFound(true);
      }
    };
    loadData();
  }, [params]);



  if (notFound) {
    return (
      <div className="p-20 text-center space-y-4">
        <p className="text-slate-400 font-bold uppercase tracking-widest">Order not found</p>
        <Link href="/portal/orders" className="inline-flex items-center gap-2 text-sm font-bold text-rivix hover:text-rivix-dark transition-colors">
          <ArrowLeft size={16} />
          Back to Orders
        </Link>
      </div>
    );
  }

  if (!order) return <div className="p-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Loading Order Details...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <Link href="/portal" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-rivix transition-colors">
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-extrabold text-slate-900 leading-none">Order {order.batch_number}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-slate-500 font-medium">{order.product_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar size={12} />
                Order Date
              </p>
              <p className="text-sm font-bold text-slate-900">{order.order_date || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Package size={12} />
                Quantity
              </p>
              <p className="text-sm font-bold text-slate-900">{order.quantity} Units</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <MapPin size={12} />
                {order.delivery_location ? 'Delivery' : 'Origin'}
              </p>
              <p className="text-sm font-bold text-slate-900">{order.delivery_location || order.origin || '—'}</p>
            </div>
          </div>

          {items.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-900">Products</h3></div>
              <div className="p-5 sm:p-8 space-y-4">
                {items.map((it: any) => (
                  <div key={it.id} className="rounded-2xl border border-slate-100 p-4 text-sm space-y-1">
                    <p className="font-bold text-slate-900">{it.product_name} <span className="text-slate-400 font-semibold">× {it.quantity}</span></p>
                    <SizeBreakdown sizes={it.size_breakdown} fallbackText={it.sizing} />
                    {it.branding && <p className="text-slate-500">Branding: {it.branding}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(order.carrier || order.tracking_number) && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-900">Shipping</h3></div>
              <div className="p-5 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Carrier</p>
                  <p className="text-sm font-semibold text-slate-700">{order.carrier || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tracking number</p>
                  <p className="text-sm font-semibold text-slate-700 break-all">{order.tracking_number || '—'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-900">Progress</h3></div>
            <div className="p-5 sm:p-8 space-y-4">
              {events.length === 0 && <p className="text-sm text-slate-400">No updates yet.</p>}
              {events.map((e: any) => (
                <div key={e.id} className="text-sm border-l-2 border-slate-100 pl-4">
                  <p className="font-semibold text-slate-900">{e.status || 'Update'}</p>
                  {e.note && <p className="text-slate-500">{e.note}</p>}
                  <p className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>


          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Technical Specifications</h3>
            </div>
            <div className="p-5 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { label: 'Primary Fabric', value: order.material },
                { label: 'Safety Standard', value: order.safety_standard },
              ].filter(item => item.value).map(item => (
                <div key={item.label}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-700">{item.value}</p>
                </div>
              ))}
              {!order.material && !order.safety_standard && (
                <p className="text-sm text-slate-400 col-span-2">No technical specification on file for this order yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <ShieldCheck className="text-emerald-500" size={20} />
              Compliance Documentation
            </h3>
            <DocumentList documents={docs} empty="No documents yet. When RIVIX uploads certificates or other files for this order, they will appear here." />
          </div>
        </div>
      </div>

    </div>
  );
}
