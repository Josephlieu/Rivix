import type { User } from '@supabase/supabase-js';

// Roles live in app_metadata, which only the service role can write —
// a logged-in user cannot grant themselves a role, unlike user_metadata.
export function isAdminUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin';
}

export function isRepUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'rep';
}

// Where each kind of account lands after signing in.
export function homePathFor(user: User | null | undefined): string {
  if (isAdminUser(user)) return '/admin';
  if (isRepUser(user)) return '/rep';
  return '/portal';
}
