'use client';

import { useEffect, useState } from 'react';
import { Lock, Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabaseBrowser as supabase } from '@/lib/supabase-browser';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Clicking the emailed reset link logs the user into a temporary
    // recovery session — that's what lets updateUser() work below.
    // If someone just navigates here directly with no valid link, there's
    // no session and we should say so instead of showing a working form.
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setValidSession(!!session);
      setCheckingSession(false);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true);
        setCheckingSession(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      // Re-check right before submitting — the recovery session can expire
      // between loading this page and clicking the button. Catching this
      // here means the user sees "your link expired, request a new one"
      // instead of a raw SDK error like "Auth session missing!".
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setValidSession(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (error.name === 'AuthSessionMissingError') {
          setValidSession(false);
          return;
        }
        throw error;
      }
      setSuccess(true);
      setTimeout(() => router.push('/portal'), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mb-8 flex justify-center">
            <Image
              src="/logo.png"
              alt="RIVIX Logo"
              width={180}
              height={60}
              className="h-auto w-auto"
              priority
            />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">
            SET NEW <span className="text-rivix">PASSWORD</span>
          </h1>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 space-y-6">
          {checkingSession ? (
            <p className="text-center text-sm text-slate-400 py-8">Checking your link...</p>
          ) : !validSession ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <AlertCircle size={28} />
              </div>
              <div>
                <p className="font-bold text-slate-900">This link isn&apos;t valid</p>
                <p className="text-sm text-slate-500 mt-1">
                  It may have expired, or already been used. Request a new one below.
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="inline-block bg-slate-950 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-rivix transition-all"
              >
                Request New Link
              </Link>
            </div>
          ) : success ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={28} />
              </div>
              <p className="font-bold text-slate-900">Password updated — taking you to the portal...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="At least 8 characters"
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all placeholder:text-slate-300 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl px-4 py-3">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                disabled={loading}
                className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold hover:bg-rivix transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
