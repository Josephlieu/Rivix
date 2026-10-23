'use client';

import { useEffect, useState } from 'react';
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
  PlusCircle,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import RepWidget from './RepWidget';
import { supabaseBrowser as supabase } from '@/lib/supabase-browser';

interface SidebarProps {
  mode: 'admin' | 'client' | 'rep';
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
  { href: '/portal/certificates', label: 'Documents', icon: ShieldCheck },
  { href: '/portal/account', label: 'Account', icon: UserCircle },
];

const repLinks = [
  { href: '/rep', label: 'Overview', icon: LayoutDashboard },
  { href: '/rep/customers', label: 'My Customers', icon: Users },
  { href: '/rep/orders', label: 'Orders', icon: FileText },
  { href: '/rep/orders/new', label: 'New Order', icon: PlusCircle },
  { href: '/rep/replication', label: 'Replication', icon: FileUp }, // internal tool between the rep and the admin; customers never see it
  { href: '/rep/account', label: 'Account', icon: UserCircle },
];

// Section roots only match exactly; everything else also matches its sub-pages
// (e.g. /rep/orders stays highlighted on /rep/orders/ORD-0002).
const rootPaths = ['/admin', '/portal', '/rep'];
const isLinkActive = (pathname: string, href: string, siblings: { href: string }[]) => {
  if (pathname === href) return true;
  if (rootPaths.includes(href)) return false;
  if (!pathname.startsWith(href + '/')) return false;
  // Don't highlight a parent when a more specific sibling link matches (Orders vs New Order)
  return !siblings.some((l) => l.href !== href && l.href.length > href.length && (pathname === l.href || pathname.startsWith(l.href + '/')));
};

export default function Sidebar({ mode }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  // Desktop only: shrink to an icon strip. Remembered per browser (a convenience; the page works without it).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem('rivix_sidebar_collapsed') === '1'); } catch { /* storage unavailable */ }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('rivix_sidebar_collapsed', next ? '1' : '0'); } catch { /* storage unavailable */ }
      return next;
    });
  };
  const c = collapsed; // the phone drawer is never collapsed: every "c &&" class below is lg: only
  const links = mode === 'admin' ? adminLinks : mode === 'rep' ? repLinks : clientLinks;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(mode === 'admin' ? '/admin-login' : '/login');
  };

  const navContent = (
    <>
      {/* Fixed height, so the menu below never jumps while the sidebar opens or closes */}
      <div className="relative h-[116px] mb-2 shrink-0">
        <div
          className={cn("hidden lg:flex absolute top-5 left-[18px] w-10 h-10 rounded-xl bg-rivix text-white font-black text-lg items-center justify-center transition-opacity duration-300 motion-reduce:transition-none", c ? "opacity-100 delay-100" : "opacity-0 pointer-events-none")}
          aria-hidden={!c}
        >R</div>
        <div className={cn("absolute top-6 left-6 right-14 h-12 transition-opacity duration-300 motion-reduce:transition-none", c && "lg:opacity-0 lg:pointer-events-none")}>
          <Image
            src="/logo.png"
            alt="RIVIX"
            fill
            className="object-contain object-left"
            priority
          />
        </div>
        <p className={cn("absolute top-[78px] left-6 whitespace-nowrap text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase transition-opacity duration-300 motion-reduce:transition-none", c && "lg:opacity-0 lg:pointer-events-none")}>Compliance Portal</p>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={c ? 'Expand sidebar' : 'Collapse sidebar'}
          title={c ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            "hidden lg:flex absolute items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rivix hover:bg-white transition-[left,top,color,background-color] duration-300 ease-in-out motion-reduce:transition-none",
            c ? "top-[68px] left-[22px]" : "top-5 left-[208px]"
          )}
        >
          {c ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className={cn("flex-1 px-4 space-y-1 overflow-y-auto overflow-x-hidden transition-[padding] duration-300 motion-reduce:transition-none", c && "lg:px-3")}>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = isLinkActive(pathname, link.href, links);
          
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              title={c ? link.label : undefined}
              aria-label={link.label}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 motion-reduce:transition-none",
                c && "lg:px-[17px]",
                isActive 
                  ? "bg-white text-rivix shadow-sm border border-slate-100" 
                  : "text-slate-500 hover:text-rivix hover:bg-white/50"
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span className={cn("whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 motion-reduce:transition-none max-w-[180px]", c && "lg:opacity-0 lg:max-w-0")}>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={cn("p-4 border-t border-slate-200 space-y-4 transition-[padding] duration-300 motion-reduce:transition-none", c && "lg:px-3")}>
        {mode === 'client' && <div className={cn("overflow-hidden transition-[opacity,max-height] duration-300 motion-reduce:transition-none max-h-96", c && "lg:opacity-0 lg:max-h-0")}><RepWidget /></div>}
        <button
          onClick={handleSignOut}
          title={c ? 'Sign out' : undefined}
          aria-label="Sign out"
          className={cn(
            "flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-400 hover:text-rivix transition-all duration-300 motion-reduce:transition-none w-full rounded-xl hover:bg-white/50",
            c && "lg:px-[17px]"
          )}
        >
          <LogOut size={18} className="shrink-0" />
          <span className={cn("whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 motion-reduce:transition-none max-w-[180px]", c && "lg:opacity-0 lg:max-w-0")}>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
        className={cn(
          "lg:hidden fixed top-3 left-4 z-[45] p-2.5 bg-white border border-slate-200 rounded-xl shadow-md text-slate-600 hover:text-rivix transition-all",
          isOpen && "invisible"
        )}
      >
        <Menu size={20} />
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
        "fixed lg:static inset-y-0 left-0 z-[55] w-64 h-dvh lg:h-full bg-rivix-light border-r border-slate-200 text-slate-600 font-sans transition-[transform,width] duration-300 ease-in-out motion-reduce:transition-none transform lg:translate-x-0 flex flex-col overflow-hidden shrink-0",
        c && "lg:w-[76px]",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close button lives inside the drawer (top-right) so it never covers the logo */}
        <button
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
          className="lg:hidden absolute top-4 right-4 z-10 p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-rivix transition-all"
        >
          <X size={18} />
        </button>
        {navContent}
      </div>
    </>
  );
}
