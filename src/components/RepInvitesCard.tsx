'use client';

import { useEffect, useState } from 'react';
import { Link2, Copy, Check, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/format';

interface Invite {
  id: string; email: string; createdBy: string | null; createdAt: string; expiresAt: string; usedAt: string | null;
  cancelledAt: string | null; approvedAt: string | null; approvedBy: string | null; repName: string | null;
  status: 'pending' | 'expired' | 'cancelled' | 'awaiting_approval' | 'approved';
}

const STATUS: Record<Invite['status'], { label: string; cls: string }> = {
  pending: { label: 'Link not used yet', cls: 'bg-sky-50 text-sky-700' },
  awaiting_approval: { label: 'Signed up: approve', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700' },
  expired: { label: 'Expired', cls: 'bg-slate-100 text-slate-500' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

// Rep sign-up links (task 9): create a single-use link for one email (valid 7 days), copy it, cancel it, and approve
// the person once they have signed up. The link is shown only once, right after it is made.
export default function RepInvitesCard() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const res = await fetch('/api/admin/rep-invites');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || 'Could not load the invites.');
    setInvites(data.invites || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('create'); setError(null); setNotice(null); setLink(null); setCopied(false);
    const res = await fetch('/api/admin/rep-invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error || 'Could not create the invite.'); return; }
    setLink({ email: data.invite.email, url: data.link });
    setEmail('');
    await load();
  };

  const act = async (inv: Invite, action: 'cancel' | 'approve') => {
    setBusy(action + inv.id); setError(null); setNotice(null);
    const res = await fetch(`/api/admin/rep-invites/${inv.id}/${action}`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error || 'Could not save.'); return; }
    setNotice(action === 'approve' ? `${inv.repName || inv.email} is approved and can use the sales portal now.` : `The link for ${inv.email} no longer works.`);
    await load();
  };

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.url); setCopied(true); } catch { setCopied(false); }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8 space-y-4" id="rep-invites">
      <div>
        <h3 className="font-bold text-slate-900">Invite a rep with a sign-up link</h3>
        <p className="text-xs text-slate-500 mt-1">The link works once, for 7 days, for the email you enter. The person sets their own name and password; you then approve them before they can use the sales portal. New reps start with no customers.</p>
      </div>
      <form onSubmit={create} className="flex flex-col sm:flex-row gap-2">
        <input type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="new.rep@example.com" aria-label="Email of the person to invite" className="flex-1 px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rivix/20 outline-none" />
        <button disabled={busy === 'create'} className="bg-slate-950 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-rivix transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy === 'create' ? <Loader2 className="animate-spin" size={16} /> : <Link2 size={16} />}Create link
        </button>
      </form>
      {link && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 space-y-2">
          <p className="text-xs font-semibold text-emerald-800">Link for {link.email}. Copy it now: for safety it is not shown again. Send it to them yourself.</p>
          <div className="flex gap-2">
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Invite link" className="flex-1 min-w-0 px-3 py-2 bg-white rounded-xl text-xs font-mono border border-emerald-100" />
            <button type="button" onClick={copy} className="px-3 py-2 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-emerald-700 inline-flex items-center gap-1.5">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      {notice && <p className="text-xs font-semibold text-emerald-700">{notice}</p>}
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : invites.length === 0 ? (
        <p className="text-sm text-slate-400">No invites yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {invites.map((inv) => (
            <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 break-all">{inv.repName ? `${inv.repName} (${inv.email})` : inv.email}</p>
                <p className="text-[11px] text-slate-400">
                  Made {formatDate(inv.createdAt)}{inv.createdBy ? ` by ${inv.createdBy}` : ''}
                  {inv.status === 'pending' ? ` · expires ${formatDate(inv.expiresAt)}` : ''}
                  {inv.status === 'approved' && inv.approvedBy ? ` · approved by ${inv.approvedBy}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS[inv.status].cls}`}>{STATUS[inv.status].label}</span>
                {inv.status === 'pending' && (
                  <button onClick={() => act(inv, 'cancel')} disabled={busy === 'cancel' + inv.id} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:border-red-200 hover:text-red-600 disabled:opacity-50">Cancel link</button>
                )}
                {inv.status === 'awaiting_approval' && (
                  <button onClick={() => act(inv, 'approve')} disabled={busy === 'approve' + inv.id} className="px-3 py-1.5 rounded-lg bg-slate-950 text-white text-xs font-bold hover:bg-rivix disabled:opacity-50">Approve</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
