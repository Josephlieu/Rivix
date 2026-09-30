import { UserCircle } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getCurrentRep } from '@/lib/current-rep';
import { isAdminUser } from '@/lib/admin-auth';
import ChangePasswordCard from '@/components/ChangePasswordCard';
import NoRepProfile from '../NoRepProfile';

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-sm font-semibold text-slate-700">{value || '—'}</p>
  </div>
);

export default async function RepAccount() {
  const rep = await getCurrentRep();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!rep) return <NoRepProfile isAdmin={isAdminUser(user)} />;

  const { data: full } = await createAdminClient()
    .from('reps')
    .select('*')
    .eq('id', rep.id)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account</h1>
        <p className="text-slate-500">View your profile and manage your password.</p>
      </div>

      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rivix/5 text-rivix"><UserCircle size={24} /></div>
          <h3 className="font-bold text-slate-900">Profile</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field label="Name" value={full?.name || rep.name} />
          <Field label="Title" value={full?.title} />
          <Field label="Rep Code" value={(full as any)?.rep_code} />
          <Field label="Phone" value={full?.phone} />
          <div className="sm:col-span-2"><Field label="Login Email" value={user?.email} /></div>
        </div>
        <p className="text-xs text-slate-400">Your profile details are managed by RIVIX admin — contact them if anything needs to change.</p>
      </div>

      <ChangePasswordCard email={user?.email || ''} />
    </div>
  );
}
