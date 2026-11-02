import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { createOrResetRepLogin } from '@/lib/rep-login';
import { logRepActivity } from '@/lib/rep-activity';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: reps, error } = await admin
    .from('reps')
    .select('*, customers(count)')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Per-rep counts for the Team tab. Exact counts, not row lengths, so the
  // 1000-row cap can't make a number wrong. About two small queries per rep.
  const counts = await Promise.all(
    (reps || []).map((r: any) =>
      Promise.all([
        admin.from('orders').select('id', { count: 'exact', head: true }).eq('rep_id', r.id).eq('status', 'Delivered'),
        admin.from('document_requests').select('id', { count: 'exact', head: true }).eq('rep_id', r.id),
      ])
    )
  );
  const countError = counts.flat().find((c) => c.error);
  if (countError?.error) return NextResponse.json({ error: countError.error.message }, { status: 500 });

  return NextResponse.json({
    reps: (reps || []).map((r: any, i: number) => ({
      ...r,
      customer_count: r.customers?.[0]?.count ?? 0,
      orders_completed: counts[i][0].count ?? 0,
      request_count: counts[i][1].count ?? 0,
      has_login: Boolean(r.user_id),
      user_id: undefined,
      customers: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;

  const body = await req.json().catch(() => null);
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim();
  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const row: Record<string, unknown> = {
    name,
    email,
    title: String(body?.title || '').trim() || null,
    phone: String(body?.phone || '').trim() || null,
  };
  // Only sent once dev-patch-rep-territory.sql has added the column.
  const territory = String(body?.territory || '').trim();
  if (territory) row.territory = territory;

  const { data, error } = await admin
    .from('reps')
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logRepActivity(admin, { repId: data.id, kind: 'joined', summary: 'Added to the team', by: who.email });

  // Optionally give the new rep a login right away
  if (body?.create_login) {
    const result = await createOrResetRepLogin(admin, data);
    if (!result.ok) {
      // The rep card exists; only the login failed (e.g. email already taken)
      return NextResponse.json(
        { rep: data, loginError: result.error },
        { status: 201 }
      );
    }
    return NextResponse.json({ rep: data, credentials: result.credentials }, { status: 201 });
  }

  return NextResponse.json({ rep: data }, { status: 201 });
}
