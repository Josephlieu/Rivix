// Who may use the Replication Queue, and which requests they may open.
// The queue is an internal tool between sales reps and admins: customers are never connected to it.
//  - an admin sees and changes everything;
//  - a sales rep sees only the requests that belong to them (replications.rep_id = their rep id).
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAdminUser, isRepUser } from '@/lib/admin-auth';

export type ReplicationActor =
  | { kind: 'admin'; userId: string; email: string; name: string }
  | { kind: 'rep'; userId: string; email: string; name: string; repId: string };

/** The signed-in admin or active sales rep, worked out from the session cookie (never from the request body). */
export async function getReplicationActor(): Promise<ReplicationActor | null> {
  const supabase = await createSupabaseRouteClient(); // refreshes an expired sign-in and sends the new one to the browser
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const email = user.email || '';
  if (isAdminUser(user)) return { kind: 'admin', userId: user.id, email, name: email || 'Admin' };
  if (isRepUser(user)) {
    const { data } = await createAdminClient().from('reps').select('id, name, active').eq('user_id', user.id).maybeSingle();
    if (!data || !data.active) return null;
    return { kind: 'rep', userId: user.id, email, name: data.name as string, repId: data.id as string };
  }
  return null;
}

export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
export const notFound = () => NextResponse.json({ error: 'Request not found.' }, { status: 404 });

/** A rep may only open their own requests (an admin may open all). */
export const canAccess = (actor: ReplicationActor, row: { rep_id?: string | null }) =>
  actor.kind === 'admin' || (actor.kind === 'rep' && !!row.rep_id && row.rep_id === actor.repId);

export interface RepInfo { id: string; name: string; userId: string | null }

/** Name and login of the reps behind a set of requests (one query). */
export async function repsByIds(admin: SupabaseClient, ids: Array<string | null | undefined>): Promise<Map<string, RepInfo>> {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  const map = new Map<string, RepInfo>();
  if (!unique.length) return map;
  const { data } = await admin.from('reps').select('id, name, user_id').in('id', unique);
  for (const r of data || []) map.set(r.id as string, { id: r.id as string, name: r.name as string, userId: (r.user_id as string | null) ?? null });
  return map;
}

/** A readable address for a request in the right area for the person being notified. */
export const requestLink = (kind: 'admin' | 'rep', codeOrId: string, tab?: string) =>
  `/${kind === 'admin' ? 'admin' : 'rep'}/replication/${encodeURIComponent(codeOrId)}${tab ? `?tab=${tab}` : ''}`;
