// Task 21, server only: the link_reads record (rate limit, the server's own copy of a read, who read which link) and taking
// a read into a new request. A request takes what was found and the reference images from here, never from the browser.
import type { SupabaseClient } from '@supabase/supabase-js';
import { REPLICATION_BUCKET } from '@/lib/replication-server';
import { cleanFound, type WebSource } from '@/lib/link-source';

export const LINK_READ_LIMIT = { perHour: 20, usableForMs: 3600_000, keepFilesMs: 24 * 3600_000 };
export const linkReadsProblem = (e: { code?: string; message: string }) =>
  e.code === 'PGRST205' || /link_reads/.test(e.message) ? 'The link reader is not set up yet. Run task-21-link-reads.sql in Supabase.' : e.message;

/** Reference images of reads nobody used, older than a day, are removed (a few at a time, on each new read). */
export async function clearUnusedLinkFiles(admin: SupabaseClient): Promise<void> {
  const before = new Date(Date.now() - LINK_READ_LIMIT.keepFilesMs).toISOString();
  const { data } = await admin.from('link_reads').select('id, image_paths').is('used_at', null).is('files_cleared_at', null).lt('created_at', before).limit(20);
  for (const r of data ?? []) {
    const paths = (r.image_paths as string[] | null) ?? [];
    if (paths.length) await admin.storage.from(REPLICATION_BUCKET).remove(paths);
    await admin.from('link_reads').update({ files_cleared_at: new Date().toISOString() }).eq('id', r.id);
  }
}

export interface LinkPick { readId: string; images: number[] }
export const readLinkPick = (v: unknown): LinkPick | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.readId !== 'string' || !/^[0-9a-f-]{36}$/i.test(o.readId)) return null;
  const images = Array.isArray(o.images) ? Array.from(new Set(o.images.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 20))) : [];
  return { readId: o.readId, images };
};

/** The read an admin may use for a new request: their own, successful, unused, under an hour old, files still there. */
export async function loadUsableRead(admin: SupabaseClient, readId: string, userId: string) {
  const { data } = await admin.from('link_reads').select('*').eq('id', readId).maybeSingle();
  if (!data || data.user_id !== userId || data.result !== 'ok' || data.used_at || data.files_cleared_at) return null;
  if (Date.now() - new Date(data.created_at as string).getTime() > LINK_READ_LIMIT.usableForMs) return null;
  return data as { id: string; url: string; final_url: string; found: Record<string, unknown>; image_paths: string[]; created_at: string };
}

/** Moves the chosen reference images into the request (after claimRead) and returns the web source with their paths. */
export async function takeRead(
  admin: SupabaseClient, read: NonNullable<Awaited<ReturnType<typeof loadUsableRead>>>, pick: LinkPick, requestId: string, by: string,
): Promise<{ webSource: WebSource; images: string[] }> {
  const moved: string[] = [];
  for (const i of [...pick.images].sort((a, b) => a - b)) {
    const from = read.image_paths[i];
    if (!from) continue;
    const to = `${requestId}/web-${Date.now()}-${i + 1}.jpg`;
    const { error } = await admin.storage.from(REPLICATION_BUCKET).move(from, to);
    if (!error) moved.push(to);
  }
  // What was not chosen is removed now.
  const rest = read.image_paths.filter((_, i) => !pick.images.includes(i));
  if (rest.length) await admin.storage.from(REPLICATION_BUCKET).remove(rest);
  await admin.from('link_reads').update({ files_cleared_at: new Date().toISOString() }).eq('id', read.id);
  return { images: moved, webSource: { ...webSourceOf(read, by), referenceImages: moved } };
}

/** Claims a read for one request: one conditional update, so two requests can never take the same read. */
export async function claimRead(admin: SupabaseClient, readId: string, requestId: string): Promise<boolean> {
  const { data } = await admin.from('link_reads').update({ used_by: requestId, used_at: new Date().toISOString() }).eq('id', readId).is('used_at', null).select('id');
  return !!data?.length;
}
export async function unclaimRead(admin: SupabaseClient, readId: string): Promise<void> {
  await admin.from('link_reads').update({ used_by: null, used_at: null }).eq('id', readId);
}

/** The web source to save on the request: the link, when it was read, by whom, and what was found. */
export function webSourceOf(read: NonNullable<Awaited<ReturnType<typeof loadUsableRead>>>, by: string): WebSource {
  const site = (() => { try { return new URL(read.final_url).hostname; } catch { return ''; } })();
  return { url: read.final_url, typedUrl: read.url, site, readAt: read.created_at, readBy: by, found: cleanFound(read.found), referenceImages: [] };
}
