import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getReplicationActor, unauthorized } from '@/lib/replication-access';
import { loadGarmentLibrary } from '@/lib/garment-types';
import { getTemplateCatalog } from '@/lib/template-store';

// The garment categories and types for the new-request form. Admins and sales reps get the active types; an admin can ask for
// all of them (?all=1) to manage the list. Before the SQL for the library has been run, the built-in list is returned.
export async function GET(req: NextRequest) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  const admin = createAdminClient();
  const [lib, templates] = await Promise.all([loadGarmentLibrary(admin), getTemplateCatalog(admin)]);
  const all = actor.kind === 'admin' && req.nextUrl.searchParams.get('all') === '1';
  return NextResponse.json({
    categories: lib.categories,
    types: all ? lib.types : lib.types.filter((t) => t.active),
    editable: lib.fromDatabase,
    templates, // the template catalog (task 26): the screens resolve a type's template from it
  });
}
