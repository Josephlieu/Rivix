import { NextRequest, NextResponse } from 'next/server';
import { getReplicationActor, unauthorized, notFound, canAccess } from '@/lib/replication-access';
import { createAdminClient } from '@/lib/supabase-admin';
import { isValidReplicationId, rowToReplication } from '@/lib/replication-server';
import { loadGarmentLibrary } from '@/lib/garment-types';
import { typeCheckOf, TYPE_CHECK_KEY } from '@/lib/type-check';

// Task 28, step 1: an admin confirms the request's product type (the AI suggestion, or one picked by hand). Only an active type
// can be confirmed. Who confirmed and when are set here, never by the browser. The AI scan refuses to run until this is done.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  if (actor.kind !== 'admin') return NextResponse.json({ error: 'The product type is confirmed by RIVIX admin.' }, { status: 403 });

  const { id } = await params;
  if (!isValidReplicationId(id)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
  const body = await req.json().catch(() => null);
  const typeKey = typeof body?.typeKey === 'string' ? body.typeKey : '';

  const admin = createAdminClient();
  const { data: row } = await admin.from('replications').select('*').eq('id', id).maybeSingle();
  if (!row || !canAccess(actor, row)) return notFound();
  const lib = await loadGarmentLibrary(admin);
  if (!lib.types.some((t) => t.key === typeKey && t.active)) return NextResponse.json({ error: 'Choose an active product type from the list.' }, { status: 400 });

  const specs = {
    ...(row.specs && typeof row.specs === 'object' ? row.specs : {}),
    [TYPE_CHECK_KEY]: { ...(typeCheckOf(row.specs) ?? {}), confirmedType: typeKey, confirmedBy: actor.name || actor.email, confirmedAt: new Date().toISOString() },
  };
  const { data, error } = await admin.from('replications').update({ garment_type: typeKey, specs, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ replication: await rowToReplication(admin, data, 'admin') });
}
