import Link from 'next/link';

// Supplier and product records (2026-11-21): admin only (the proxy and every route check the two-step sign-in).
const TABS = [['suppliers', 'Suppliers'], ['products', 'Products'], ['certificates', 'Certificates'], ['standards', 'Standards'], ['import', 'Import']] as const;
export default function SourcingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sourcing</h1>
        <p className="text-sm text-slate-500">Suppliers, products, standards and certificates. Admin only; supplier contacts are never shown outside these pages.</p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {TABS.map(([href, name]) => <Link key={href} href={`/admin/sourcing/${href}`} className="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50">{name}</Link>)}
      </nav>
      {children}
    </div>
  );
}
