import type { SupabaseClient } from '@supabase/supabase-js';

// A customer is "disabled" when their login is banned. We keep that state in
// Supabase Auth (ban_duration) rather than a column, so there's no schema
// change and a disabled login is genuinely locked out.
export const BAN_FOREVER = '876000h';

export function isBanned(user: { banned_until?: string | null } | null | undefined): boolean {
  return !!user?.banned_until && new Date(user.banned_until).getTime() > Date.now();
}

// user_id -> banned? for every login (service-role client only).
export async function loadBannedMap(admin: SupabaseClient): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of data?.users || []) map.set(u.id, isBanned(u as any));
  return map;
}
