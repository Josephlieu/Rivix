import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/admin-auth';

// Admin two-step sign-in (task 8). An admin is only trusted once the session has passed the second step (assurance
// level aal2). The token is validated by Supabase (getUser with that exact token) and the level is read from the same
// validated token, so a cookie cannot claim a level it does not have.
export type AdminSessionState = {
  user: User | null;
  isAdmin: boolean;           // has the admin role (app_metadata, set only by the service role)
  aal: 'aal1' | 'aal2' | null;
  hasAuthenticator: boolean;  // a verified authenticator app is set up
  trusted: boolean;           // admin AND aal2: the only state that may use admin screens and APIs
};

const decodeAal = (jwt: string): 'aal1' | 'aal2' | null => {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    return payload.aal === 'aal2' ? 'aal2' : payload.aal === 'aal1' ? 'aal1' : null;
  } catch {
    return null;
  }
};

export async function readAdminSession(supabase: SupabaseClient): Promise<AdminSessionState> {
  const none: AdminSessionState = { user: null, isAdmin: false, aal: null, hasAuthenticator: false, trusted: false };
  const { data: { session } } = await supabase.auth.getSession(); // refreshes an expired token first
  if (!session?.access_token) return none;
  const { data: { user }, error } = await supabase.auth.getUser(session.access_token); // validated by Supabase
  if (error || !user) return none;
  const aal = decodeAal(session.access_token);
  const isAdmin = isAdminUser(user);
  const hasAuthenticator = (user.factors || []).some((f) => f.status === 'verified');
  return { user, isAdmin, aal, hasAuthenticator, trusted: isAdmin && aal === 'aal2' };
}

// Where an admin who is not fully trusted must go next (null = trusted, or not an admin at all).
export const adminNextStep = (s: AdminSessionState): 'setup' | 'verify' | null =>
  !s.isAdmin || s.trusted ? null : s.hasAuthenticator ? 'verify' : 'setup';

export const TWO_STEP_REQUIRED = 'Two-step sign-in required. Sign in again and enter the code from your authenticator app.';
