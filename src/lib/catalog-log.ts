// Server only (task 31): every change an admin makes to the catalog (a category, a product type, a template) is recorded:
// who, when, what changed and their note. The table is append-only (the database refuses edits and deletes).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CatalogChange { kind: 'category' | 'type' | 'template'; key: string; action: string; changes?: string[]; note?: string }

/** Records one change. Returns false (and logs) when it could not be recorded; the caller reports that to the admin. */
export async function recordCatalogChange(admin: SupabaseClient, who: { userId: string; email: string }, c: CatalogChange): Promise<boolean> {
  const { error } = await admin.from('catalog_changes').insert({
    kind: c.kind, target_key: c.key.slice(0, 80), action: c.action.slice(0, 200), changes: (c.changes ?? []).slice(0, 200).map((x) => String(x).slice(0, 300)),
    note: (c.note ?? '').slice(0, 2000), by_user: who.userId, by_email: who.email,
  });
  if (error) { console.error('catalog change not recorded:', error.message); return false; }
  return true;
}
export const NOT_RECORDED = 'The change was saved, but it could not be recorded in the change log. Tell the developer.';
