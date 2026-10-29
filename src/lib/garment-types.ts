import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_GARMENT_CATEGORIES, DEFAULT_GARMENT_TYPES, type GarmentCategory, type GarmentType } from '@/lib/garment-types-data';

// Server side of the garment library. The list lives in two tables (dev-patch-garment-types.sql); until that SQL has been run the
// built-in list is used, read-only, so the Replication Queue keeps working. A short cache keeps the form fast; every change by an admin clears it.
export interface GarmentLibrary { categories: GarmentCategory[]; types: GarmentType[]; fromDatabase: boolean }

let cache: { at: number; lib: GarmentLibrary } | null = null;
const TTL_MS = 30_000;
export const clearGarmentCache = () => { cache = null; };

export async function loadGarmentLibrary(admin: SupabaseClient): Promise<GarmentLibrary> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.lib;
  const typeQuery = (cols: string) => admin.from('garment_types').select(cols).order('sort', { ascending: true });
  const [c, first] = await Promise.all([
    admin.from('garment_categories').select('key, label, sort').order('sort', { ascending: true }),
    typeQuery('key, label, category, sort, active, template_family'),
  ]);
  // Until dev-patch-garment-families.sql has been run the column is missing: read without it (families then come from the built-in mapping).
  const t = first.error ? await typeQuery('key, label, category, sort, active') : first;
  const lib: GarmentLibrary = c.error || t.error || !t.data?.length
    ? { categories: DEFAULT_GARMENT_CATEGORIES, types: DEFAULT_GARMENT_TYPES, fromDatabase: false }
    : { categories: c.data as GarmentCategory[], types: (t.data as unknown as Array<GarmentType & { template_family?: string | null }>).map(({ template_family, ...x }) => ({ ...x, templateFamily: template_family ?? null })), fromDatabase: true };
  cache = { at: Date.now(), lib };
  return lib;
}

/** Keys a request may be saved with: every active type, plus the type the request already has (it may have been switched off since). */
export async function allowedGarmentKeys(admin: SupabaseClient, currentKey?: string | null): Promise<string[]> {
  const { types } = await loadGarmentLibrary(admin);
  const keys = types.filter((x) => x.active).map((x) => x.key);
  if (currentKey && !keys.includes(currentKey)) keys.push(currentKey);
  return keys;
}
