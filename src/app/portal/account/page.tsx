'use client';

import { useEffect, useState } from 'react';
import { UserCircle, Lock, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { getCurrentCustomer, CustomerData } from '@/lib/storage';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function AccountPage() {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [email, setEmail] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: { user } }, myCustomer] = await Promise.all([
        supabaseBrowser.auth.getUser(),
        getCurrentCustomer(),
      ]);
      setEmail(user?.email || '');
      setCustomer(myCustomer);
      setLoadingProfile(false);
    };
    load();
  }, []);

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

      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rivix/5 text-rivix">
            <UserCircle size={24} />
          </div>
          <h3 className="font-bold text-slate-900">Profile</h3>
        </div>

        {loadingProfile ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Company Name</p>
              <p className="text-sm font-semibold text-slate-700">{customer?.company_name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Customer Code</p>
              <p className="text-sm font-semibold text-slate-700">{customer?.customer_code || '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Login Email</p>
              <p className="text-sm font-semibold text-slate-700">{email}</p>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-400">
          Company name and account details are managed by RIVIX or your sales representative — contact them if anything needs to change.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
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
