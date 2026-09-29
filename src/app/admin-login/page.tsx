'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabaseBrowser as supabase } from '@/lib/supabase-browser';
import { isAdminUser } from '@/lib/admin-auth';

function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next') || '/admin';
  // Only ever send the admin to a path inside /admin
  const next = rawNext === '/admin' || rawNext.startsWith('/admin/') ? rawNext : '/admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : signInError.message
      );
      setLoading(false);
      return;
    }

    if (!isAdminUser(data.user)) {
      // A valid account, but not an admin — don't leave them signed in here.
      await supabase.auth.signOut();
      setError('This account does not have admin access.');
      setLoading(false);
      return;
    }

    setRedirecting(true);
    router.push(next);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      {redirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-rivix/10 flex items-center justify-center text-rivix">
                <ShieldCheck size={28} />
              </div>
              <Loader2 className="animate-spin absolute -bottom-1 -right-1 text-rivix bg-white rounded-full p-0.5" size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-900">Login successful</p>
              <p className="text-sm text-slate-500 mt-1">Opening the admin panel...</p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="RIVIX Logo" width={180} height={60} className="h-auto w-auto" priority />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">
            ADMIN <span className="text-rivix">ACCESS</span>
          </h1>
          <p className="text-slate-500 font-medium mt-2">Authorized personnel only</p>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="admin@rivix.ca"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all placeholder:text-slate-300 font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                <Link href="/forgot-password" className="text-[10px] font-bold text-rivix hover:text-rivix-dark transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
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
              className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold hover:bg-rivix transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" /> : (<>Sign In as Admin <ArrowRight size={18} /></>)}
            </button>
          </form>

          <div className="text-center pt-4 border-t border-slate-50">
            <Link href="/login" className="text-xs font-bold text-slate-400 hover:text-rivix transition-colors">
              Customer? Go to the client login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
