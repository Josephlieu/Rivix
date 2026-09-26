'use client';

import { useState } from 'react';
import { Mail, Loader2, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabaseBrowser as supabase } from '@/lib/supabase-browser';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
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
            RESET <span className="text-rivix">PASSWORD</span>
          </h1>
          <p className="text-slate-500 font-medium mt-2">
            We&apos;ll email you a link to set a new one
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 space-y-6">
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <p className="font-bold text-slate-900">Check your email</p>
                <p className="text-sm text-slate-500 mt-1">
                  If an account exists for <span className="font-semibold text-slate-700">{email}</span>, a password reset link is on its way.
                </p>
              </div>
            </div>
          ) : (
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
                    placeholder="name@company.com"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none transition-all placeholder:text-slate-300 font-medium"
                  />
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
                {loading ? <Loader2 className="animate-spin" /> : 'Send Reset Link'}
              </button>
            </form>
          )}

          <div className="text-center pt-4 border-t border-slate-50">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-rivix transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
