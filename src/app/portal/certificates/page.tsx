'use client';

import { useState, useEffect } from 'react';
import { getMyOrders } from '@/lib/storage';
import { ShieldCheck, Download, Search, FileText, Eye, X } from 'lucide-react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { CertificatePDF } from '@/lib/CertificatePDF';

export default function CertificatesPage() {
  const [certs, setCerts] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [viewingCert, setViewingCert] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsClient(true);
      const myOrders = await getMyOrders();

      const allCerts = myOrders.flatMap(batch => [
        { ...batch, type: 'Certificate of Origin', number: `COO-${batch.batch_number}` },
        { ...batch, type: 'Quality Inspection Report', number: `QIR-${batch.batch_number}` },
        { ...batch, type: 'Certificate of Compliance', number: `COC-${batch.batch_number}` },
      ]);
      
      setCerts(allCerts);
    };
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compliance Documents</h1>
        <p className="text-slate-500">Access and download all authenticated certificates for your shipments.</p>
      </div>

      {certs.length === 0 && (
        <p className="text-sm text-slate-400 py-10 text-center">No certificates yet — these are generated once you have an order in the system.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {certs.map((cert, i) => (
          <div key={`${cert.number}-${i}`} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:border-rivix/20 transition-all group">
            <div className="p-4 rounded-2xl bg-slate-50 group-hover:bg-rivix/5 text-slate-400 group-hover:text-rivix transition-all inline-block mb-6">
              <ShieldCheck size={32} />
            </div>
            
            <h3 className="text-sm font-bold text-slate-900 mb-1">{cert.type}</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">No: {cert.number}</p>
            
            <div className="space-y-3 mb-8">
               <div className="flex justify-between text-xs font-medium border-b border-slate-50 pb-2">
                <span className="text-slate-400">Order</span>
                <span className="text-slate-900 font-bold whitespace-nowrap">{cert.batch_number}</span>

              </div>

              <div className="flex justify-between text-xs font-medium border-b border-slate-50 pb-2">
                <span className="text-slate-400">Product</span>
                <span className="text-slate-900 font-bold truncate ml-4">{cert.product_name}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setViewingCert(cert)}
                className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                View
              </button>
              
              {isClient ? (
                <PDFDownloadLink
                  document={
                    <CertificatePDF 
                      data={{
                        batch_number: cert.batch_number,
                        client_name: cert.client_name,
                        product_name: cert.product_name,
                        quantity: cert.quantity?.toString() || viewingCert.quantity?.toString() || '0',
                        material: cert.material || '65% Poly / 35% Cotton Heavy Twill',
                        origin: cert.origin || 'Partner Facility',
                        order_date: cert.order_date || '2026-04-10',
                        ship_date: cert.ship_date || '2026-05-02',
                        cert_type: cert.type,
                        cert_id: cert.number,
                        safety_standard: cert.safety_standard
                      }} 
                    />
                  }
                  fileName={`${cert.number}.pdf`}
                  className="flex-1 py-3 bg-rivix text-white rounded-xl text-xs font-bold hover:bg-rivix-dark transition-all flex items-center justify-center gap-2 shadow-lg shadow-rivix/20"
                >
                  {({ loading }) => (
                    loading ? '...' : <><Download size={16} /> Save</>
                  )}
                </PDFDownloadLink>
              ) : (
                <div className="flex-1 py-3 bg-slate-100 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                  <Download size={16} /> Save
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* PDF Viewer Modal */}
      {viewingCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-12 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

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
                        batch_number: viewingCert.batch_number,
                        client_name: viewingCert.client_name,
                        product_name: viewingCert.product_name,
                        quantity: viewingCert.quantity?.toString() || '150',
                        material: viewingCert.material || '65% Poly / 35% Cotton Heavy Twill',
                        origin: viewingCert.origin || 'Partner Facility',
                        order_date: viewingCert.order_date || '2026-04-10',
                        ship_date: viewingCert.ship_date || '2026-05-02',
                        cert_type: viewingCert.type,
                        cert_id: viewingCert.number,
                        safety_standard: viewingCert.safety_standard
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
