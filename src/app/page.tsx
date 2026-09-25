import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, FileCheck, BarChart3 } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <nav className="h-20 px-8 flex items-center justify-between border-b border-slate-100">
        <Image src="/logo.png" alt="RIVIX" width={120} height={40} className="h-auto w-auto" />
        <div className="flex gap-8 items-center">
          <Link href="/login" className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-rivix transition-all shadow-lg shadow-slate-900/10">
            Sign In
          </Link>
        </div>

      </nav>

      <main className="flex-1 flex flex-col items-center justify-center py-24 px-6 text-center max-w-5xl mx-auto space-y-12">
        <div className="space-y-6">
          <h1 className="text-6xl md:text-7xl font-black text-slate-900 tracking-tighter leading-[0.95]">
            Compliance <span className="text-rivix">Certificates</span> <br />
            & Portal
          </h1>
          <p className="text-slate-500 text-lg md:text-xl font-medium leading-relaxed max-w-2xl mx-auto">
            Secure, 24/7 access to your industrial compliance certificates, 
            quality inspection reports, and order history.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg justify-center">
          <Link
            href="/login"
            className="flex-1 bg-slate-900 text-white px-8 py-5 rounded-2xl font-bold hover:bg-rivix transition-all shadow-2xl shadow-slate-900/10 active:scale-95 flex items-center justify-center gap-2"
          >
            Sign In
            <ArrowRight size={20} />
          </Link>
        </div>
        <p className="text-xs text-slate-400 font-medium -mt-6">
          New to RIVIX? Contact your sales representative, or ask RIVIX to set up your account.
        </p>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-12 w-full max-w-3xl">
          {[
            { icon: FileCheck, title: 'Compliance Certificates', desc: 'Instant access to factory-direct certification for every order.' },
            { icon: BarChart3, title: 'Quality Audits', desc: 'Comprehensive inspection reports and safety standards data.' }
          ].map((feature) => (
            <div key={feature.title} className="p-8 rounded-[2rem] border border-slate-100 bg-slate-50/50 text-left space-y-4">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-rivix">
                <feature.icon size={24} />
              </div>
              <h3 className="font-bold text-slate-900">{feature.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="py-12 px-8 border-t border-slate-100 bg-slate-50/30">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <Image src="/logo.png" alt="RIVIX" width={100} height={30} className="h-auto w-auto grayscale opacity-50" />
          </div>
          <div className="flex gap-8">
            <Link href="/privacy" className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-rivix transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-rivix transition-colors">Terms of Service</Link>
            <Link href="https://rivix.ca/contact" className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-rivix transition-colors">Support</Link>
          </div>
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">© 2026 RIVIX Canada</p>

        </div>
      </footer>
    </div>
  );
}
