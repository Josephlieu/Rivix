'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';

const MIN_PASSWORD = 8; // the server checks the same rule

// A rep sign-up link (task 9). The person sets their name and password; their account then waits for a RIVIX admin
// to approve it. All the checks happen on the server; this page only shows the form.
export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'invalid' | 'form' | 'done'>('loading');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/rep-invites/${encodeURIComponent(String(token))}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMessage(data.error || 'This invite link is not valid.'); setState('invalid'); return; }
      setEmail(data.email); setState('form');
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) { setError(`Choose a password of at least ${MIN_PASSWORD} characters.`); return; }
    if (password !== confirm) { setError('The two passwords are not the same.'); return; }
    setBusy(true);
    const res = await fetch(`/api/rep-invites/${encodeURIComponent(String(token))}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, password }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (res.status === 404) { setMessage(data.error || 'This invite link is not valid.'); setState('invalid'); return; }
      setError(data.error || 'Could not create your account.'); return;
    }
    setState('done');
  };

  const input = 'w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none font-medium placeholder:text-slate-300';
  const label = 'text-[10px] font-black text-slate-400 uppercase tracking-widest px-1';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Image src="/logo.png" alt="RIVIX Logo" width={160} height={54} className="h-auto w-auto" priority /></div>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 space-y-5">
          {state === 'loading' && <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="animate-spin" size={16} />Checking your invite…</p>}
          {state === 'invalid' && (
            <div className="space-y-3 text-center">
              <AlertCircle className="mx-auto text-red-500" size={32} />
              <p className="font-bold text-slate-900">This link can&apos;t be used</p>
              <p className="text-sm text-slate-500">{message}</p>
            </div>
          )}
          {state === 'form' && (
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rivix/10 text-rivix"><UserPlus size={22} /></div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Join RIVIX as a sales rep</h1>
                  <p className="text-xs text-slate-500 break-all">Your sign-in email: <span className="font-semibold text-slate-700">{email}</span></p>
                </div>
              </div>
              <div className="space-y-1.5"><label className={label} htmlFor="name">Your name</label><input id="name" required maxLength={120} className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
              <div className="space-y-1.5"><label className={label} htmlFor="phone">Phone (optional)</label><input id="phone" type="tel" maxLength={40} className={input} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></div>
              <div className="space-y-1.5"><label className={label} htmlFor="pw">Password</label><input id="pw" type="password" required minLength={MIN_PASSWORD} maxLength={72} className={input} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD} characters`} /></div>
              <div className="space-y-1.5"><label className={label} htmlFor="pw2">Password again</label><input id="pw2" type="password" required maxLength={72} className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></div>
              {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
              <button disabled={busy} className="w-full bg-slate-950 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-rivix transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 className="animate-spin" size={18} /> : 'Create my account'}
              </button>
              <p className="text-[11px] text-slate-400">This link works once. Your account is checked by a RIVIX admin before you can use the sales portal.</p>
            </form>
          )}
          {state === 'done' && (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
              <p className="font-bold text-slate-900">Your account is created</p>
              <p className="text-sm text-slate-500">It is waiting for RIVIX to approve it. You can sign in now; the sales portal opens once you are approved.</p>
              <Link href="/login" className="inline-block bg-slate-950 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-rivix transition-all">Go to sign in</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
