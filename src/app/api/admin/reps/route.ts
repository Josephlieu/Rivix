import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { createOrResetRepLogin } from '@/lib/rep-login';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: reps, error } = await admin
    .from('reps')
    .select('*, customers(count)')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    reps: (reps || []).map((r: any) => ({
      ...r,
      customer_count: r.customers?.[0]?.count ?? 0,
      has_login: Boolean(r.user_id),
      user_id: undefined,
      customers: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim();
  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('reps')
    .insert({
      name,
      email,
      title: String(body?.title || '').trim() || null,
      phone: String(body?.phone || '').trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
