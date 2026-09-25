import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar mode="client" />
      <main className="flex-1 overflow-y-auto w-full">
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {/* Space for mobile toggle */}
            <div className="w-12 lg:hidden" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Client <span className="text-rivix">Portal</span></h2>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell mode="client" />
            <div className="flex items-center gap-4 hidden sm:flex border-l border-slate-200 pl-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pacific Mining Co.</span>
              <div className="w-8 h-8 rounded-full bg-rivix/10 border border-rivix/20 flex items-center justify-center text-[10px] font-bold text-rivix">PM</div>
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-10">
          {children}
        </div>
      </main>

    </div>
  );
}
