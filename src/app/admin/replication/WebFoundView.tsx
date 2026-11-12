'use client';

import { FROM_WEBSITE, CERT_DOES_NOT_CARRY, BRAND_OR_SELLER, type WebFound } from '@/lib/link-source';

// Task 21: what a product page gave, shown as plain text only (React escapes it; never as HTML). Every value is
// "from the website, not confirmed", and a standard or certification named on the page is a claim to verify only.
export default function WebFoundView({ found, missing, missingFor }: { found: WebFound; missing: string[]; missingFor: string }) {
  const rows: Array<[string, string[]]> = [
    ['Materials', found.materials], ['Fabric weight', found.weights], ['Sizes', found.sizes], ['Colours', found.colours], ['Care', found.care], ['Other details', found.details],
  ];
  return (
    <div className="space-y-3 text-[13px]">
      {(found.name || found.sku) && (
        <p className="text-slate-800"><span className="font-bold">{found.name || 'Product'}</span>{found.sku ? ` · ${found.sku}` : ''}</p>
      )}
      {/* A shop often puts its own company in the brand field, so this is never shown as the maker. */}
      {found.brand && (
        <p className="break-words text-slate-700"><span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{BRAND_OR_SELLER}</span><br />{found.brand}</p>
      )}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">{FROM_WEBSITE}</p>
        <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[9rem_1fr]">
          {rows.filter(([, v]) => v.length).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{k}</dt><dd className="whitespace-pre-wrap break-words text-slate-700">{v.join('\n')}</dd></div>
          ))}
          {rows.every(([, v]) => !v.length) && <dd className="text-slate-400">No materials, sizes, colours or care text were found on the page.</dd>}
        </dl>
      </div>
      {found.description && (
        <details className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-slate-500">Description from the page</summary>
          <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{found.description}</p>
        </details>
      )}
      {found.claims.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          <p className="text-[11px] font-black uppercase tracking-widest">The website claims (to verify)</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{found.claims.map(c => <li key={c} className="break-words">{c}</li>)}</ul>
          <p className="mt-1 text-[11px]">{CERT_DOES_NOT_CARRY} None of this fills a rating, standard or certification.</p>
        </div>
      )}
      {missing.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
          <p className="text-[11px] font-black uppercase tracking-widest">Not on the page ({missingFor})</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{missing.map(m => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
