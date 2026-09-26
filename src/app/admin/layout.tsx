import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:flex border-l border-slate-200 pl-4">
              <span>RIVIX Supply Co.</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200" />
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
