import { NextRequest, NextResponse } from 'next/server';
import { getReplicationActor, unauthorized, canAccess } from '@/lib/replication-access';
import { createAdminClient } from '@/lib/supabase-admin';
import { isValidReplicationId, rowToReplication } from '@/lib/replication-server';
import { loadGarmentLibrary } from '@/lib/garment-types';
import { buildDetectPrompt, detectSchema, readDetection, typeCheckOf, TYPE_CHECK_KEY } from '@/lib/type-check';
import { parseJsonFromModel } from '@/lib/scan-template';
import { loadRequestPhotos, toImageParts, geminiAsker, aiErrorResponse } from '@/lib/scan-server';

// Task 28, step 1: a quick AI pass that SUGGESTS the product type from the request's photos (only when an admin asks).
// The suggestion is saved on the request (specs.typeCheck.suggestion, admin only) and never changes the type: the admin
// confirms it, or picks another, through /api/replications/[id]/type. Admin only, like the scan (task 33).
export const maxDuration = 120;
const DETECT_BUDGET_MS = 100_000;
const DETECT_PHOTOS = 4; // a quick look: the first photos (the main photo is first)

export async function POST(req: NextRequest) {
  const deadline = Date.now() + DETECT_BUDGET_MS;
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  if (actor.kind !== 'admin') return NextResponse.json({ error: 'The AI type suggestion is run by RIVIX admin.' }, { status: 403 });

  try {
    const body = await req.json().catch(() => null);
    if (!isValidReplicationId(body?.replicationId)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
    const admin = createAdminClient();
    const { data: row } = await admin.from('replications').select('*').eq('id', body.replicationId).maybeSingle();
    if (!row || !canAccess(actor, row)) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });

    const photos = await loadRequestPhotos(admin, row.images, DETECT_PHOTOS);
    if (photos.length === 0) return NextResponse.json({ error: 'Add photos to the request first: the suggestion is made from them.' }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    const parts = toImageParts(photos);
    if (!parts) return NextResponse.json({ error: 'A photo could not be read.' }, { status: 400 });

    // Only active types can be suggested (the answer format allows nothing else).
    const lib = await loadGarmentLibrary(admin);
    const types = lib.types.filter((t) => t.active).map((t) => ({ key: t.key, label: t.label, category: t.category }));
    const gemini = geminiAsker(parts, deadline);
    const text = await gemini.ask(buildDetectPrompt({ types, categories: lib.categories, photoCount: photos.length }), detectSchema(types));
    let raw: unknown = null;
    try { raw = text ? parseJsonFromModel(text) : null; } catch { raw = null; }
    const suggestion = readDetection(raw, types, gemini.result.model);
    if (!suggestion) return NextResponse.json({ error: 'The AI answer could not be read. Try again, or pick the type by hand.' }, { status: 502 });

    const specs = { ...(row.specs && typeof row.specs === 'object' ? row.specs : {}), [TYPE_CHECK_KEY]: { ...(typeCheckOf(row.specs) ?? {}), suggestion } };
    const { data, error } = await admin.from('replications').update({ specs, updated_at: new Date().toISOString() }).eq('id', row.id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ suggestion, replication: await rowToReplication(admin, data, 'admin'), ...(gemini.result.note ? { note: gemini.result.note } : {}) });
  } catch (error) {
    console.error('Error suggesting the product type:', error);
    return aiErrorResponse(error, 'suggest the product type', 'Could not suggest a product type. Pick it by hand.');
  }
}
