'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import type { ReplicationChat } from './useReplicationChat';

interface Props {
  chat: ReplicationChat; // the messages and the sending, kept on the request page (see useReplicationChat)
  role: 'admin' | 'rep';
  repName: string | null; // the sales rep who owns the request (null = the admin handles it directly)
}

// The conversation on one request, between the sales rep who owns it and the admin(s).
// Customers are never part of it. Every message shows who wrote it and in what role.
export default function ChatPanel({ chat, role, repName }: Props) {
  const { messages, loading, error, setError, checkedAt, load, send } = chat;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await send(body);
      setText('');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const other = role === 'admin' ? (repName ? `the sales rep (${repName})` : 'the sales rep (none assigned: this request is handled directly)') : 'the admin';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
        <h3 className="text-sm font-bold text-slate-800">Team chat</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-slate-500">
          For this request only, between the sales rep and the admin. You are talking with {other}. The customer never sees this chat. The other person gets a notification when you write.
        </p>
      </div>

      <div className="max-h-[480px] min-h-[200px] space-y-3 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4" aria-live="polite">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading the chat…</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No messages yet. Write the first one below.</p>
        ) : (
          messages.map(m => {
            const mine = m.senderRole === role;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? 'bg-rivix text-white' : 'bg-slate-100 text-slate-800'}`}>
                  <p className={`flex flex-wrap items-center gap-2 text-[12px] font-bold ${mine ? 'text-white/80' : 'text-slate-500'}`}>
                    {m.senderName}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${mine ? 'bg-white/20 text-white' : m.senderRole === 'admin' ? 'bg-slate-900 text-white' : 'bg-rivix/10 text-rivix'}`}>
                      {m.senderRole === 'admin' ? 'Admin' : 'Sales rep'}
                    </span>
                    <span className="font-medium opacity-75">{formatDateTime(m.timestamp)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{m.message}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={end} />
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</p>}

      <div className="flex items-end gap-3">
        <textarea
          value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={2000} placeholder={`Write to ${role === 'admin' ? 'the sales rep' : 'the admin'}…`}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
          className="min-h-[56px] flex-1 resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rivix/30"
        />
        <button type="button" onClick={submit} disabled={sending || !text.trim()} className="flex h-[56px] items-center gap-2 rounded-xl bg-rivix px-5 text-sm font-bold text-white shadow-lg shadow-rivix/30 hover:bg-rivix-dark disabled:opacity-40">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-400">
        <span>Tip: press Cmd+Enter (or Ctrl+Enter) to send.</span>
        <span className="flex items-center gap-2">
          {checkedAt ? `Checked for new messages at ${checkedAt.toLocaleTimeString()}` : 'Checking for new messages…'}
          <button type="button" disabled={refreshing} onClick={async () => { setRefreshing(true); await load(false); setRefreshing(false); }} className="font-bold text-rivix hover:underline disabled:opacity-50">
            {refreshing ? 'Refreshing…' : 'Refresh now'}
          </button>
        </span>
      </div>
    </div>
  );
}
