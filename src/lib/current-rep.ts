import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { isRepUser } from '@/lib/admin-auth';

export interface CurrentRep {
  id: string;
  name: string;
  title: string | null;
  active: boolean;
}

// The signed-in sales rep, worked out from their session cookie — never from
// anything the browser sends. Returns null for anyone who isn't a rep
// (customers, signed-out visitors, and admins, who don't create orders).
export async function getCurrentRep(): Promise<CurrentRep | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isRepUser(user)) return null;

  const { data } = await createAdminClient()
    .from('reps')
    .select('id, name, title, active')
    .eq('user_id', user.id)
    .maybeSingle();

  return data && data.active ? (data as CurrentRep) : null;
}
