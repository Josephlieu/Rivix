'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
import { notificationIcon, timeAgo, notificationsPath } from '@/lib/notification-ui';
import { supabaseBrowser } from '@/lib/supabase-browser';

interface NotificationBellProps {
  mode: 'admin' | 'client' | 'rep';
}

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

// Real notifications for whoever is signed in. Row security means the query only
// ever returns this person's own rows. Refreshes every 45 seconds and when opened.
export default function NotificationBell({ mode }: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser
      .from('notifications')
      .select('id, kind, title, body, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    setItems((data as Notif[]) || []);
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 45000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]);

  const unread = items.filter((n) => !n.read_at).length;

  const markRead = async (body: Record<string, unknown>) => {
    await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  };

  const openItem = async (n: Notif) => {
    setIsOpen(false);
    if (!n.read_at) {
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      markRead({ ids: [n.id] });
    }
    if (n.link) router.push(n.link);
  };

  const markOne = async (e: React.MouseEvent, n: Notif) => {
    e.stopPropagation();
    setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    await markRead({ ids: [n.id] });
  };

  const markAll = async () => {
    setItems((l) => l.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    await markRead({ all: true });
  };

  return (
    <div className="relative font-sans">
      <button
        onClick={() => { setIsOpen((v) => !v); if (!isOpen) load(); }}
        aria-label="Notifications"
        className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rivix hover:bg-white hover:shadow-sm transition-all relative"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rivix rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[40]" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2.5 w-80 lg:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-[50] py-3 text-left animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-4 pb-2.5 mb-2 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Notifications</h3>
              {unread > 0 && (
                <button onClick={markAll} className="text-[9px] font-black text-rivix uppercase tracking-widest hover:text-rivix-dark transition-colors">
                  Mark all read
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={20} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-400">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {items.map((n) => {
                  const { Icon, color } = notificationIcon(n.kind);
                  return (
                    <div key={n.id} className={`flex items-stretch ${n.read_at ? '' : 'bg-rivix/[0.03]'}`}>
                      <button onClick={() => openItem(n)} className="flex-1 min-w-0 text-left pl-4 pr-2 py-3.5 hover:bg-slate-50 transition-colors flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                          <Icon size={14} />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <h4 className={`text-xs leading-tight ${n.read_at ? 'font-semibold text-slate-600' : 'font-bold text-slate-900'}`}>{n.title}</h4>
                          {n.body && <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">{n.body}</p>}
                          <span className="text-[9px] font-bold text-slate-400 block pt-0.5">{timeAgo(n.created_at)}</span>
                        </div>
                      </button>
                      {!n.read_at && (
                        <button
                          onClick={(e) => markOne(e, n)}
                          title="Mark as read"
                          aria-label="Mark as read"
                          className="px-3 flex items-center text-slate-300 hover:text-emerald-600 hover:bg-emerald-50/60 transition-colors"
                        >
                          <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center"><Check size={12} /></span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="px-4 pt-2.5 mt-2 border-t border-slate-100 text-center">
              <Link href={notificationsPath(mode)} onClick={() => setIsOpen(false)} className="text-[10px] font-black text-rivix uppercase tracking-widest hover:text-rivix-dark transition-colors">
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
