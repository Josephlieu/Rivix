'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Package, 
  Users, 
  FileUp, 
  ShieldCheck,
  Settings,
  UserCircle,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import RepWidget from './RepWidget';
import { supabaseBrowser as supabase } from '@/lib/supabase-browser';

interface SidebarProps {
  mode: 'admin' | 'client';
}

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/replication', label: 'Replication Queue', icon: FileUp },
  { href: '/admin/orders', label: 'Orders', icon: FileText },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/hiring', label: 'Sales Hiring', icon: Users },
  { href: '/admin/team', label: 'Team / Reps', icon: Settings },
  { href: '/admin/import', label: 'Import CSV', icon: FileUp },
];

const clientLinks = [
  { href: '/portal', label: 'Overview', icon: LayoutDashboard },
  { href: '/portal/orders', label: 'My Orders', icon: FileText },
  { href: '/portal/products', label: 'Product Specs', icon: Package },
  // Uniform Replication removed from the customer side per the 2026-09-25
  // decision — it's a purely internal Admin/Sales Rep workflow now, the
  // customer never gets access to the creation tool or any part of it.
  // { href: '/portal/replication', label: 'Uniform Replication', icon: FileUp },
  { href: '/portal/certificates', label: 'Compliance Certs', icon: ShieldCheck },
  { href: '/portal/account', label: 'Account', icon: UserCircle },
];

export default function Sidebar({ mode }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const links = mode === 'admin' ? adminLinks : clientLinks;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const NavContent = () => (
    <>
      <div className="p-6 flex flex-col gap-2 mb-4">
        <div className="relative h-12 w-full">
          <Image 
            src="/logo.png" 
            alt="RIVIX" 
            fill
            className="object-contain object-left"
            priority
          />
        </div>
        <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">Compliance Portal</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                isActive 
                  ? "bg-white text-rivix shadow-sm border border-slate-100" 
                  : "text-slate-500 hover:text-rivix hover:bg-white/50"
              )}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-4">
        {mode === 'client' && <RepWidget />}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-400 hover:text-rivix transition-colors w-full rounded-xl hover:bg-white/50"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-3 bg-white border border-slate-200 rounded-xl shadow-lg text-slate-600 hover:text-rivix transition-all"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[50] animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Desktop & Mobile Drawer */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-[55] w-64 h-full bg-rivix-light border-r border-slate-200 text-slate-600 font-sans transition-transform duration-300 transform lg:translate-x-0 flex flex-col overflow-hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <NavContent />
      </div>
    </>
  );
}
