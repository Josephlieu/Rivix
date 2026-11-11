import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';

// Task 31 (two-step admins only): the catalog change log, newest first: who changed which category, product type or template,
// when, what changed and why. ?key= limits it to one item.
export async function GET(req: NextRequest) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  let q = createAdminClient().from('catalog_changes').select('id, kind, target_key, action, changes, note, by_email, created_at').order('created_at', { ascending: false }).limit(200);
  const key = req.nextUrl.searchParams.get('key');
  if (key) q = q.eq('target_key', key);
  const { data, error } = await q;
  if (error) return NextResponse.json({ changes: [], missing: /does not exist|schema cache/i.test(error.message) });
  return NextResponse.json({ changes: (data || []).map((c) => ({ id: c.id, kind: c.kind, key: c.target_key, action: c.action, changes: c.changes ?? [], note: c.note, by: c.by_email, at: c.created_at })) });
}
