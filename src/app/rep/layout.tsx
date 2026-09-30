import Image from 'next/image';
import AccountMenu from '@/components/AccountMenu';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function RepLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email || 'Rep';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="relative h-9 w-24">
            <Image src="/logo.png" alt="RIVIX" fill className="object-contain object-left" priority />
          </div>
          <h2 className="hidden sm:block text-sm font-black text-slate-800 uppercase tracking-widest italic">
            Sales <span className="text-rivix">Portal</span>
          </h2>
        </div>
        <AccountMenu name={email} initials={email[0].toUpperCase()} signOutHref="/login" />
      </header>
      <main className="max-w-5xl mx-auto p-4 sm:p-8">{children}</main>
    </div>
  );
}
