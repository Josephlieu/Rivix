import { I18nProvider } from '@/i18n/client';
import { effectiveLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/dictionaries';
import { selectedLocale } from '@/i18n/server';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import AccountMenu from '@/components/AccountMenu';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAwaitingApproval } from '@/lib/rep-invites';
import { isRepUser } from '@/lib/admin-auth';
import AwaitingApproval from './AwaitingApproval';

export default async function RepLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rep = await getCurrentRep();
  // Joined through an invite link and not approved yet: nothing of the sales portal is shown (and every rep API
  // refuses them, because their rep card is inactive).
  if (!rep && user && isRepUser(user) && (await isAwaitingApproval(createAdminClient(), user.id))) {
    return <AwaitingApproval email={user.email || ''} />;
  }

  const name = rep?.name || user?.email || 'Sales Rep';
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();
  // Staff pages stay in English for now (2026-11-27); the switcher still sets the date and number formats (US·EN).
  const selected = await selectedLocale('staff');
  const locale = effectiveLocale(selected, 'staff');

  return (
    <I18nProvider selected={selected} locale={locale} messages={messagesFor(locale)}>
    <div lang={locale} className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar mode="rep" />
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
        <header className="flex-shrink-0 h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {/* Space for mobile toggle */}
            <div className="w-12 lg:hidden" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Sales <span className="text-rivix">Portal</span></h2>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher side="staff" />
            <NotificationBell mode="rep" />
            <AccountMenu name={name} initials={initials} profileHref="/rep/account" signOutHref="/login" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-10">{children}</div>
        </main>
      </div>
    </div>
    </I18nProvider>
  );
}
