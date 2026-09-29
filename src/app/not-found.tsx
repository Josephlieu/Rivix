import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="RIVIX Logo"
            width={180}
            height={60}
            className="h-auto w-auto"
            priority
          />
        </div>

        <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 space-y-4">
          <p className="text-6xl font-black text-rivix tracking-tighter italic">404</p>
          <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist, or may have been moved.
          </p>
          <Link
            href="/portal"
            className="inline-flex items-center justify-center gap-2 bg-slate-950 text-white px-6 py-3.5 rounded-2xl font-bold text-sm hover:bg-rivix transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]"
          >
            <ArrowLeft size={16} />
            Back to Portal
          </Link>
        </div>

        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">© 2026 RIVIX Canada</p>
      </div>
    </div>
  );
}
