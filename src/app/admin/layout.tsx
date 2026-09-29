import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import AccountMenu from '@/components/AccountMenu';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = user?.email || 'Admin';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar mode="admin" />
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
        <header className="flex-shrink-0 h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {/* Space for mobile toggle */}
            <div className="w-12 lg:hidden" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Admin <span className="text-rivix">Control</span></h2>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell mode="admin" />
            <AccountMenu name={adminEmail} initials={adminEmail[0].toUpperCase()} signOutHref="/admin-login" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
