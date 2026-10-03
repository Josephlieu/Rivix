import OrderStatusBadge from '@/components/OrderStatusBadge';

// The same heading on every order page (admin, rep, customer): a small "ORDER"
// label, the order number as the main title, and the stage badge beside it.
export default function OrderHeading({ number, status }: { number: string; status: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Order</p>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-none">{number}</h1>
        <OrderStatusBadge status={status} />
      </div>
    </div>
  );
}
