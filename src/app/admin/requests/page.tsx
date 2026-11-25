import { createAdminClient } from '@/lib/supabase-admin';
import { loadBoardRows } from '@/lib/order-request-board';
import RequestsBoard from '@/components/RequestsBoard';
import SampleRequests from '@/components/catalog/SampleRequests';

// Every customer's reorders and quote requests. Customers with no rep come to admin; the others go to their rep,
// but admin can see and handle any of them. (/admin/* is limited to signed-in admins by proxy.ts.)
export default async function AdminRequestsPage() {
  const rows = await loadBoardRows(createAdminClient());
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customer requests</h1>
        <p className="text-slate-500">Reorders and quote requests from every customer. Requests from customers without a rep are yours to handle.</p>
      </div>
      <RequestsBoard rows={rows} newOrderPath="/admin/orders/new" orderPath="/admin/orders" />
      {/* Every customer's submitted sample requests (2026-11-26). Unsubmitted quote carts are never shown. */}
      <SampleRequests endpoint="/api/admin/sample-requests" canDecide />
    </div>
  );
}
