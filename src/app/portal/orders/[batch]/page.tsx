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
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { CertificatePDF } from '@/lib/CertificatePDF';
import { useEffect, useState } from 'react';
import { getMyOrders } from '@/lib/storage';

export default function OrderDetailPage({ params }: { params: Promise<{ batch: string }> }) {
  const [isClient, setIsClient] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [viewingCert, setViewingCert] = useState<any>(null);


  useEffect(() => {
    const loadData = async () => {
      const { batch } = await params;
      setIsClient(true);
      const myOrders = await getMyOrders();
      const found = myOrders.find(o => o.batch_number === batch);

      if (found) {
        setOrder({
          ...found,
          est_delivery: 'May 02, 2026',
          expiry: 'Valid for 1 Year from Receipt',
          certs: [
            { id: '1', type: 'Certificate of Origin', number: `COO-${found.batch_number}` },
            { id: '2', type: 'Quality Inspection Report', number: `QIR-${found.batch_number}` },
            { id: '3', type: 'Certificate of Compliance', number: `COC-${found.batch_number}` },
          ]
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
          </div>
          <p className="text-slate-500 font-medium">{order.product_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar size={12} />
                Order Date
              </p>
              <p className="text-sm font-bold text-slate-900">{order.order_date}</p>
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
                Origin
              </p>
              <p className="text-sm font-bold text-slate-900">{order.origin}</p>
            </div>
          </div>


          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Technical Specifications</h3>
            </div>
            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { label: 'Primary Fabric', value: order.material },
                { label: 'Safety Standard', value: order.safety_standard },
                { label: 'Expiry', value: order.expiry },
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
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <ShieldCheck className="text-emerald-500" size={20} />
              Compliance Documentation
            </h3>
            <div className="space-y-4">
              {order.certs.map((cert: any) => (
                <div key={cert.id} className="p-4 rounded-2xl border border-slate-50 bg-slate-50/50 space-y-4">
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-900 mb-1 leading-tight">{cert.type}</h4>
                    <p className="text-[10px] text-slate-400 font-medium">No: {cert.number}</p>
                  </div>
                  
                  <div className="w-full flex gap-2">
                    <button 
                      onClick={() => setViewingCert(cert)}
                      className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-[10px] font-bold text-slate-500 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Eye size={12} />
                      View
                    </button>
                    
                    {isClient ? (
                      <PDFDownloadLink
                        document={
                          <CertificatePDF 
                            data={{
                              batch_number: order.batch_number,
                              client_name: order.client_name || 'Pacific Mining Co.',
                              product_name: order.product_name,
                              quantity: order.quantity.toString(),
                              material: order.material,
                              origin: order.origin,
                              order_date: order.order_date,
                              ship_date: order.ship_date,
                              cert_type: cert.type,
                              cert_id: cert.number,
                              safety_standard: order.safety_standard
                            }} 
                          />
                        }
                        fileName={`${cert.number}.pdf`}
                        className="flex-1 py-2 bg-rivix text-[10px] font-bold text-white rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm shadow-rivix/20"
                      >
                        {({ loading }) => (
                          loading ? '...' : <><Download size={12} /> Save</>
                        )}
                      </PDFDownloadLink>
                    ) : (
                      <div className="flex-1 py-2 bg-slate-50 text-[10px] font-bold text-slate-300 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed">
                        <Download size={12} />
                        Save
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {viewingCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="bg-rivix/10 p-2 rounded-lg text-rivix">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{viewingCert.type}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{viewingCert.number}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingCert(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-8 flex items-center justify-center overflow-hidden">
               {isClient && (
                 <PDFViewer style={{ width: '100%', height: '100%', borderRadius: '12px', border: 'none' }}>
                   <CertificatePDF 
                      data={{
                        batch_number: order.batch_number,
                        client_name: order.client_name || 'Pacific Mining Co.',
                        product_name: order.product_name,
                        quantity: order.quantity.toString(),
                        material: order.material,
                        origin: order.origin,
                        order_date: order.order_date,
                        ship_date: order.ship_date,
                        cert_type: viewingCert.type,
                        cert_id: viewingCert.number,
                        safety_standard: order.safety_standard
                      }} 
                    />
                 </PDFViewer>
               )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
               <button 
                onClick={() => setViewingCert(null)}
                className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs hover:bg-slate-800 transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
