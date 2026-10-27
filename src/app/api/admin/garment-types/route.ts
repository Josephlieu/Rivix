import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { clearGarmentCache, loadGarmentLibrary } from '@/lib/garment-types';

const NOT_READY = 'The garment library is not set up on this database yet. Run dev-patch-garment-types.sql in the Supabase SQL Editor first.';

const slug = (label: string) => label.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// Admin adds a garment type (for example when the product range grows). The key is made from the name and never changes afterwards.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const label = String(body?.label ?? '').trim().slice(0, 80);
  const category = String(body?.category ?? '');
  if (!label) return NextResponse.json({ error: 'Type a name for the garment type.' }, { status: 400 });

  const admin = createAdminClient();
  const lib = await loadGarmentLibrary(admin);
  if (!lib.fromDatabase) return NextResponse.json({ error: NOT_READY }, { status: 409 });
  if (!lib.categories.some((c) => c.key === category)) return NextResponse.json({ error: 'Choose a category.' }, { status: 400 });
  if (lib.types.some((t) => t.label.toLowerCase() === label.toLowerCase())) return NextResponse.json({ error: 'There is already a garment type with that name.' }, { status: 409 });

  const base = slug(label) || 'garment';
  let key = base;
  for (let n = 2; lib.types.some((t) => t.key === key); n++) key = `${base}-${n}`;
  const sort = Math.max(0, ...lib.types.map((t) => t.sort)) + 10;

  const { data, error } = await admin.from('garment_types').insert({ key, label, category, sort }).select('key, label, category, sort, active').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  clearGarmentCache();
  return NextResponse.json({ type: data }, { status: 201 });
}
