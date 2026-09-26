'use client';

import { useState } from 'react';
import { Bell, Package, FileText, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface NotificationBellProps {
  mode: 'admin' | 'client';
}

// No real notifications system exists yet — no events (order status
// changes, certificate uploads, etc.) actually trigger anything. This is
// deliberately empty rather than showing fake data; wire in real
// notifications here once there's something real to notify about.
const notifications: {
  id: string;
  title: string;
  description: string;
  time: string;
  link: string;
  icon: typeof Bell;
  iconColor: string;
}[] = [];

export default function NotificationBell({ mode }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(notifications.length);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (unreadCount > 0) {
      setUnreadCount(0);
    }
  };

  return (
    <div className="relative font-sans">
      <button 
        onClick={handleToggle}
        className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rivix hover:bg-white hover:shadow-sm transition-all relative"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rivix rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Transparent click overlay to close */}
          <div className="fixed inset-0 z-[40]" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2.5 w-80 lg:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-[50] py-3 text-left animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-4 pb-2.5 mb-2 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Notifications</h3>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded">RIVIX Real-Time</span>
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={20} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-400">No notifications yet</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {notifications.map(notif => {
                    const Icon = notif.icon;

                    return (
                      <Link
                        key={notif.id}
                        href={notif.link}
                        onClick={() => setIsOpen(false)}
                        className="block px-4 py-3.5 hover:bg-slate-50 transition-colors flex gap-3"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notif.iconColor}`}>
                          <Icon size={14} />
                        </div>

                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-800 leading-tight">{notif.title}</h4>
                          <p className="text-[10px] text-slate-500 leading-normal">{notif.description}</p>
                          <span className="text-[8px] font-bold text-slate-400 block pt-1">{notif.time}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="px-4 pt-2 mt-2 border-t border-slate-100 text-center">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-[9px] font-black text-rivix uppercase tracking-widest hover:text-rivix-dark transition-colors"
                  >
                    Clear all notifications
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
