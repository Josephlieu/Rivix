'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';
import { UserPlus, Mail, Phone, Loader2, AlertCircle, Pencil, Trash2, KeyRound, X, Check, Search, Eye } from 'lucide-react';
import CredentialsCard, { NewCredentials } from '@/components/CredentialsCard';
import RepEditModal from '@/components/RepEditModal';
import AdminAccountsCard from '@/components/AdminAccountsCard';
import RepInvitesCard from '@/components/RepInvitesCard';

interface Rep {
  id: string;
  rep_code?: string | null;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  territory?: string | null;
  active: boolean;
  customer_count: number;
  orders_completed: number;
  request_count: number;
  has_login: boolean;
  created_at?: string;
}

const emptyForm = { name: '', title: '', email: '', phone: '', territory: '', active: true, create_login: true };

export default function TeamManagement() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingRep, setEditingRep] = useState<Rep | null>(null); // the rep open in the shared Edit dialog
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<NewCredentials | null>(null);
  const [keyBusyId, setKeyBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'deactivate' | 'reset'; rep: Rep } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [loginFilter, setLoginFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'with' | 'none'>('all');

  const load = async () => {
    const res = await fetch('/api/admin/reps');
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not load reps.');
    } else {
      setReps(data.reps);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setError(null);
    setCredentials(null);
    setShowForm(true);
  };

  const openEdit = (rep: Rep) => { setError(null); setEditingRep(rep); };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch('/api/admin/reps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Leave territory out until the database has the column (dev-patch-rep-territory.sql).
      body: JSON.stringify(territorySupported ? form : { ...form, territory: undefined }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong.');
      return;
    }
    if (data.credentials) {
      setCredentials({
        name: form.name.trim(),
        email: data.credentials.email,
        password: data.credentials.password,
        phone: form.phone,
        kind: 'rep',
      });
    } else if (data.loginError) {
      setError(`Rep added, but the login couldn't be created: ${data.loginError}`);
    }
    closeForm();
    load();
  };

  const giveLogin = (rep: Rep) => {
    // Resetting an existing login locks out the old password, so confirm first
    if (rep.has_login) setConfirm({ kind: 'reset', rep });
    else runLogin(rep);
  };

  const runLogin = async (rep: Rep) => {
    setKeyBusyId(rep.id);
    setError(null);
    const res = await fetch(`/api/admin/reps/${rep.id}/login`, { method: 'POST' });
    const data = await res.json();
    setKeyBusyId(null);
    if (!res.ok) {
      setError(data.error || 'Could not create the login.');
      return;
    }
    setCredentials({
      name: rep.name,
      email: data.credentials.email,
      password: data.credentials.password,
      phone: rep.phone || '',
      kind: 'rep',
      reset: data.reset,
    });
    load();
  };

  const setActive = async (rep: Rep, active: boolean) => {
    const res = await fetch(`/api/admin/reps/${rep.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (res.ok) load();
    else setError((await res.json()).error || 'Could not update the rep.');
  };

  const toggleActive = (rep: Rep) => {
    // Only warn when turning a rep OFF while they still have customers
    if (rep.active && rep.customer_count > 0) setConfirm({ kind: 'deactivate', rep });
    else setActive(rep, !rep.active);
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    setConfirming(true);
    setError(null);
    if (confirm.kind === 'reset') {
      await runLogin(confirm.rep);
    } else if (confirm.kind === 'delete') {
      const res = await fetch(`/api/admin/reps/${confirm.rep.id}`, { method: 'DELETE' });
      if (res.ok) load();
      else setError((await res.json()).error || 'Could not delete the rep.');
    } else {
      await setActive(confirm.rep, false);
    }
    setConfirming(false);
    setConfirm(null);
  };

  // The territory column only exists once dev-patch-rep-territory.sql has been run.
  const territorySupported = reps.some((r) => 'territory' in r);

  // Newest first (the API returns oldest first because the client pages use that order for their rep pickers).
  const visibleReps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reps
      .filter((r) => {
        if (statusFilter === 'active' && !r.active) return false;
        if (statusFilter === 'disabled' && r.active) return false;
        if (loginFilter === 'yes' && !r.has_login) return false;
        if (loginFilter === 'no' && r.has_login) return false;
        if (customerFilter === 'with' && r.customer_count === 0) return false;
        if (customerFilter === 'none' && r.customer_count > 0) return false;
        if (!q) return true;
        return [r.name, r.title, r.email, r.phone, r.rep_code, r.territory].some((v) => (v || '').toLowerCase().includes(q));
      })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [reps, search, statusFilter, loginFilter, customerFilter]);

  const filtersActive = search.trim() !== '' || statusFilter !== 'all' || loginFilter !== 'all' || customerFilter !== 'all';
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setLoginFilter('all'); setCustomerFilter('all'); };

  const selectClass =
    'px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-rivix/20';

  const inputClass =
    'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team & Reps</h1>
          <p className="text-slate-500">Add your sales reps, then assign each customer to one from the Clients page.</p>
        </div>
        {(
          <button
            onClick={openAdd}
            className="bg-rivix text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={16} />
            Add Rep
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
        <Modal onClose={closeForm} busy={saving}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">New rep</h3>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full name *</label>
              <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tyler Reid" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Title</label>
              <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Account Manager" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email *</label>
              <input
                required
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="tyler@rivix.ca"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Phone</label>
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(403) 555-0100" />
            </div>
            {territorySupported && (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Province / territory</label>
                <input className={inputClass} value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} placeholder="Alberta — Calgary/Cochrane" />
              </div>
            )}
            <label className="sm:col-span-2 flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.create_login}
                  onChange={(e) => setForm({ ...form, create_login: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-[#c61213]"
                />
                <span className="text-sm text-slate-600">
                  <strong className="text-slate-900">Also create a login</strong>{' '}so this rep can sign in.
                  You&apos;ll get a temporary password to send them.
                </span>
              </label>
          </div>
          <div className="flex gap-3">
            <button
              disabled={saving}
              className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Add rep
            </button>
            <button type="button" onClick={closeForm} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
        </Modal>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] sm:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search name, email, phone, territory or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 focus:border-rivix outline-none transition-all w-full sm:w-80"
            aria-label="Search reps"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={selectClass} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <select value={loginFilter} onChange={(e) => setLoginFilter(e.target.value as typeof loginFilter)} className={selectClass} aria-label="Filter by login">
          <option value="all">Any login</option>
          <option value="yes">Has login</option>
          <option value="no">No login yet</option>
        </select>
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value as typeof customerFilter)} className={selectClass} aria-label="Filter by customers">
          <option value="all">Any customers</option>
          <option value="with">Has customers</option>
          <option value="none">No customers</option>
        </select>
        {filtersActive && (
          <button onClick={clearFilters} className="text-xs font-bold text-rivix hover:underline">Clear filters</button>
        )}
        {!loading && (
          <span className="text-xs text-slate-400 sm:ml-auto">
            {filtersActive ? `Showing ${visibleReps.length} of ${reps.length}` : `${reps.length} rep${reps.length === 1 ? '' : 's'}`}
          </span>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-left min-w-[1100px]">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-4 sm:px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Sales rep</th>
              <th className="px-4 sm:px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Email &amp; phone</th>
              <th className="px-4 sm:px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Province / territory</th>
              <th className="px-4 sm:px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest" title="Delivered orders credited to this rep">Orders completed</th>
              <th className="px-4 sm:px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest" title="Document requests linked to this rep">Customer requests</th>
              <th className="px-4 sm:px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest" title="Quotes aren't in the portal yet">Quotes created</th>
              <th className="px-4 sm:px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest" title="Customers currently assigned">Customers assigned</th>
              <th className="px-4 sm:px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-4 sm:px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={9} className="px-8 py-10 text-center text-slate-400"><Loader2 className="animate-spin inline" size={18} /></td></tr>
            )}
            {!loading && reps.length === 0 && (
              <tr><td colSpan={9} className="px-8 py-10 text-center text-sm text-slate-400">No reps yet. Add your first one above.</td></tr>
            )}
            {!loading && reps.length > 0 && visibleReps.length === 0 && (
              <tr><td colSpan={9} className="px-8 py-10 text-center text-sm text-slate-400">No reps match your search or filters.</td></tr>
            )}
            {visibleReps.map((rep) => (
              <tr key={rep.id} className={rep.active ? '' : 'opacity-60'}>
                <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                  <Link href={`/admin/team/${rep.id}`} className="font-bold text-slate-900 hover:text-rivix">{rep.name}</Link>
                  {rep.title && <p className="text-xs text-slate-400">{rep.title}</p>}
                  {rep.rep_code && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{rep.rep_code}</p>}
                </td>
                <td className="px-4 sm:px-6 py-5 text-xs text-slate-500 space-y-1 whitespace-nowrap">
                  <p className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400" />{rep.email}</p>
                  {rep.phone && <p className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" />{rep.phone}</p>}
                </td>
                <td className="px-4 sm:px-6 py-5 text-xs text-slate-500">{rep.territory || '—'}</td>
                <td className="px-4 sm:px-6 py-5 text-sm font-bold text-slate-600">{rep.orders_completed}</td>
                <td className="px-4 sm:px-6 py-5 text-sm font-bold text-slate-600">{rep.request_count}</td>
                <td className="px-4 sm:px-6 py-5 text-sm text-slate-300" title="Quotes aren't in the portal yet">—</td>
                <td className="px-4 sm:px-6 py-5 text-sm font-bold text-slate-600">{rep.customer_count}</td>
                <td className="px-4 sm:px-6 py-5">
                  <button
                    onClick={() => toggleActive(rep)}
                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                      rep.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {rep.active ? 'Active' : 'Disabled'}
                  </button>
                  {/* Only the exception is shown: most reps have a login. */}
                  {!rep.has_login && <p className="text-[10px] text-slate-400 mt-1.5 whitespace-nowrap">No login yet</p>}
                </td>
                <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                  <Link href={`/admin/team/${rep.id}`} title="View details and activity history" className="p-2 text-slate-400 hover:text-rivix transition-colors" aria-label={`View ${rep.name}`}>
                    <Eye size={16} />
                  </Link>
                  <button
                    onClick={() => giveLogin(rep)}
                    disabled={keyBusyId === rep.id}
                    title={rep.has_login ? 'Generate a new temporary password' : 'Create a login for this rep'}
                    className="p-2 text-slate-400 hover:text-rivix transition-colors disabled:opacity-50"
                    aria-label={rep.has_login ? `Reset password for ${rep.name}` : `Create login for ${rep.name}`}
                  >
                    {keyBusyId === rep.id ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
                  </button>
                  <button onClick={() => openEdit(rep)} className="p-2 text-slate-400 hover:text-rivix transition-colors" aria-label={`Edit ${rep.name}`}>
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setConfirm({ kind: 'delete', rep })}
                    disabled={rep.customer_count > 0}
                    title={rep.customer_count > 0 ? 'Has customers — reassign them or set the rep to Disabled instead' : 'Delete rep'}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                    aria-label={`Delete ${rep.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingRep && (
        <RepEditModal
          rep={editingRep}
          onClose={() => setEditingRep(null)}
          onSaved={() => { setEditingRep(null); load(); }}
        />
      )}

      <ConfirmModal
        open={confirm !== null}
        danger={confirm?.kind === 'delete'}
        loading={confirming}
        title={confirm?.kind === 'delete' ? `Delete ${confirm.rep.name}?` : confirm?.kind === 'reset' ? `New password for ${confirm.rep.name}?` : `Disable ${confirm?.rep.name}?`}
        message={
          confirm?.kind === 'delete'
            ? "This permanently removes the rep and can't be undone."
            : confirm?.kind === 'reset'
            ? "Their current password will stop working straight away. You'll get a new temporary password to send them."
            : `${confirm?.rep.name} still has ${confirm?.rep.customer_count} customer${confirm?.rep.customer_count === 1 ? '' : 's'}. They'll keep showing this rep until you reassign them, but the rep can no longer be assigned to anyone new.`
        }
        confirmLabel={confirm?.kind === 'delete' ? 'Delete rep' : confirm?.kind === 'reset' ? 'Generate new password' : 'Disable rep'}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />

      <RepInvitesCard />

      <AdminAccountsCard />
    </div>
  );
}
