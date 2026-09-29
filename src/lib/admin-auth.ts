import type { User } from '@supabase/supabase-js';

// Admin status lives in app_metadata, which only the service role can write —
// a logged-in user cannot grant themselves this, unlike user_metadata.
export function isAdminUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin';
}
