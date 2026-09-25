'use client';

import { Package, ShieldCheck, FileText } from 'lucide-react';
import Image from 'next/image';
import { ProductCatalogEmbed } from '@/components/ProductCatalogEmbed';

export default function ProductSpecsPage() {
  const products = [
    {
      id: '1',
      name: 'ArcticShield Coverall',
      sku: 'AS-COVER-01',
      standard: 'CSA Z96-15 Class 3',
      fabric: '65% Poly / 35% Cotton Heavy Twill (320 GSM)',
      reinforcements: '1000D Nylon Cordura (Knees, Elbows, Cuffs)',
      lining: 'Quilted Diamond Taffeta w/ 200GSM Polyfill',
      reflective: '3M™ Scotchlite™ 8912 Silver Fabric (2.0" Width)',
      hardware: 'YKK #10 Heavy Duty Brass',
      thread: 'A&E Perma Core® Tex 60 (High tensile)',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Product Catalog & Specifications</h1>
        <p className="text-slate-500">RIVIX manufacturing catalog and your contracted apparel specs.</p>
      </div>

      <ProductCatalogEmbed />

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Approved Product Specifications</h2>
        <div className="grid grid-cols-1 gap-8">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col lg:flex-row"
            >
              <div className="w-full lg:w-1/3 bg-slate-900 p-8 flex flex-col items-center justify-center border-r border-slate-100 relative overflow-hidden group">
                <Image
                  src="/coverall_blueprint.png"
                  alt="Technical Blueprint"
                  width={400}
                  height={600}
                  className="object-contain z-10 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60 z-20" />
                <p className="absolute bottom-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] z-30">
                  Technical Elevation View
                </p>
              </div>

              <div className="flex-1 p-10">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">{p.name}</h3>
                  <p className="text-sm font-bold text-rivix uppercase tracking-widest">{p.sku}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  {[
                    { label: 'Safety Standard', value: p.standard, icon: ShieldCheck },
                    { label: 'Core Fabric', value: p.fabric, icon: FileText },
                    { label: 'Reinforcements', value: p.reinforcements, icon: ShieldCheck },
                    { label: 'Inner Lining', value: p.lining, icon: Package },
                    { label: 'Reflective Material', value: p.reflective, icon: ShieldCheck },
                    { label: 'Hardware (Zippers)', value: p.hardware, icon: Package },
                  ].map((spec) => (
                    <div key={spec.label} className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{spec.label}</p>
                      <p className="text-sm font-semibold text-slate-700">{spec.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Construction Notes</p>
                  <p className="text-xs text-slate-500 leading-relaxed italic">
                    Built for extreme cold-weather operations. Features reinforced action back pleat for 3&quot; of additional
                    movement and triple-needle chainstitching on all load-bearing seams. Thread: {p.thread}.
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
