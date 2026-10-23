import { NextRequest, NextResponse } from 'next/server';
import { getReplicationActor, unauthorized, notFound, canAccess } from '@/lib/replication-access';
import { createAdminClient } from '@/lib/supabase-admin';
import { isValidReplicationId, rowToReplication, MAX_PHOTO_BYTES, MAX_PHOTOS, PHOTO_TYPES, REPLICATION_BUCKET } from '@/lib/replication-server';

// Check the bytes really are the image type claimed, not just a file named like one.
function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

// Add one photo (JPEG, PNG or WebP, up to 4 MB). The request must already be saved.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();

  const { id } = await params;
  if (!isValidReplicationId(id)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No photo was sent.' }, { status: 400 });
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'Photos must be 4 MB or smaller.' }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) return NextResponse.json({ error: 'Only JPEG, PNG or WebP photos can be added.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin.from('replications').select('*').eq('id', id).maybeSingle();
  if (!row || !canAccess(actor, row)) return notFound();
  const current: string[] = Array.isArray(row.images) ? row.images : [];
  if (current.length >= MAX_PHOTOS) return NextResponse.json({ error: `A request can hold up to ${MAX_PHOTOS} photos.` }, { status: 400 });

  const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${PHOTO_TYPES[type]}`;
  const { error: upErr } = await admin.storage.from(REPLICATION_BUCKET).upload(path, bytes, { contentType: type });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data, error } = await admin
    .from('replications')
    .update({ images: [...current, path], updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    await admin.storage.from(REPLICATION_BUCKET).remove([path]); // don't leave an orphan file
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ replication: await rowToReplication(admin, data) });
}
