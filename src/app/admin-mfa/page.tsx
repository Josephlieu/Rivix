'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Loader2, ShieldCheck, KeyRound, AlertCircle, LogOut } from 'lucide-react';
import { supabaseBrowser as supabase } from '@/lib/supabase-browser';
import { isAdminUser } from '@/lib/admin-auth';

// Admin two-step sign-in (task 8). After the password, an admin either sets up an authenticator app (first time) or
// enters its 6-digit code. Only then is the session trusted (aal2) for admin screens and APIs. The checks that matter
// are on the server (proxy.ts and every admin API); this page only helps the admin get there.
type Mode = { kind: 'loading' } | { kind: 'setup'; factorId: string; qr: string; secret: string } | { kind: 'verify'; factorId: string };

function AdminMfaForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next') || '/admin';
  const next = rawNext === '/admin' || rawNext.startsWith('/admin/') ? rawNext : '/admin'; // only ever inside /admin
  const [mode, setMode] = useState<Mode>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = () => window.location.assign(next); // a full load, so the server sees the upgraded session

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isAdminUser(user)) { window.location.assign(`/admin-login?next=${encodeURIComponent(next)}`); return; }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal2') { go(); return; }
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) { setError(listErr.message); return; }
      const verified = factors?.totp?.[0];
      if (verified) { setMode({ kind: 'verify', factorId: verified.id }); return; }
      // First time: remove any half-finished set-up, then start a new one.
      for (const f of factors?.all || []) if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: en, error: enErr } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `RIVIX admin ${new Date().toISOString().slice(0, 10)}` });
      if (enErr || !en) { setError(enErr?.message || 'Could not start the set-up. Please try again.'); return; }
      setMode({ kind: 'setup', factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode.kind === 'loading') return;
    setBusy(true); setError(null);
    const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code: code.replace(/\s/g, '') });
    if (vErr) {
      setBusy(false);
      setError(/invalid|expired/i.test(vErr.message) ? 'That code is not right or has expired. Enter the current code from the app.' : vErr.message);
      setCode('');
      return;
    }
    go();
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.assign('/admin-login'); };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Image src="/logo.png" alt="RIVIX Logo" width={160} height={54} className="h-auto w-auto" priority /></div>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rivix/10 text-rivix"><ShieldCheck size={22} /></div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{mode.kind === 'setup' ? 'Set up two-step sign-in' : 'Two-step sign-in'}</h1>
              <p className="text-xs text-slate-500">Required for every RIVIX admin account.</p>
            </div>
          </div>

          {mode.kind === 'loading' && !error && <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="animate-spin" size={16} />Checking your account…</p>}

          {mode.kind === 'setup' && (
            <div className="space-y-3 text-sm text-slate-600">
              <p>1. Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password, Authy…) and scan this code.</p>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mode.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-xl border border-slate-100 bg-white p-2" />
              </div>
              <p className="text-xs text-slate-500">Can&apos;t scan it? Type this key into the app instead:</p>
              <p className="font-mono text-xs break-all bg-slate-50 rounded-xl px-3 py-2 select-all">{mode.secret}</p>
              <p>2. Enter the 6-digit code the app shows.</p>
            </div>
          )}
          {mode.kind === 'verify' && <p className="text-sm text-slate-600">Enter the 6-digit code from your authenticator app.</p>}

          {mode.kind !== 'loading' && (
            <form onSubmit={submit} className="space-y-3">
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                  required
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/[^\d ]/g, '')); setError(null); }}
                  placeholder="123 456"
                  aria-label="6-digit code"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-lg tracking-[0.3em] font-semibold focus:ring-2 focus:ring-rivix/20 outline-none"
                />
              </div>
              <button disabled={busy || code.replace(/\s/g, '').length !== 6} className="w-full bg-slate-950 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-rivix transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="animate-spin" size={18} /> : mode.kind === 'setup' ? 'Finish set-up' : 'Verify'}
              </button>
            </form>
          )}

          {error && <p className="flex items-start gap-2 text-xs font-semibold text-red-600"><AlertCircle size={14} className="shrink-0 mt-0.5" />{error}</p>}

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <p className="text-[11px] text-slate-400 leading-relaxed">Lost your phone or the app? Ask another RIVIX admin to reset your two-step sign-in (Team page). You then set it up again here.</p>
            <button type="button" onClick={signOut} className="text-xs font-bold text-slate-500 hover:text-rivix inline-flex items-center gap-1.5"><LogOut size={14} />Sign out</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminMfaPage() {
  return <Suspense fallback={null}><AdminMfaForm /></Suspense>;
}
