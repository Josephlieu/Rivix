'use client';

import { useState, useEffect } from 'react';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabaseBrowser as supabase } from '@/lib/supabase-browser';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Listen for auth state changes (crucial for OAuth redirects)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/portal');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // All email/password logins go to client portal
      // Admin access is gated separately via /admin/verify PIN
      router.push('/portal');
    } catch (error: any) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : error.message
      );
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
            COMPLIANCE <span className="text-rivix">PORTAL</span>
          </h1>
          <p className="text-slate-500 font-medium mt-2">
            Access your compliance certificates
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 space-y-6">
          <form onSubmit={handleAuthAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="name@company.com"
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
              className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold hover:bg-rivix transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  Sign In to Portal
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-4 border-t border-slate-50">
            <p className="text-xs text-slate-400 font-medium">
              New to RIVIX? Contact your sales representative, or ask RIVIX to set up your account.
            </p>
          </div>

        </div>


        <div className="text-center space-y-4">
          <a
            href="/admin"
            className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rivix transition-colors"
          >
            <Lock size={10} />
            Admin Access
          </a>
          <div className="flex justify-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <a href="/privacy" className="hover:text-rivix transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-rivix transition-colors">Terms of Service</a>
          </div>
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">© 2026 RIVIX Canada</p>
        </div>

      </div>
    </div>
  );
}
