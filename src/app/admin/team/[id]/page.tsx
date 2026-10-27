'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Pencil, Mail, Phone, MapPin, Users, CheckCircle2, Truck, FileText } from 'lucide-react';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import RepEditModal from '@/components/RepEditModal';
import Toast, { type ToastMessage } from '@/components/Toast';
import { formatDate, formatDateTime } from '@/lib/format';

interface Rep {
  id: string;
  rep_code?: string | null;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  territory?: string | null;
  active: boolean;
  has_login: boolean;
  created_at: string;
}
interface Stats {
  customers: number;
  orders_total: number;
  orders_completed: number;
  orders_in_progress: number;
  requests: number;
}
interface Customer {
  id: string;
  customer_code: string | null;
  company_name: string;
  contact_email: string | null;
  created_at: string;
  assigned_at: string;
  assigned_exact: boolean;
}
interface Order {
  id: string;
  batch_number: string;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
  customers: { company_name: string } | null;
}
interface Activity {
  at: string;
  kind: string;
  label: string;
  by: string | null;
  link: string | null;
}

const KIND_LABEL: Record<string, string> = { team: 'Team', customer: 'Customer', quote: 'Quote', order: 'Order', status: 'Order', note: 'Order', request: 'Request', replication: 'Replication' };

export default function RepDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [rep, setRep] = useState<Rep | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [logReady, setLogReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/reps/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not load this rep.');
    } else {
      setRep(data.rep);
      setStats(data.stats);
      setCustomers(data.customers);
      setOrders(data.orders);
      setActivity(data.activity);
      setLogReady(data.log_ready !== false);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="py-20 text-center text-slate-400"><Loader2 className="animate-spin inline" size={20} /></div>;
  }
  if (!rep || !stats) {
    return (
      <div className="space-y-4">
        <Link href="/admin/team" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2"><ArrowLeft size={16} />Back to team</Link>
        <p className="text-sm text-red-600">{error || 'Rep not found.'}</p>
      </div>
    );
  }

  const cards = [
    { label: 'Customers assigned', value: stats.customers, icon: Users, color: 'text-rivix' },
    { label: 'Orders completed', value: stats.orders_completed, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Orders in progress', value: stats.orders_in_progress, icon: Truck, color: 'text-amber-600' },
    { label: 'Document requests', value: stats.requests, icon: FileText, color: 'text-slate-700' },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <Link href="/admin/team" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2">
        <ArrowLeft size={16} />Back to team
      </Link>

      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900">{rep.name}</h1>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${rep.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {rep.active ? 'Active' : 'Disabled'}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-rivix/40 hover:text-rivix transition-colors">
            <Pencil size={14} /> Edit rep
          </button>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          {[rep.title, rep.rep_code, `Added ${formatDate(rep.created_at)}`].filter(Boolean).join(' · ')}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-sm text-slate-600">
          <span className="flex items-center gap-1.5"><Mail size={14} className="text-slate-400" />{rep.email}</span>
          {rep.phone && <span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" />{rep.phone}</span>}
          {rep.territory && <span className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" />{rep.territory}</span>}
          <span className={rep.has_login ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{rep.has_login ? 'Has login' : 'No login yet'}</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">Use Edit rep to change these details.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="p-3 rounded-xl inline-block mb-4 bg-slate-50">
              <c.icon className={`${c.color} w-6 h-6`} />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{c.label}</p>
            <p className="text-2xl font-extrabold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-8 py-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Customers ({customers.length})</h3>
        </div>
        {customers.length === 0 ? (
          <p className="px-8 py-10 text-center text-sm text-slate-400">No customers assigned.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[720px]">
              <thead className="bg-slate-50/50">
                <tr>
                  {['Company', 'Code', 'Email', 'Client since', 'Assigned to this rep'].map((h) => (
                    <th key={h} className="px-4 sm:px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 sm:px-8 py-4 text-sm font-bold text-slate-900"><Link href={`/admin/clients/${c.id}`} className="hover:text-rivix">{c.company_name}</Link></td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600">{c.customer_code || '—'}</td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600">{c.contact_email || '—'}</td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600">{formatDate(c.created_at)}</td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600 whitespace-nowrap" title={c.assigned_exact ? undefined : 'Assigned before the history log existed: this is the date the customer was added'}>
                      {formatDate(c.assigned_at)}{!c.assigned_exact && <span className="text-slate-400"> (approx.)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-8 py-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Recent orders ({stats.orders_total} total)</h3>
        </div>
        {orders.length === 0 ? (
          <p className="px-8 py-10 text-center text-sm text-slate-400">No orders credited to this rep yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead className="bg-slate-50/50">
                <tr>
                  {['Order #', 'Customer', 'Product', 'Created', 'Status'].map((h) => (
                    <th key={h} className="px-4 sm:px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 sm:px-8 py-4 text-sm font-bold text-slate-900 whitespace-nowrap"><Link href={`/admin/orders/${o.id}`} className="hover:text-rivix">{o.batch_number}</Link></td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600">{o.customers?.company_name || '—'}</td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600">{o.product_name} <span className="text-slate-400">× {o.quantity}</span></td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600">{formatDate(o.created_at)}</td>
                    <td className="px-4 sm:px-8 py-4"><OrderStatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-8 py-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Activity</h3>
          <p className="text-xs text-slate-400 mt-1">Everything that happened on this rep&apos;s account and work, with the date and who did it. Newest first.</p>
        </div>
        {activity.length === 0 ? (
          <p className="px-8 py-10 text-center text-sm text-slate-400">{logReady ? 'No activity yet.' : 'The history log is not set up on this database yet (run dev-patch-rep-activity.sql).'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activity.map((a, i) => (
              <li key={`${a.at}-${i}`} className="px-5 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
                <span className="text-xs text-slate-400 sm:w-44 flex-shrink-0">{formatDateTime(a.at)}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 sm:w-24 flex-shrink-0">{KIND_LABEL[a.kind] || 'Activity'}</span>
                <div className="min-w-0 flex-1">
                  {a.link ? (
                    <Link href={a.link} className="text-sm text-slate-700 hover:text-rivix">{a.label}</Link>
                  ) : (
                    <span className="text-sm text-slate-700">{a.label}</span>
                  )}
                  {a.by && <p className="text-xs text-slate-400 mt-0.5">by {a.by}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <RepEditModal
          rep={{ ...rep, customer_count: stats.customers }}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setToast({ text: 'Rep details saved.', type: 'success' }); load(); }}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
