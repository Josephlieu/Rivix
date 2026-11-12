import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase-admin';
import { getReplicationActor, unauthorized } from '@/lib/replication-access';
import { REPLICATION_BUCKET } from '@/lib/replication-server';
import { checkLink, LinkError, GENERIC_LINK_MESSAGE } from '@/lib/safe-fetch';
import { readProductLink } from '@/lib/link-import';
import { linkReadsProblem, clearUnusedLinkFiles, LINK_READ_LIMIT } from '@/lib/link-reads-server';

export const maxDuration = 60;

// Task 21: read a product page from a link (two-step admins only). The page and its images are fetched through the guarded
// fetcher (src/lib/safe-fetch.ts); every read is recorded in link_reads (also refusals, with the reason, on the server only).
// The admin gets what was found, small previews of the images and a read id; the request takes the rest from link_reads.
export async function POST(req: NextRequest) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  if (actor.kind !== 'admin') return NextResponse.json({ error: 'Reading a website link is for RIVIX admins.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const typed = typeof body?.url === 'string' ? body.url.trim().slice(0, 4000) : '';
  const shape = checkLink(typed);
  if (!shape.ok) return NextResponse.json({ error: shape.message }, { status: 400 });

  const admin = createAdminClient();
  // Rate limit per admin: reads in the last hour (refused reads count too).
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countErr } = await admin.from('link_reads').select('id', { count: 'exact', head: true }).eq('user_id', actor.userId).gte('created_at', since);
  if (countErr) return NextResponse.json({ error: linkReadsProblem(countErr) }, { status: 500 });
  if ((count ?? 0) >= LINK_READ_LIMIT.perHour) return NextResponse.json({ error: `You have read ${LINK_READ_LIMIT.perHour} links in the last hour. Try again later.` }, { status: 429 });
  await clearUnusedLinkFiles(admin);

  const id = randomUUID();
  const record = (result: string, extra: Record<string, unknown> = {}) =>
    admin.from('link_reads').insert({ id, user_id: actor.userId, url: shape.url.toString().slice(0, 2000), result: result.slice(0, 200), ...extra });

  let read;
  try {
    read = await readProductLink(shape.url.toString());
  } catch (e) {
    // The exact reason stays on the server. The admin gets the same message whatever happened (DNS, address, connection,
    // status, size, time), so the answer cannot be used to probe internal systems.
    await record(e instanceof LinkError ? e.reason : 'failed');
    return NextResponse.json({ error: GENERIC_LINK_MESSAGE }, { status: 422 });
  }

  // The reference images are kept by the server until a request takes them (or they are cleared after a day).
  const paths: string[] = [];
  for (const [i, img] of read.images.entries()) {
    const path = `link-reads/${id}/${i + 1}.jpg`;
    const { error } = await admin.storage.from(REPLICATION_BUCKET).upload(path, img.jpeg, { contentType: 'image/jpeg', upsert: false });
    if (error) break;
    paths.push(path);
  }
  const { error: insErr } = await record('ok', { final_url: read.finalUrl.slice(0, 2000), found: { ...read.found, site: read.site, imageSources: read.images.slice(0, paths.length).map((x) => x.source) }, image_paths: paths });
  if (insErr) {
    if (paths.length) await admin.storage.from(REPLICATION_BUCKET).remove(paths);
    return NextResponse.json({ error: linkReadsProblem(insErr) }, { status: 500 });
  }
  return NextResponse.json({
    readId: id,
    finalUrl: read.finalUrl,
    site: read.site,
    found: read.found,
    images: read.images.slice(0, paths.length).map((x, i) => ({ index: i, thumb: x.thumb, width: x.width, height: x.height })),
    notes: read.notes,
  });
}
