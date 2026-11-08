'use client';

import { useEffect, useState } from 'react';
import { UserCircle, Lock, Eye, EyeOff, Loader2, Check, Clock, Send } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { FIELD_LABELS, REQUEST_FIELDS, type RequestField } from '@/lib/account-fields';
import { formatDate } from '@/lib/format';

interface Profile {
  company_name: string; customer_code: string; contact_name: string | null; contact_phone: string | null;
  contact_email: string | null; billing_address: string | null; shipping_address: string | null; login_email: string;
}
interface ChangeRequest {
  id: string; field: RequestField; old_value: string | null; new_value: string; status: 'pending' | 'approved' | 'rejected';
  created_at: string; decided_at: string | null; decision_note: string | null;
}

const labelCls = 'text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1';
const inputCls = 'w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all placeholder:text-slate-300 font-medium';

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [email, setEmail] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Contact name and phone: saved straight away.
  const [direct, setDirect] = useState({ contact_name: '', contact_phone: '' });
  const [savingDirect, setSavingDirect] = useState(false);
  const [directMsg, setDirectMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Company name, login email, addresses: sent to RIVIX as a request.
  const [editing, setEditing] = useState<RequestField | null>(null);
  const [reqValue, setReqValue] = useState('');
  const [sendingReq, setSendingReq] = useState(false);
  const [reqMsg, setReqMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = async () => {
    const res = await fetch('/api/portal/account');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setLoadError(data.error || 'Could not load your account.'); setLoadingProfile(false); return; }
    setProfile(data.profile);
    setRequests(data.requests || []);
    setEmail(data.profile.login_email || '');
    setDirect({ contact_name: data.profile.contact_name || '', contact_phone: data.profile.contact_phone || '' });
    setLoadingProfile(false);
  };
  useEffect(() => { load(); }, []);

  const saveDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDirect(true); setDirectMsg(null);
    const res = await fetch('/api/portal/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(direct) });
    const data = await res.json().catch(() => ({}));
    setSavingDirect(false);
    if (!res.ok) { setDirectMsg({ ok: false, text: data.error || 'Could not save.' }); return; }
    setDirectMsg({ ok: true, text: 'Saved.' });
    await load();
  };

  const currentValue = (f: RequestField) =>
    !profile ? '' : f === 'login_email' ? profile.login_email : (profile[f] as string | null) || '';
  // The latest request for a field (the list is newest first).
  const latest = (f: RequestField) => requests.find((r) => r.field === f);

  const startRequest = (f: RequestField) => { setEditing(f); setReqValue(currentValue(f)); setReqMsg(null); };
  const sendRequest = async () => {
    if (!editing) return;
    setSendingReq(true); setReqMsg(null);
    const res = await fetch('/api/portal/account/change-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: { [editing]: reqValue } }) });
    const data = await res.json().catch(() => ({}));
    setSendingReq(false);
    if (!res.ok) { setReqMsg({ ok: false, text: data.error || 'Could not send the request.' }); return; }
    setEditing(null);
    setReqMsg({ ok: true, text: data.emailWarning || 'Request sent. RIVIX will review it, and you will see the result here.' });
    await load();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      // Confirm the current password is actually correct before allowing
      // a change — updateUser() alone would let anyone with an open
      // session change the password with zero friction.
      const { error: reauthError } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) {
        setError('Current password is incorrect.');
        return;
      }

      const { error: updateError } = await supabaseBrowser.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account</h1>
        <p className="text-slate-500">View your profile and manage your password.</p>
      </div>

      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rivix/5 text-rivix">
            <UserCircle size={24} />
          </div>
          <h3 className="font-bold text-slate-900">Profile</h3>
        </div>

        {loadingProfile ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : loadError || !profile ? (
          <p className="text-sm text-red-500">{loadError || 'Could not load your account.'}</p>
        ) : (
          <>
            <form onSubmit={saveDirect} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelCls} htmlFor="contact_name">Contact name</label>
                  <input id="contact_name" className={inputCls} maxLength={120} value={direct.contact_name} onChange={(e) => setDirect({ ...direct, contact_name: e.target.value })} placeholder="Who RIVIX should ask for" />
                </div>
                <div className="space-y-1">
                  <label className={labelCls} htmlFor="contact_phone">Phone</label>
                  <input id="contact_phone" type="tel" className={inputCls} maxLength={40} value={direct.contact_phone} onChange={(e) => setDirect({ ...direct, contact_phone: e.target.value })} placeholder="+1 403 555 0100" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button disabled={savingDirect} className="bg-slate-950 text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2 disabled:opacity-60">
                  {savingDirect ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}Save
                </button>
                {directMsg && <p className={`text-xs font-semibold ${directMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{directMsg.text}</p>}
              </div>
            </form>

            <div className="border-t border-slate-100 pt-6 space-y-5">
              <div>
                <p className={labelCls}>Customer code</p>
                <p className="text-sm font-semibold text-slate-700">{profile.customer_code || '—'}</p>
              </div>
              {REQUEST_FIELDS.map((f) => {
                const last = latest(f);
                const pending = last?.status === 'pending';
                const multi = f === 'billing_address' || f === 'shipping_address';
                return (
                  <div key={f} className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={labelCls}>{FIELD_LABELS[f]}</p>
                        <p className="text-sm font-semibold text-slate-700 whitespace-pre-line break-words">{currentValue(f) || '—'}</p>
                      </div>
                      {!pending && editing !== f && (
                        <button type="button" onClick={() => startRequest(f)} className="text-xs font-bold text-slate-500 hover:text-rivix">Request a change</button>
                      )}
                    </div>
                    {pending && (
                      <p className="inline-flex items-start gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        <Clock size={14} className="shrink-0 mt-px" />
                        <span>Pending: you asked to change this to <span className="whitespace-pre-line">&quot;{last!.new_value || '(empty)'}&quot;</span> on {formatDate(last!.created_at)}. RIVIX will review it.</span>
                      </p>
                    )}
                    {!pending && last && editing !== f && (
                      <p className={`text-[11px] font-semibold ${last.status === 'approved' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {last.status === 'approved' ? 'Your last change was approved' : 'Your last change request was not approved'}
                        {last.decided_at ? ` (${formatDate(last.decided_at)})` : ''}{last.status === 'rejected' && last.decision_note ? `: ${last.decision_note}` : '.'}
                      </p>
                    )}
                    {editing === f && (
                      <div className="space-y-2">
                        {multi ? (
                          <textarea className={inputCls} rows={3} maxLength={500} value={reqValue} onChange={(e) => setReqValue(e.target.value)} placeholder="Street, city, province, postal code" />
                        ) : (
                          <input className={inputCls} type={f === 'login_email' ? 'email' : 'text'} maxLength={f === 'login_email' ? 254 : 200} value={reqValue} onChange={(e) => setReqValue(e.target.value)} />
                        )}
                        {f === 'login_email' && <p className="text-[11px] text-slate-400">Once RIVIX approves it, you sign in with the new email. We will also tell your current address.</p>}
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={sendRequest} disabled={sendingReq} className="bg-slate-950 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-rivix transition-all flex items-center gap-1.5 disabled:opacity-60">
                            {sendingReq ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}Send to RIVIX
                          </button>
                          <button type="button" onClick={() => { setEditing(null); setReqMsg(null); }} className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {reqMsg && <p className={`text-xs font-semibold ${reqMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{reqMsg.text}</p>}
              <p className="text-xs text-slate-400">Company name, login email and addresses are changed by RIVIX. Send a request and you will see it here as Pending until it is reviewed.</p>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rivix/5 text-rivix">
            <Lock size={24} />
          </div>
          <h3 className="font-bold text-slate-900">Change Password</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all placeholder:text-slate-300 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">New Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showNew ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all placeholder:text-slate-300 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
          {success && (
            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <Check size={14} /> Password updated successfully.
            </p>
          )}

          <button
            disabled={saving}
            className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-rivix transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
