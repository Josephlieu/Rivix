import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  // Only these fields can be changed — anything else in the body is ignored.
  const update: Record<string, unknown> = {};
  for (const key of ['name', 'title', 'email', 'phone'] as const) {
    if (key in body) update[key] = String(body[key] ?? '').trim() || null;
  }
  // The email is the rep's sign-in, so once a login exists it can't be changed.
  if ('email' in update) {
    const { data: existing } = await createAdminClient().from('reps').select('email, user_id').eq('id', id).maybeSingle();
    if (existing?.user_id) {
      if (String(update.email).toLowerCase() !== existing.email.toLowerCase()) {
        return NextResponse.json({ error: "This rep's email is their login and can't be changed." }, { status: 400 });
      }
      delete update.email;
    }
  }
  if ('active' in body) update.active = Boolean(body.active);
  if ((update.name === null) || (update.email === null)) {
    return NextResponse.json({ error: 'Name and email cannot be empty.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from('reps').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A disabled rep must not be able to sign in. Reps don't have logins yet
  // (user_id is empty), so today this does nothing — it starts applying as
  // soon as a rep is linked to a login.
  if ('active' in update && data.user_id) {
    await admin.auth.admin.updateUserById(data.user_id, {
      ban_duration: update.active ? 'none' : '876000h',
    });
  }

  return NextResponse.json({ rep: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: rep } = await admin.from('reps').select('id, name, user_id').eq('id', id).maybeSingle();
  if (!rep) return NextResponse.json({ error: 'Rep not found.' }, { status: 404 });

  // Never delete a rep who still has customers — the customers would silently
  // lose their rep. Reassign them, or disable the rep instead.
  const { count, error: countErr } = await admin
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('rep_id', id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `${rep.name} still has ${count} customer${count === 1 ? '' : 's'}. Reassign them first, or disable the rep instead.`,
      },
      { status: 409 }
    );
  }

  const { error } = await admin.from('reps').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Remove the rep's login too, if they had one, so it isn't left orphaned.
  if (rep.user_id) await admin.auth.admin.deleteUser(rep.user_id);

  return NextResponse.json({ success: true });
}
