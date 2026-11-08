import type { SupabaseClient } from '@supabase/supabase-js';
import { CATALOG_BUCKET, MAX_CATALOG_BYTES } from '@/lib/catalogs';

// A catalog upload path is "<uuid>-<safe file name>" at the top of the bucket. Anything else (folders, "..",
// another bucket's path) is refused, so a record can never point at a file the admin did not just upload here.
const PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[\w.\-]{1,100}$/;
export const isCatalogPath = (p: string) => PATH_RE.test(p) && !p.includes('..');

// Confirms the file really arrived in storage and returns its size and type as storage reports them (not the browser).
// Removes a file that is too big. Returns an error message for the admin when something is wrong.
export async function checkUploadedCatalog(admin: SupabaseClient, path: string): Promise<{ ok: true; size: number | null; mime: string | null } | { ok: false; error: string }> {
  if (!isCatalogPath(path)) return { ok: false, error: 'Invalid file path.' };
  const { data: found } = await admin.storage.from(CATALOG_BUCKET).list('', { search: path, limit: 5 });
  const obj = found?.find((f) => f.name === path);
  if (!obj) return { ok: false, error: 'The upload did not finish. Please try again.' };
  const meta = (obj.metadata || {}) as { size?: number; mimetype?: string };
  const size = Number(meta.size ?? 0) || null;
  const mime = meta.mimetype || null;
  if ((size && size > MAX_CATALOG_BYTES) || (mime && mime !== 'application/pdf')) {
    await admin.storage.from(CATALOG_BUCKET).remove([path]);
    return { ok: false, error: 'Catalogs must be PDF files of 50 MB or less.' };
  }
  return { ok: true, size, mime };
}
