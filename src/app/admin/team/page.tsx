'use client';

import { useEffect, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';
import { UserPlus, Mail, Phone, Loader2, AlertCircle, Pencil, Trash2, KeyRound, X, Check } from 'lucide-react';
import CredentialsCard, { NewCredentials } from '@/components/CredentialsCard';

interface Rep {
  id: string;
  rep_code?: string | null;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  active: boolean;
  customer_count: number;
  has_login: boolean;
}

const emptyForm = { name: '', title: '', email: '', phone: '', active: true, create_login: true };

export default function TeamManagement() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<NewCredentials | null>(null);
  const [keyBusyId, setKeyBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'deactivate' | 'reset'; rep: Rep } | null>(null);
  const [confirming, setConfirming] = useState(false);

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
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setCredentials(null);
    setShowForm(true);
  };

  const openEdit = (rep: Rep) => {
    setEditingId(rep.id);
    setForm({ name: rep.name, title: rep.title || '', email: rep.email, phone: rep.phone || '', active: rep.active, create_login: false });
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(editingId ? `/api/admin/reps/${editingId}` : '/api/admin/reps', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
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

  const editingHasLogin = !!editingId && !!reps.find((r) => r.id === editingId)?.has_login;

  const inputClass =
    'w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';

  return (
    <div className="space-y-8 max-w-5xl">
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
            <h3 className="font-bold text-slate-900">{editingId ? 'Edit rep' : 'New rep'}</h3>
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
                disabled={editingHasLogin}
                className={`${inputClass} ${editingHasLogin ? 'opacity-60' : ''}`}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="tyler@rivix.ca"
              />
              {editingHasLogin && <p className="text-xs text-slate-400 px-1">This is their login, so it can&apos;t be changed.</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Phone</label>
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(403) 555-0100" />
            </div>
            {!editingId && (
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
            )}
            {editingId && (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Status</label>
                <select
                  className={inputClass}
                  value={form.active ? 'active' : 'disabled'}
                  onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}
                >
                  <option value="active">Active — can be assigned to customers</option>
                  <option value="disabled">Disabled — can't be assigned, and can't sign in</option>
                </select>
                {!form.active && (reps.find((r) => r.id === editingId)?.customer_count ?? 0) > 0 && (
                  <p className="text-xs text-amber-600 px-1">
                    This rep still has {reps.find((r) => r.id === editingId)?.customer_count} customer(s). They&apos;ll keep showing this rep until you reassign them.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              disabled={saving}
              className="bg-slate-950 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              {editingId ? 'Save changes' : 'Add rep'}
            </button>
            <button type="button" onClick={closeForm} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
        </Modal>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Rep</th>
              <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Contact</th>
              <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Customers</th>
              <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-4 sm:px-8 py-5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={5} className="px-8 py-10 text-center text-slate-400"><Loader2 className="animate-spin inline" size={18} /></td></tr>
            )}
            {!loading && reps.length === 0 && (
              <tr><td colSpan={5} className="px-8 py-10 text-center text-sm text-slate-400">No reps yet. Add your first one above.</td></tr>
            )}
            {reps.map((rep) => (
              <tr key={rep.id} className={rep.active ? '' : 'opacity-60'}>
                <td className="px-4 sm:px-8 py-5">
                  <p className="font-bold text-slate-900">{rep.name}</p>
                  {rep.title && <p className="text-xs text-slate-400">{rep.title}</p>}
                  {rep.rep_code && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{rep.rep_code}</p>}
                </td>
                <td className="px-4 sm:px-8 py-5 text-xs text-slate-500 space-y-1">
                  <p className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400" />{rep.email}</p>
                  {rep.phone && <p className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" />{rep.phone}</p>}
                  <p className={rep.has_login ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                    {rep.has_login ? 'Has login' : 'No login yet'}
                  </p>
                </td>
                <td className="px-4 sm:px-8 py-5 text-sm font-bold text-slate-600">{rep.customer_count}</td>
                <td className="px-4 sm:px-8 py-5">
                  <button
                    onClick={() => toggleActive(rep)}
                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                      rep.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {rep.active ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="px-4 sm:px-8 py-5 text-right whitespace-nowrap">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
