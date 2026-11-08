import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import { loadBoardRows } from '@/lib/order-request-board';
import RequestsBoard from '@/components/RequestsBoard';

// Reorders and quote requests from this rep's own customers.
export default async function RepRequestsPage() {
  const rep = await getCurrentRep();
  if (!rep) return <p className="text-sm text-slate-500">Only sales reps can see customer requests.</p>;
  const rows = await loadBoardRows(createAdminClient(), rep.id);
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customer requests</h1>
        <p className="text-slate-500">Reorders and quote requests from your customers. Create the order from the request, or decline it with a reason.</p>
      </div>
      <RequestsBoard rows={rows} newOrderPath="/rep/orders/new" orderPath="/rep/orders" />
    </div>
  );
}
