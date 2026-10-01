import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isAdminUser } from '@/lib/admin-auth';

// Call at the top of any admin-only API route. Returns a 401 response to send
// straight back if the caller isn't a signed-in admin, or null if they are.
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

// Same check, but also returns who the admin is (for "who did this" records).
export async function getAdminIdentity(): Promise<{ denied: NextResponse } | { email: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) return { denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { email: user?.email || 'admin' };
}
