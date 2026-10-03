import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

// Mark the signed-in user's own notifications as read ({ ids: [...] } or { all: true }).
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();
  let q = admin.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_user_id', user.id).is('read_at', null);
  if (!body?.all) {
    const ids = Array.isArray(body?.ids) ? body.ids.map(String).slice(0, 100) : [];
    if (!ids.length) return NextResponse.json({ ok: true });
    q = q.in('id', ids);
  }
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
