import Link from 'next/link';
import { UserX } from 'lucide-react';

export default function NoRepProfile({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 text-center space-y-3">
      <div className="mx-auto w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
        <UserX size={28} />
      </div>
      <p className="font-bold text-slate-900">No rep profile linked to this login</p>
      <p className="text-sm text-slate-500">
        {isAdmin
          ? "You're signed in as an admin. Manage reps and customers from the admin panel."
          : 'Ask an admin to check your account.'}
      </p>
      {isAdmin && (
        <Link href="/admin" className="inline-block bg-slate-950 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-rivix transition-all">
          Go to admin panel
        </Link>
      )}
    </div>
  );
}
