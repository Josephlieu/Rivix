import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/admin-auth';

export interface NotificationInput {
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  order_id?: string | null;
}

// Every admin login (all admins are equal), as auth user ids.
export async function adminUserIds(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data?.users || []).filter((u) => isAdminUser(u as any)).map((u) => u.id);
}

// The people tied to a customer: the customer's own login and their assigned rep's login.
export async function customerParties(admin: SupabaseClient, customerId: string) {
  const { data } = await admin
    .from('customers')
    .select('user_id, company_name, rep:reps(user_id)')
    .eq('id', customerId)
    .maybeSingle();
  return {
    customerUserId: (data?.user_id as string | null) ?? null,
    repUserId: ((data as any)?.rep?.user_id as string | null) ?? null,
    companyName: (data?.company_name as string | null) ?? '',
  };
}

// Create one notification per recipient. A failure here must never break the
// action that triggered it, so errors are logged and swallowed.
export async function notifyUsers(
  admin: SupabaseClient,
  userIds: (string | null | undefined)[],
  n: NotificationInput
): Promise<void> {
  try {
    const ids = Array.from(new Set(userIds.filter(Boolean) as string[]));
    if (!ids.length) return;
    const { error } = await admin.from('notifications').insert(
      ids.map((id) => ({
        recipient_user_id: id,
        kind: n.kind,
        title: n.title.slice(0, 200),
        body: n.body ? n.body.slice(0, 500) : null,
        link: n.link ?? null,
        order_id: n.order_id ?? null,
      }))
    );
    if (error) console.error('notify failed:', error.message);
  } catch (e) {
    console.error('notify failed:', e);
  }
}
