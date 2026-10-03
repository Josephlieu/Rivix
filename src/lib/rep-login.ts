import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTempPassword } from '@/lib/temp-password';
import { notifyUsers } from '@/lib/notify';

export interface RepLoginResult {
  ok: boolean;
  status?: number;
  error?: string;
  credentials?: { email: string; password: string };
  reset?: boolean;
}

// Give a rep a login, or — if they already have one — set a fresh temporary
// password. `admin` must be the service-role client, and the caller must have
// already passed requireAdmin(). The role goes in app_metadata so only the
// server can ever set it.
export async function createOrResetRepLogin(
  admin: SupabaseClient,
  rep: { id: string; email: string; user_id: string | null; active: boolean }
): Promise<RepLoginResult> {
  const password = generateTempPassword();

  if (rep.user_id) {
    const { error } = await admin.auth.admin.updateUserById(rep.user_id, { password });
    if (error) return { ok: false, status: 500, error: error.message };
    return { ok: true, reset: true, credentials: { email: rep.email, password } };
  }

  const email = rep.email.trim().toLowerCase();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'rep' },
    // A disabled rep gets a login that can't be used until they're re-enabled
    ...(rep.active ? {} : { ban_duration: '876000h' }),
  });

  if (createErr || !created.user) {
    const msg = createErr?.message || 'Could not create the login.';
    const exists = /already|registered|exists/i.test(msg);
    return {
      ok: false,
      status: exists ? 409 : 500,
      error: exists ? 'An account with that email already exists.' : msg,
    };
  }

  const { error: linkErr } = await admin.from('reps').update({ user_id: created.user.id }).eq('id', rep.id);
  if (linkErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, status: 500, error: linkErr.message };
  }

  // Waiting in their bell for the first login
  await notifyUsers(admin, [created.user.id], {
    kind: 'welcome',
    title: 'Welcome to the RIVIX Sales Portal',
    body: 'See your customers, create orders and follow their progress here.',
    link: '/rep/customers',
  });

  return { ok: true, credentials: { email, password } };
}
