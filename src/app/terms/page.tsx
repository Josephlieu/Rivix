import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-rivix transition-colors">
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <div className="space-y-6">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
            <FileText size={32} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Terms of Service</h1>
          <p className="text-slate-500 font-medium italic text-sm">Last Updated: April 30, 2026</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-600 font-medium leading-relaxed">
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">1. Acceptance of Terms</h2>
            <p>
              By accessing the RIVIX Compliance Portal, you agree to be bound by these Terms of Service and all applicable laws and regulations.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">2. Use License</h2>
            <p>
              Permission is granted to clients of RIVIX to use this portal for the purpose of tracking orders and accessing compliance documentation for their specific business transactions.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">3. Accountability</h2>
            <p>
              Users are responsible for maintaining the confidentiality of their account access. RIVIX reserves the right to terminate access for any unauthorized or fraudulent use of the platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">4. Disclaimer</h2>
            <p>
              The materials on the RIVIX portal are provided for informational purposes related to manufacturing compliance. While we strive for absolute accuracy, RIVIX makes no warranties regarding the suitability of this data for specific legal audits beyond standard industrial requirements.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">5. Governing Law</h2>
            <p>
              These terms are governed by and construed in accordance with the laws of British Columbia, Canada.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
