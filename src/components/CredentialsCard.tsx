'use client';

import { useState } from 'react';
import { Mail, X, Copy, Check, MessageCircle } from 'lucide-react';

export interface NewCredentials {
  name: string;
  email: string;
  password: string;
  phone?: string;
  kind: 'customer' | 'rep';
  reset?: boolean;
}

function buildMessage(c: NewCredentials) {
  const where = c.kind === 'rep' ? 'RIVIX sales portal' : 'RIVIX Compliance Portal';
  return (
    `Hi ${c.name},\n\n` +
    `Your ${where} account is ready.\n\n` +
    `Portal: ${window.location.origin}/login\n` +
    `Email: ${c.email}\n` +
    `Temporary password: ${c.password}\n\n` +
    `Please sign in and change your password after your first login.\n\n` +
    `Thanks,\nRIVIX`
  );
}

function whatsappUrl(c: NewCredentials) {
  let digits = (c.phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits; // assume North American number
  const text = encodeURIComponent(buildMessage(c));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export default function CredentialsCard({
  credentials,
  onDismiss,
}: {
  credentials: NewCredentials;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    await navigator.clipboard.writeText(buildMessage(credentials));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 sm:p-8 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900">
            {credentials.reset ? `New temporary password for ${credentials.name}` : `Account created for ${credentials.name}`}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            The password is shown <strong>only now</strong> and can&apos;t be looked up later. Send it to them now — if it&apos;s lost, generate a new one.
          </p>
        </div>
        <button onClick={onDismiss} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Dismiss">
          <X size={18} />
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-emerald-100 p-4 text-sm space-y-1 font-mono break-all">
        <p><span className="text-slate-400">Email:</span> {credentials.email}</p>
        <p><span className="text-slate-400">Temporary password:</span> {credentials.password}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={copyMessage} className="bg-slate-950 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-rivix transition-all flex items-center gap-2">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied' : 'Copy message'}
        </button>
        <a href={whatsappUrl(credentials)} target="_blank" rel="noreferrer" className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:border-rivix hover:text-rivix transition-all flex items-center gap-2">
          <MessageCircle size={16} />
          Send on WhatsApp
        </a>
        <a
          href={`mailto:${credentials.email}?subject=${encodeURIComponent('Your RIVIX account')}&body=${encodeURIComponent(buildMessage(credentials))}`}
          className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:border-rivix hover:text-rivix transition-all flex items-center gap-2"
        >
          <Mail size={16} />
          Send by email
        </a>
      </div>
    </div>
  );
}
