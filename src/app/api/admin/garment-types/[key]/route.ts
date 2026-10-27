import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { clearGarmentCache, loadGarmentLibrary } from '@/lib/garment-types';

// Rename a type, move it to another category, switch it on or off, or move it up or down inside its category.
// Types are never deleted: older requests keep their type. Switching one off only hides it from the new-request form.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { key } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const admin = createAdminClient();
  const lib = await loadGarmentLibrary(admin);
  if (!lib.fromDatabase) return NextResponse.json({ error: 'The garment library is not set up on this database yet. Run dev-patch-garment-types.sql first.' }, { status: 409 });
  const type = lib.types.find((t) => t.key === key);
  if (!type) return NextResponse.json({ error: 'Garment type not found.' }, { status: 404 });

  const update: Record<string, unknown> = {};
  if ('label' in body) {
    const label = String(body.label ?? '').trim().slice(0, 80);
    if (!label) return NextResponse.json({ error: 'The name cannot be empty.' }, { status: 400 });
    if (lib.types.some((t) => t.key !== key && t.label.toLowerCase() === label.toLowerCase())) return NextResponse.json({ error: 'There is already a garment type with that name.' }, { status: 409 });
    update.label = label;
  }
  if ('category' in body) {
    if (!lib.categories.some((c) => c.key === body.category)) return NextResponse.json({ error: 'Choose a category.' }, { status: 400 });
    update.category = body.category;
  }
  if ('active' in body) update.active = Boolean(body.active);

  if (body.move === 'up' || body.move === 'down') {
    const mates = lib.types.filter((t) => t.category === (update.category ?? type.category)).sort((a, b) => a.sort - b.sort);
    const i = mates.findIndex((t) => t.key === key);
    const other = mates[body.move === 'up' ? i - 1 : i + 1];
    if (other) {
      const { error } = await admin.from('garment_types').update({ sort: other.sort, updated_at: new Date().toISOString() }).eq('key', key);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await admin.from('garment_types').update({ sort: type.sort, updated_at: new Date().toISOString() }).eq('key', other.key);
    }
  }

  if (Object.keys(update).length) {
    const { error } = await admin.from('garment_types').update({ ...update, updated_at: new Date().toISOString() }).eq('key', key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  clearGarmentCache();
  return NextResponse.json({ ok: true });
}
