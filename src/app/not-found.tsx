import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getT } from '@/i18n/server';
import { CornerLanguageSwitcher } from '@/components/LanguageSwitcher';

export default async function NotFound() {
  const { t } = await getT('customer');
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <CornerLanguageSwitcher side="customer" />
      <div className="w-full max-w-md text-center space-y-8">
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt={t('common.logoAlt')}
            width={180}
            height={60}
            className="h-auto w-auto"
            priority
          />
        </div>

        <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 space-y-4">
          <p className="text-6xl font-black text-rivix tracking-tighter italic">404</p>
          <h1 className="text-xl font-bold text-slate-900">{t('notFound.title')}</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            {t('notFound.body')}
          </p>
          <Link
            href="/portal"
            className="inline-flex items-center justify-center gap-2 bg-slate-950 text-white px-6 py-3.5 rounded-2xl font-bold text-sm hover:bg-rivix transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]"
          >
            <ArrowLeft size={16} />
            {t('notFound.back')}
          </Link>
        </div>

        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t('common.copyright')}</p>
      </div>
    </div>
  );
}
