'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

function AdminVerifyForm() {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin';

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const updated = [...digits];
    updated[index] = digit;
    setDigits(updated);
    setError('');

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are filled
    if (digit && index === 5) {
      const pin = updated.join('');
      if (pin.length === 6) {
        submitPin(pin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const updated = pasted.split('');
      setDigits(updated);
      submitPin(pasted);
    }
  };

  const submitPin = async (pin: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        router.push(next);
        router.refresh();
      } else {
        setError('Invalid access code. Contact your administrator.');
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Connection error. Please try again.');
      setDigits(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mb-8 flex justify-center">
            <Image
              src="/logo.png"
              alt="RIVIX Logo"
              width={140}
              height={48}
              className="h-auto w-auto"
              priority
            />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-5 shadow-lg">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Admin Access
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-2 max-w-xs mx-auto">
            Enter the 6-digit admin PIN to access the RIVIX control panel.
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 space-y-6">
          <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className={`w-12 h-14 text-center text-xl font-black rounded-xl border-2 outline-none transition-all ${
                  error
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : digit
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-rivix'
                } disabled:opacity-50`}
              />
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-bold">
              <Loader2 size={14} className="animate-spin" />
              Verifying...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 font-bold bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <p className="text-[10px] text-slate-300 text-center font-bold uppercase tracking-widest">
            Authorized personnel only
          </p>
        </div>

        <div className="text-center">
          <a href="/login" className="text-xs text-slate-400 hover:text-rivix font-bold transition-colors">
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AdminVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>}>
      <AdminVerifyForm />
    </Suspense>
  );
}
