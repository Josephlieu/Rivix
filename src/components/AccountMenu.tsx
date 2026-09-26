'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserCircle, LogOut, ChevronDown } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';

interface AccountMenuProps {
  name: string;
  initials: string;
  profileHref: string;
}

export default function AccountMenu({ name, initials, profileHref }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabaseBrowser.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-4 hidden sm:flex border-l border-slate-200 pl-4 hover:opacity-80 transition-opacity"
      >
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{name}</span>
        <div className="w-8 h-8 rounded-full bg-rivix/10 border border-rivix/20 flex items-center justify-center text-[10px] font-bold text-rivix">
          {initials}
        </div>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20 animate-in fade-in zoom-in-95 duration-100">
          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-rivix transition-colors"
          >
            <UserCircle size={16} />
            View Profile
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-rivix transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
