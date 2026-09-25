'use client';

import { ProductCatalogEmbed } from '@/components/ProductCatalogEmbed';

export default function AdminProductsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
        <p className="text-slate-500">RIVIX apparel manufacturing catalog for client and internal reference.</p>
      </div>

      <ProductCatalogEmbed />
    </div>
  );
}
