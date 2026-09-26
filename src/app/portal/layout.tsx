import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let companyName = 'Your Account';
  let initials = '—';

  if (user) {
    const { data: customer } = await supabase
      .from('customers')
      .select('company_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (customer?.company_name) {
      companyName = customer.company_name;
      initials = customer.company_name
        .split(' ')
        .slice(0, 2)
        .map((w: string) => w[0])
        .join('')
        .toUpperCase();
    } else {
      // Logged in, but no customer profile has been created for them yet
      companyName = user.email || 'Your Account';
      initials = (user.email?.[0] || '?').toUpperCase();
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar mode="client" />
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
        <header className="flex-shrink-0 h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {/* Space for mobile toggle */}
            <div className="w-12 lg:hidden" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Client <span className="text-rivix">Portal</span></h2>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell mode="client" />
            <div className="flex items-center gap-4 hidden sm:flex border-l border-slate-200 pl-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{companyName}</span>
              <div className="w-8 h-8 rounded-full bg-rivix/10 border border-rivix/20 flex items-center justify-center text-[10px] font-bold text-rivix">{initials}</div>
            </div>
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
