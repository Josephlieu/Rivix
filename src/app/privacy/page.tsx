import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-rivix transition-colors">
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <div className="space-y-6">
          <div className="w-16 h-16 bg-rivix/10 text-rivix rounded-2xl flex items-center justify-center">
            <Shield size={32} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-slate-500 font-medium italic text-sm">Last Updated: April 30, 2026</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-600 font-medium leading-relaxed">
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">1. Information We Collect</h2>
            <p>
              RIVIX collects information necessary to provide our compliance and tracking services. This includes business contact information, order details, and authentication data provided via secure OAuth providers (Google and Microsoft).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">2. How We Use Your Data</h2>
            <p>
              Your data is used exclusively to facilitate order tracking, quality inspection reporting, and automated certificate generation. We do not sell or share your data with third-party marketers.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">3. Data Security</h2>
            <p>
              We employ enterprise-grade security via Supabase and Vercel infrastructure. All data is encrypted in transit and at rest. Access is strictly controlled via secure authentication protocols.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">4. Third-Party Services</h2>
            <p>
              We use Google and Microsoft for authentication services. Their use of your information is governed by their respective privacy policies.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">5. Contact Us</h2>
            <p>
              If you have questions about this policy, please contact our compliance team at <span className="text-rivix font-bold">info@rivix.ca</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
