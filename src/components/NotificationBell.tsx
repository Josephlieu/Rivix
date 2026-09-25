'use client';

import { useState } from 'react';
import { Bell, MapPin, Package, FileText, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface NotificationBellProps {
  mode: 'admin' | 'client';
}

export default function NotificationBell({ mode }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);

  const clientNotifications = [
    {
      id: 'c1',
      title: 'Uniform Piece Received',
      description: 'Your Subsea Overalls physical sample has been received at the RIVIX factory. Track the replication progress.',
      time: '2 hours ago',
      link: '/portal/replication',
      icon: CheckCircle,
      iconColor: 'text-emerald-500 bg-emerald-100',
    },
    {
      id: 'c2',
      title: 'Prototype Sample On The Way!',
      description: 'RIVIX has dispatched your reproduced Tundra Parka sample via DHL Express. Click to track shipment.',
      time: '1 day ago',
      link: '/portal/replication',
      icon: Package,
      iconColor: 'text-rivix bg-rivix/10',
    }
  ];

  const adminNotifications = [
    {
      id: 'a1',
      title: 'New Uniform Submitted',
      description: 'Pacific Mining Co. uploaded drawings for a new "Subsea FR Overalls" piece for factory review.',
      time: '1 hour ago',
      link: '/admin/replication',
      icon: Package,
      iconColor: 'text-rivix bg-rivix/10',
    },
    {
      id: 'a2',
      title: 'Screening Call Logged',
      description: 'Senior AE Sarah Jenkins (Mark\'s Commercial competitor rep) completed screening call transcript.',
      time: '4 hours ago',
      link: '/admin/hiring',
      icon: FileText,
      iconColor: 'text-blue-500 bg-blue-100',
    }
  ];

  const notifications = mode === 'admin' ? adminNotifications : clientNotifications;

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
              <Link 
                href={mode === 'admin' ? '/admin/replication' : '/portal/replication'} 
                onClick={() => setIsOpen(false)}
                className="text-[9px] font-black text-rivix uppercase tracking-widest hover:text-rivix-dark transition-colors"
              >
                Clear all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
