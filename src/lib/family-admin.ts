// Product families, admin side (2026-11-26). Server only. Every write is audit-logged by the routes.
import type { SupabaseClient } from '@supabase/supabase-js';
import { FAMILY_ADMIN_COLUMNS, IMAGE_COLUMNS } from '@/lib/catalog-families';
import { backedByFamily } from '@/lib/catalog-public';

export async function activeCategoryKeys(admin: SupabaseClient): Promise<Array<{ key: string; label: string }>> {
  const { data } = await admin.from('garment_categories').select('key, label').eq('active', true).order('sort');
  return (data ?? []) as Array<{ key: string; label: string }>;
}

/** Everything an admin sees about one family: details, images, standards (with whether customers see each one), products. */
export async function familyDetail(admin: SupabaseClient, id: string) {
  const { data: family } = await admin.from('product_families').select(FAMILY_ADMIN_COLUMNS).eq('id', id).maybeSingle();
  if (!family) return null;
  const [imgs, fs, prods, backed] = await Promise.all([
    admin.from('family_images').select(IMAGE_COLUMNS).eq('family_id', id).order('sort').order('created_at'),
    admin.from('family_standards').select('standard_id, standard:standards(id, designation, checked)').eq('family_id', id),
    admin.from('products').select('id, code, name, active').eq('family_id', id).order('name'),
    backedByFamily(admin, [id]),
  ]);
  const shown = new Set(backed.get(id) ?? []);
  return {
    family,
    images: imgs.data ?? [],
    standards: ((fs.data ?? []) as unknown as Array<{ standard_id: string; standard: { id: string; designation: string; checked: boolean } | null }>)
      .filter((r) => r.standard).map((r) => ({ id: r.standard!.id, designation: r.standard!.designation, checked: r.standard!.checked, shownToCustomers: shown.has(r.standard!.designation) })),
    products: prods.data ?? [],
  };
}
