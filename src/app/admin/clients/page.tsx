'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Mail, Loader2, AlertCircle, X, Check, KeyRound, Trash2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import CredentialsCard, { NewCredentials } from '@/components/CredentialsCard';

interface Rep { id: string; name: string; active: boolean }
interface Customer {
  id: string;
  customer_code: string;
  company_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  rep_id: string | null;
  order_count: number;
  disabled: boolean;
}
const emptyForm = { company_name: '', email: '', phone: '', rep_id: '' };

export default function ClientDirectory() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<NewCredentials | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'disable' | 'reset'; customer: Customer } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [keyBusyId, setKeyBusyId] = useState<string | null>(null);

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
  };

  const load = async () => {
    const [cRes, rRes] = await Promise.all([fetch('/api/admin/customers'), fetch('/api/admin/reps')]);
    const [cData, rData] = await Promise.all([cRes.json(), rRes.json()]);
    if (!cRes.ok) setError(cData.error || 'Could not load clients.');
    else setCustomers(cData.customers);
    if (rRes.ok) setReps(rData.reps);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.customer_code.toLowerCase().includes(q) ||
        (c.contact_email || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || 'Could not create the client.');
      return;
    }
    setCredentials({
      email: data.credentials.email,
      password: data.credentials.password,
      name: form.company_name.trim(),
      phone: form.phone,
      kind: 'customer',
    });
    setShowForm(false);
    setForm(emptyForm);
    load();
  };

  const changeRep = async (customer: Customer, repId: string) => {
    const previous = customer.rep_id;
    setCustomers((list) => list.map((c) => (c.id === customer.id ? { ...c, rep_id: repId || null } : c)));
    const res = await fetch(`/api/admin/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rep_id: repId || null }),
    });
    if (!res.ok) {
      setCustomers((list) => list.map((c) => (c.id === customer.id ? { ...c, rep_id: previous } : c)));
      setError((await res.json()).error || 'Could not change the rep.');
    } else {
      load(); // refresh rep customer counts
    }
  };

  const setDisabled = async (c: Customer, disabled: boolean) => {
    const res = await fetch(`/api/admin/customers/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !disabled }),
    });
    if (res.ok) load();
    else setError((await res.json()).error || 'Could not update the client.');
  };

  const resetPassword = async (c: Customer) => {
    setKeyBusyId(c.id);
    setError(null);
    const res = await fetch(`/api/admin/customers/${c.id}/login`, { method: 'POST' });
    const data = await res.json();
    setKeyBusyId(null);
    if (!res.ok) {
      setError(data.error || 'Could not reset the password.');
      return;
    }
    setCredentials({
      name: c.company_name,
      email: data.credentials.email,
      password: data.credentials.password,
      phone: c.contact_phone || '',
      kind: 'customer',
      reset: true,
    });
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    setConfirming(true);
    setError(null);
    if (confirm.kind === 'reset') {
      await resetPassword(confirm.customer);
    } else if (confirm.kind === 'disable') {
      await setDisabled(confirm.customer, true);
    } else {
      const res = await fetch(`/api/admin/customers/${confirm.customer.id}`, { method: 'DELETE' });
      if (res.ok) load();
      else setError((await res.json()).error || 'Could not delete the client.');
    }
    setConfirming(false);
    setConfirm(null);
  };

  const inputClass =
    'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';
  const activeReps = reps.filter((r) => r.active);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Client Directory</h1>
          <p className="text-slate-500">Create customer accounts and assign each one a sales rep.</p>
        </div>
        {(
          <button
            onClick={() => { setShowForm(true); setError(null); setCredentials(null); }}
            className="bg-rivix text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Add New Client
          </button>
        )}
      </div>

      {error && !showForm && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {credentials && <CredentialsCard credentials={credentials} onDismiss={() => setCredentials(null)} />}

      {showForm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => !saving && closeForm()}
        >
        <form
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleCreate}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-5 sm:p-8 space-y-5 my-auto"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">New client</h3>
            <button type="button" onClick={closeForm} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Company name *</label>
              <input required className={inputClass} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Pacific Mining Co." />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Login email *</label>
              <input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ops@company.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Phone (for WhatsApp)</label>
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(403) 555-0100" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sales rep</label>
              <select className={inputClass} value={form.rep_id} onChange={(e) => setForm({ ...form, rep_id: e.target.value })}>
                <option value="">Unassigned</option>
                {activeReps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button disabled={saving} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Create account
            </button>
            <button type="button" onClick={closeForm} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="relative sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, code or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 focus:border-rivix outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[860px]">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Client</th>
                <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Contact</th>
                <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Sales rep</th>
                <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Orders</th>
                <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-4 sm:px-8 py-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={6} className="px-8 py-10 text-center text-slate-400"><Loader2 className="animate-spin inline" size={18} /></td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-10 text-center text-sm text-slate-400">
                    {customers.length === 0 ? 'No clients yet. Add your first one above.' : 'No clients match your search.'}
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className={`hover:bg-slate-50/30 transition-colors ${c.disabled ? 'opacity-60' : ''}`}>
                  <td className="px-4 sm:px-8 py-5">
                    <Link href={`/admin/clients/${c.id}`} className="font-bold text-slate-900 hover:text-rivix transition-colors">{c.company_name}</Link>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{c.customer_code}</p>
                  </td>
                  <td className="px-4 sm:px-8 py-5 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><Mail size={14} className="text-slate-400" />{c.contact_email}</p>
                    {c.contact_phone && <p className="text-xs text-slate-400 mt-1">{c.contact_phone}</p>}
                  </td>
                  <td className="px-4 sm:px-8 py-5">
                    <select
                      value={c.rep_id || ''}
                      onChange={(e) => changeRep(c, e.target.value)}
                      className="px-3 py-2 bg-slate-50 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-rivix/20"
                    >
                      <option value="">Unassigned</option>
                      {reps
                        .filter((r) => r.active || r.id === c.rep_id)
                        .map((r) => <option key={r.id} value={r.id}>{r.name}{r.active ? '' : ' (disabled)'}</option>)}
                    </select>
                  </td>
                  <td className="px-4 sm:px-8 py-5 text-sm font-bold text-slate-700">{c.order_count}</td>
                  <td className="px-4 sm:px-8 py-5">
                    <button
                      onClick={() => (c.disabled ? setDisabled(c, false) : setConfirm({ kind: 'disable', customer: c }))}
                      title={c.disabled ? 'Click to enable this client' : 'Click to disable this client'}
                      className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                        c.disabled ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {c.disabled ? 'Disabled' : 'Active'}
                    </button>
                  </td>
                  <td className="px-4 sm:px-8 py-5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setConfirm({ kind: 'reset', customer: c })}
                      disabled={keyBusyId === c.id}
                      title="Generate a new temporary password"
                      className="p-2 text-slate-400 hover:text-rivix transition-colors disabled:opacity-50"
                      aria-label={`Reset password for ${c.company_name}`}
                    >
                      {keyBusyId === c.id ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
                    </button>
                    <button
                      onClick={() => setConfirm({ kind: 'delete', customer: c })}
                      disabled={c.order_count > 0}
                      title={c.order_count > 0 ? 'Has orders — disable this client instead' : 'Delete client'}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                      aria-label={`Delete ${c.company_name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={confirm !== null}
        danger={confirm?.kind === 'delete'}
        loading={confirming}
        title={
          confirm?.kind === 'delete'
            ? `Delete ${confirm.customer.company_name}?`
            : confirm?.kind === 'reset'
            ? `New password for ${confirm.customer.company_name}?`
            : `Disable ${confirm?.customer.company_name}?`
        }
        message={
          confirm?.kind === 'delete'
            ? "This permanently removes the client and their login. It can't be undone."
            : confirm?.kind === 'reset'
            ? "Their current password will stop working straight away. You'll get a new temporary password to send them."
            : 'They will no longer be able to sign in. Their orders and history are kept, and you can enable them again any time.'
        }
        confirmLabel={confirm?.kind === 'delete' ? 'Delete client' : confirm?.kind === 'reset' ? 'Generate new password' : 'Disable client'}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
