'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatMessages, sendChatMessage, type ChatMessage } from '@/lib/replicationStorage';

// The Team chat of one request, kept in ONE place (the request page) so the "Team chat" tab can show how many messages
// from the other person have not been read yet, even while another tab is open.
//  - checks for new messages every 5 s while the browser tab is on screen, and straight away when the person comes back;
//  - "read" is remembered in this browser, per request and per role (the newest message seen when the chat was open).
export function useReplicationChat(requestId: string | undefined, role: 'admin' | 'rep', chatOpen: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [seenAt, setSeenAt] = useState('');
  const key = requestId ? `rq-chat-seen:${requestId}:${role}` : '';
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!key) return;
    try { setSeenAt(localStorage.getItem(key) || ''); } catch { setSeenAt(''); }
  }, [key]);

  const load = useCallback(async (quiet = false) => {
    if (!requestId) return;
    try {
      const list = await getChatMessages(requestId);
      if (!alive.current) return;
      // Merge instead of replace: a slower, older load must never wipe out a message that was just sent.
      setMessages(prev => {
        const byId = new Map(prev.map(m => [m.id, m]));
        list.forEach(m => byId.set(m.id, m));
        const merged = Array.from(byId.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        return merged.length === prev.length && merged.every((m, i) => m.id === prev[i]?.id) ? prev : merged;
      });
      setCheckedAt(new Date());
      if (!quiet) setError('');
    } catch (e) {
      if (!quiet && alive.current) setError(e instanceof Error ? e.message : 'Could not load the chat.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;
    load();
    const wake = () => { if (document.visibilityState === 'visible') load(true); };
    const timer = setInterval(wake, 5_000);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', wake); window.removeEventListener('focus', wake); };
  }, [requestId, load]);

  const send = useCallback(async (text: string) => {
    if (!requestId) return;
    const m = await sendChatMessage(requestId, text);
    setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
  }, [requestId]);

  // Messages from the OTHER person that arrived after the chat was last open.
  const unread = messages.filter(m => m.senderRole !== role && m.timestamp > seenAt).length;

  // While the chat is open (and the tab is on screen), everything that arrives counts as read.
  const newest = messages.length ? messages[messages.length - 1].timestamp : '';
  useEffect(() => {
    if (!chatOpen || !key || !newest || newest <= seenAt) return;
    if (document.visibilityState !== 'visible') return;
    try { localStorage.setItem(key, newest); } catch { /* private window: the badge just resets next time */ }
    setSeenAt(newest);
  }, [chatOpen, key, newest, seenAt]);

  return { messages, loading, error, setError, checkedAt, unread, load, send };
}

export type ReplicationChat = ReturnType<typeof useReplicationChat>;
