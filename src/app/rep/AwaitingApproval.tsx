'use client';

import Image from 'next/image';
import { Clock, LogOut } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';

// Shown instead of the sales portal to a rep who signed up with an invite link and has not been approved yet.
export default function AwaitingApproval({ email }: { email: string }) {
  const signOut = async () => { await supabaseBrowser.auth.signOut(); window.location.assign('/login'); };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-5 text-center">
        <div className="flex justify-center"><Image src="/logo.png" alt="RIVIX Logo" width={150} height={50} className="h-auto w-auto" priority /></div>
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><Clock size={28} /></div>
        <h1 className="text-lg font-bold text-slate-900">Your account is waiting for RIVIX to approve it</h1>
        <p className="text-sm text-slate-500">You are signed in as <span className="font-semibold text-slate-700 break-all">{email}</span>. Once a RIVIX admin approves your account you can use the sales portal. You will see it here the next time you sign in.</p>
        <button onClick={signOut} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-rivix"><LogOut size={16} />Sign out</button>
      </div>
    </div>
  );
}
