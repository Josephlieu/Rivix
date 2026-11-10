'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { formatDateTime } from '@/lib/format';

interface AdminAccount { id: string; email: string; twoStep: boolean; lastSignIn: string | null; isYou: boolean }

// Admin accounts and their two-step sign-in (task 8). Another admin can reset a locked-out admin's authenticator:
// they are signed out, emailed, and set it up again at their next sign-in. Nobody can reset their own.
export default function AdminAccountsCard() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toReset, setToReset] = useState<AdminAccount | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch('/api/admin/admins');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || 'Could not load the admin accounts.');
    setAdmins(data.admins || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const reset = async () => {
    if (!toReset) return;
    setBusy(true); setError(null); setNotice(null);
    const res = await fetch(`/api/admin/admins/${toReset.id}/reset-mfa`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not reset the two-step sign-in.'); setToReset(null); return; }
    setNotice(`Two-step sign-in reset for ${toReset.email}.${data.signedOut ? ' They were signed out.' : ''} They set it up again at their next sign-in.`);
    if (data.emailWarning) setError(data.emailWarning); // the reset worked; this only says what did not
    setToReset(null);
    await load();
  };

  const without = admins.filter((a) => !a.twoStep).length;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4">
      <div>
        <h3 className="font-bold text-slate-900">Admins and two-step sign-in</h3>
        <p className="text-xs text-slate-500 mt-1">Every admin signs in with a password and a code from an authenticator app. Keep at least two admins with two-step set up, so one can always reset the other.</p>
      </div>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      {notice && <p className="text-xs font-semibold text-emerald-700">{notice}</p>}
      {loading ? (
        <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="animate-spin" size={14} />Loading…</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {admins.map((a) => (
            <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 break-all">{a.email}{a.isYou ? <span className="text-slate-400 font-normal"> (you)</span> : null}</p>
                <p className="text-[11px] text-slate-400">{a.lastSignIn ? `Last sign-in ${formatDateTime(a.lastSignIn)}` : 'Never signed in'}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {a.twoStep
                  ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><ShieldCheck size={14} />Two-step on</span>
                  : <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"><ShieldAlert size={14} />Not set up yet</span>}
                {!a.isYou && a.twoStep && (
                  <button onClick={() => setToReset(a)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:border-red-200 hover:text-red-600">Reset two-step</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && admins.length - without < 2 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">Fewer than two admins have two-step set up. If the only one loses their phone, nobody here can reset it (the Supabase project owner would have to).</p>
      )}
      <ConfirmModal
        open={toReset !== null}
        danger
        loading={busy}
        title={`Reset two-step sign-in for ${toReset?.email}?`}
        message="Their authenticator is removed and they are signed out everywhere. They get an email, every admin gets an alert naming you, and they set up a new authenticator at their next sign-in. Only do this when they have asked for it."
        confirmLabel="Reset two-step"
        onConfirm={reset}
        onCancel={() => setToReset(null)}
      />
    </div>
  );
}
