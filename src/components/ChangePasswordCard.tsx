'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';

// Self-service password change: re-checks the current password first, so an
// open session alone can't silently change it.
export default function ChangePasswordCard({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      const { error: reauth } = await supabaseBrowser.auth.signInWithPassword({ email, password: currentPassword });
      if (reauth) {
        setError('Current password is incorrect.');
        return;
      }
      const { error: upd } = await supabaseBrowser.auth.updateUser({ password: newPassword });
      if (upd) throw upd;
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full pl-12 pr-12 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all placeholder:text-slate-300 font-medium';
  const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-rivix/5 text-rivix"><Lock size={24} /></div>
        <h3 className="font-bold text-slate-900">Change Password</h3>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label className={label}>Current Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type={showCurrent ? 'text' : 'password'} required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className={field} />
            <button type="button" onClick={() => setShowCurrent((v) => !v)} aria-label={showCurrent ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className={label}>New Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type={showNew ? 'text' : 'password'} required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" className={field} />
            <button type="button" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
        {success && <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5"><Check size={14} /> Password updated successfully.</p>}
        <button disabled={saving} className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-rivix transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
