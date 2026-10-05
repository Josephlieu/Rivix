'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Loader2, CheckCheck, Check } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { notificationIcon, timeAgo } from '@/lib/notification-ui';
import { formatDateTime } from '@/lib/format';

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const PAGE = 30;

// Every notification for the signed-in person, newest first. Row security means
// the query only ever returns their own.
export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (offset: number, f: 'all' | 'unread') => {
    let q = supabaseBrowser
      .from('notifications')
      .select('id, kind, title, body, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (f === 'unread') q = q.is('read_at', null);
    const { data } = await q;
    return (data as Notif[]) || [];
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPage(0, filter).then((rows) => {
      if (!active) return;
      setItems(rows);
      setMore(rows.length === PAGE);
      setLoading(false);
    });
    return () => { active = false; };
  }, [filter, fetchPage]);

  const loadMore = async () => {
    setLoadingMore(true);
    const rows = await fetchPage(items.length, filter);
    setItems((l) => [...l, ...rows]);
    setMore(rows.length === PAGE);
    setLoadingMore(false);
  };

  const markRead = (body: Record<string, unknown>) =>
    fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const open = (n: Notif) => {
    if (!n.read_at) {
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      markRead({ ids: [n.id] });
    }
    if (n.link) router.push(n.link);
  };

  const markOne = async (n: Notif) => {
    setItems((l) => (filter === 'unread' ? l.filter((x) => x.id !== n.id) : l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))));
    await markRead({ ids: [n.id] });
  };

  const markAll = async () => {
    setItems((l) => l.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    await markRead({ all: true });
    if (filter === 'unread') setItems([]);
  };

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500">Everything that has happened on your orders and account.</p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-rivix hover:text-rivix transition-all self-start">
            <CheckCheck size={15} />Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${filter === f ? 'bg-slate-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-rivix'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" size={20} /></div>}

        {!loading && items.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <Bell size={24} className="mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-400">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="divide-y divide-slate-100">
            {items.map((n) => {
              const { Icon, color } = notificationIcon(n.kind);
              return (
                <div key={n.id} className={`flex items-stretch ${n.read_at ? '' : 'bg-rivix/[0.03]'}`}>
                  <button onClick={() => open(n)} className="flex-1 min-w-0 text-left pl-5 sm:pl-8 pr-3 py-5 hover:bg-slate-50 transition-colors flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${color}`}><Icon size={16} /></div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className={`text-sm leading-snug ${n.read_at ? 'font-semibold text-slate-600' : 'font-bold text-slate-900'}`}>{n.title}</p>
                      {n.body && <p className="text-xs text-slate-500 leading-relaxed">{n.body}</p>}
                      <p className="text-[11px] font-bold text-slate-400 pt-1">{timeAgo(n.created_at)} · {formatDateTime(n.created_at)}</p>
                    </div>
                  </button>
                  {!n.read_at && (
                    <button
                      onClick={() => markOne(n)}
                      className="px-4 sm:px-6 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/60 transition-colors whitespace-nowrap"
                    >
                      <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center"><Check size={12} /></span>
                      <span className="hidden sm:inline">Mark as read</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && more && (
          <div className="p-4 border-t border-slate-100 text-center">
            <button onClick={loadMore} disabled={loadingMore} className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:border-rivix hover:text-rivix disabled:opacity-50 transition-all">
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
