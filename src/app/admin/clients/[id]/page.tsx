'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, Check, KeyRound, Trash2, Ban, RotateCcw } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import CredentialsCard, { NewCredentials } from '@/components/CredentialsCard';
import { formatDate, formatDateTime } from '@/lib/format';
import { FIELD_LABELS, type RequestField } from '@/lib/account-fields';

interface Rep { id: string; name: string; active: boolean }
interface Customer {
  id: string;
  customer_code: string;
  company_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_name: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  rep_id: string | null;
  created_at: string;
  disabled: boolean;
}
interface ChangeRequest {
  id: string; field: RequestField; old_value: string | null; new_value: string; status: 'pending' | 'approved' | 'rejected';
  created_at: string; decided_at: string | null; decided_by: string | null; decision_note: string | null;
}
interface Order {
  id: string;
  batch_number: string;
  product_name: string;
  quantity: number;
  status: string;
  order_date: string | null;
  ship_date: string | null;
}

export default function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [deciding, setDeciding] = useState<string | null>(null);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({ company_name: '', contact_name: '', contact_phone: '', rep_id: '' });
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<NewCredentials | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'disable' | 'reset' | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = async () => {
    const [cRes, rRes] = await Promise.all([fetch(`/api/admin/customers/${id}`), fetch('/api/admin/reps')]);
    const cData = await cRes.json();
    if (!cRes.ok) {
      setError(cData.error || 'Could not load this client.');
      setLoading(false);
      return;
    }
    setCustomer(cData.customer);
    setOrders(cData.orders);
    setChangeRequests(cData.changeRequests || []);
    setForm({
      company_name: cData.customer.company_name,
      contact_name: cData.customer.contact_name || '',
      contact_phone: cData.customer.contact_phone || '',
      rep_id: cData.customer.rep_id || '',
    });
    if (rRes.ok) setReps((await rRes.json()).reps);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await patch({ company_name: form.company_name, contact_name: form.contact_name, contact_phone: form.contact_phone, rep_id: form.rep_id || null });
      setNotice('Changes saved.');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  const runConfirmed = async () => {
    if (!customer) return;
    setConfirming(true);
    setError(null);
    setNotice(null);
    try {
      if (confirm === 'disable') {
        await patch({ active: false });
        await load();
      } else if (confirm === 'reset') {
        const res = await fetch(`/api/admin/customers/${id}/login`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not reset the password.');
        setCredentials({
          name: customer.company_name,
          email: data.credentials.email,
          password: data.credentials.password,
          phone: customer.contact_phone || '',
          kind: 'customer',
          reset: true,
        });
      } else if (confirm === 'delete') {
        const res = await fetch(`/api/admin/customers/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Could not delete the client.');
        router.push('/admin/clients');
        return;
      }
    } catch (err: any) {
      setError(err.message);
    }
    setConfirming(false);
    setConfirm(null);
  };

  // Approve or reject one account change request from the customer.
  const decide = async (r: ChangeRequest, decision: 'approve' | 'reject') => {
    setDeciding(r.id); setError(null); setNotice(null);
    const res = await fetch(`/api/admin/account-requests/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, note: decision === 'reject' ? rejectNotes[r.id] || '' : '' }),
    });
    const data = await res.json().catch(() => ({}));
    setDeciding(null);
    if (!res.ok) { setError(data.error || 'Could not save the decision.'); return; }
    setNotice(decision === 'approve' ? `${FIELD_LABELS[r.field]} change approved and applied.` : `${FIELD_LABELS[r.field]} change rejected.`);
    if (data.emailWarning) setError(data.emailWarning); // the decision is saved; this only says an email was not sent
    await load();
  };

  const enable = async () => {
    setError(null);
    try {
      await patch({ active: true });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const inputClass =
    'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';
  const labelClass = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

  if (loading) {
    return <div className="py-20 text-center text-slate-400"><Loader2 className="animate-spin inline" size={20} /></div>;
  }
  if (!customer) {
    return (
      <div className="space-y-4">
        <Link href="/admin/clients" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2"><ArrowLeft size={16} />Back to clients</Link>
        <p className="text-sm text-red-600">{error || 'Client not found.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <Link href="/admin/clients" className="text-sm font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-2">
        <ArrowLeft size={16} />Back to clients
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{customer.company_name}</h1>
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${customer.disabled ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>
              {customer.disabled ? 'Disabled' : 'Active'}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {customer.customer_code} · {customer.contact_email} · Created {formatDate(customer.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setConfirm('reset')} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:border-rivix hover:text-rivix flex items-center gap-2">
            <KeyRound size={15} />Reset password
          </button>
          {customer.disabled ? (
            <button onClick={enable} className="px-4 py-2 rounded-xl text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-2">
              <RotateCcw size={15} />Enable
            </button>
          ) : (
            <button onClick={() => setConfirm('disable')} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:border-rivix hover:text-rivix flex items-center gap-2">
              <Ban size={15} />Disable
            </button>
          )}
          <button
            onClick={() => setConfirm('delete')}
            disabled={orders.length > 0}
            title={orders.length > 0 ? 'Has orders — disable this client instead' : 'Delete client'}
            className="px-4 py-2 rounded-xl text-sm font-bold text-red-600 bg-white border border-red-100 hover:bg-red-50 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <Trash2 size={15} />Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {notice && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>}
      {credentials && <CredentialsCard credentials={credentials} onDismiss={() => setCredentials(null)} />}

      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-5">
        <h3 className="font-bold text-slate-900">Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Company name *</label>
            <input required className={inputClass} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Contact name</label>
            <input className={inputClass} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="The person RIVIX deals with" />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Phone (for WhatsApp)</label>
            <input className={inputClass} value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Login email</label>
            <input disabled className={`${inputClass} opacity-60`} value={customer.contact_email || ''} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Sales rep</label>
            <select className={inputClass} value={form.rep_id} onChange={(e) => setForm({ ...form, rep_id: e.target.value })}>
              <option value="">Admin (handled directly)</option>
              {reps
                .filter((r) => r.active || r.id === customer.rep_id)
                .map((r) => <option key={r.id} value={r.id}>{r.name}{r.active ? '' : ' (disabled)'}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className={labelClass}>Billing address</p>
            <p className="px-1 mt-1 text-slate-700 whitespace-pre-line">{customer.billing_address || '—'}</p>
          </div>
          <div>
            <p className={labelClass}>Shipping address</p>
            <p className="px-1 mt-1 text-slate-700 whitespace-pre-line">{customer.shipping_address || '—'}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 px-1">Login email and addresses change when you approve the customer&apos;s request below.</p>
        <button disabled={saving} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
          Save changes
        </button>
      </form>

      {changeRequests.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
          <h3 className="font-bold text-slate-900">
            Change requests
            {changeRequests.some((r) => r.status === 'pending') && (
              <span className="ml-2 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                {changeRequests.filter((r) => r.status === 'pending').length} pending
              </span>
            )}
          </h3>
          <div className="space-y-3">
            {changeRequests.map((r) => (
              <div key={r.id} className={`rounded-2xl border p-4 space-y-2 ${r.status === 'pending' ? 'border-amber-100 bg-amber-50/40' : 'border-slate-100'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{FIELD_LABELS[r.field] || r.field}</p>
                  <span className="text-[11px] text-slate-400">Asked {formatDateTime(r.created_at)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div><span className="text-[11px] text-slate-400">Now: </span><span className="text-slate-500 whitespace-pre-line">{r.old_value || '(empty)'}</span></div>
                  <div><span className="text-[11px] text-slate-400">Asked for: </span><span className="font-semibold text-slate-900 whitespace-pre-line">{r.new_value || '(empty)'}</span></div>
                </div>
                {r.status === 'pending' ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button onClick={() => decide(r, 'approve')} disabled={deciding === r.id} className="px-4 py-2 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-rivix disabled:opacity-50">Approve and apply</button>
                    <input
                      className="flex-1 min-w-[10rem] px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                      placeholder="Reason (optional, shown to the customer)"
                      value={rejectNotes[r.id] || ''}
                      onChange={(e) => setRejectNotes({ ...rejectNotes, [r.id]: e.target.value })}
                    />
                    <button onClick={() => decide(r, 'reject')} disabled={deciding === r.id} className="px-4 py-2 rounded-xl border border-red-100 bg-white text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-50">Reject</button>
                  </div>
                ) : (
                  <p className={`text-xs font-semibold ${r.status === 'approved' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {r.status === 'approved' ? 'Approved' : 'Rejected'}{r.decided_by ? ` by ${r.decided_by}` : ''}{r.decided_at ? `, ${formatDateTime(r.decided_at)}` : ''}
                    {r.decision_note ? ` (${r.decision_note})` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-8 py-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Orders ({orders.length})</h3>
        </div>
        {orders.length === 0 ? (
          <p className="px-8 py-10 text-center text-sm text-slate-400">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead className="bg-slate-50/50">
                <tr>
                  {['Batch', 'Product', 'Qty', 'Ordered', 'Ships', 'Status'].map((h) => (
                    <th key={h} className="px-4 sm:px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 sm:px-8 py-4 text-sm font-bold text-slate-900"><Link href={`/admin/orders/${o.id}`} className="hover:text-rivix">{o.batch_number}</Link></td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600">{o.product_name}</td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600">{o.quantity}</td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600">{formatDate(o.order_date)}</td>
                    <td className="px-4 sm:px-8 py-4 text-sm text-slate-600">{formatDate(o.ship_date)}</td>
                    <td className="px-4 sm:px-8 py-4 text-sm font-semibold text-slate-700">{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirm !== null}
        danger={confirm === 'delete'}
        loading={confirming}
        title={confirm === 'delete' ? `Delete ${customer.company_name}?` : confirm === 'reset' ? `New password for ${customer.company_name}?` : `Disable ${customer.company_name}?`}
        message={
          confirm === 'delete'
            ? "This permanently removes the client and their login. It can't be undone."
            : confirm === 'reset'
            ? "Their current password will stop working straight away. You'll get a new temporary password to send them."
            : 'They will no longer be able to sign in. Their orders and history are kept, and you can enable them again any time.'
        }
        confirmLabel={confirm === 'delete' ? 'Delete client' : confirm === 'reset' ? 'Generate new password' : 'Disable client'}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
