const styles: Record<string, string> = {
  'Order Received': 'bg-slate-100 text-slate-600',
  'Sampling & Approval': 'bg-violet-50 text-violet-600',
  'In Production': 'bg-amber-50 text-amber-600',
  'QC & Packaging': 'bg-sky-50 text-sky-600',
  Shipped: 'bg-blue-50 text-blue-600',
  Delivered: 'bg-emerald-50 text-emerald-600',
  Cancelled: 'bg-red-50 text-red-500',
};

export default function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block whitespace-nowrap text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}
