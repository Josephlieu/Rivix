import Link from 'next/link';
import { Mail, Phone, UserX } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAdminUser } from '@/lib/admin-auth';

export default async function RepHome() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  // The rep is identified from their own signed-in session — never from
  // anything in the URL — so a rep can only ever see their own customers.
  const { data: rep } = user
    ? await admin.from('reps').select('id, name, title').eq('user_id', user.id).maybeSingle()
    : { data: null };

  if (!rep) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
          <UserX size={28} />
        </div>
        <p className="font-bold text-slate-900">No rep profile linked to this login</p>
        <p className="text-sm text-slate-500">
          {isAdminUser(user)
            ? "You're signed in as an admin. Manage reps and customers from the admin panel."
            : 'Ask an admin to check your account.'}
        </p>
        {isAdminUser(user) && (
          <Link href="/admin" className="inline-block bg-slate-950 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-rivix transition-all">
            Go to admin panel
          </Link>
        )}
      </div>
    );
  }

  const { data: customers } = await admin
    .from('customers')
    .select('id, customer_code, company_name, contact_email, contact_phone, orders(count)')
    .eq('rep_id', rep.id)
    .order('company_name', { ascending: true });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {rep.name}</h1>
        <p className="text-slate-500">
          {rep.title ? `${rep.title} · ` : ''}
          {customers?.length ?? 0} customer{customers?.length === 1 ? '' : 's'} assigned to you
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-left min-w-[560px]">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Customer</th>
              <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Contact</th>
              <th className="px-4 sm:px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Orders</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(!customers || customers.length === 0) && (
              <tr>
                <td colSpan={3} className="px-8 py-10 text-center text-sm text-slate-400">
                  No customers assigned to you yet.
                </td>
              </tr>
            )}
            {customers?.map((c: any) => (
              <tr key={c.id}>
                <td className="px-4 sm:px-8 py-5">
                  <p className="font-bold text-slate-900">{c.company_name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{c.customer_code}</p>
                </td>
                <td className="px-4 sm:px-8 py-5 text-sm text-slate-600 space-y-1">
                  <p className="flex items-center gap-2"><Mail size={14} className="text-slate-400" />{c.contact_email}</p>
                  {c.contact_phone && <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400" />{c.contact_phone}</p>}
                </td>
                <td className="px-4 sm:px-8 py-5 text-sm font-bold text-slate-700">{c.orders?.[0]?.count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
