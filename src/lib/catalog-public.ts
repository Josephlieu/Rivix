// The customer catalogue, server side (2026-11-26). Who is looking (customer, rep or two-step admin, from the session only)
// and the customer-safe view of a family. The view is built field by field from a fixed list: a database row is never
// spread into a response, so a column added later can never leak. Never: supplier, product, cost, margin, factory fields.
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { readAdminSession, TWO_STEP_REQUIRED } from '@/lib/admin-session';
import { isRepUser } from '@/lib/admin-auth';
import { CUSTOMER_COLUMNS, type CurrentCustomer } from '@/lib/session-customer';
import { businessToday, type CertFacts } from '@/lib/compliance';
import { FAMILY_PUBLIC_COLUMNS, SETTINGS_COLUMNS, backedStandards, type OptionGroup, type Settings } from '@/lib/catalog-families';

export type Viewer =
  | { kind: 'customer'; admin: SupabaseClient; customer: CurrentCustomer; userId: string; email: string }
  | { kind: 'rep'; admin: SupabaseClient; rep: { id: string; name: string }; userId: string; email: string }
  | { kind: 'admin'; admin: SupabaseClient; userId: string; email: string };

/** Anyone signed in who may browse the catalogue. A password-only admin must finish the two-step sign-in first. */
export async function catalogViewer(): Promise<Viewer | { denied: NextResponse }> {
  const supabase = await createSupabaseServerClient();
  const sess = await readAdminSession(supabase);
  const user = sess.user;
  if (!user) return { denied: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  const admin = createAdminClient();
  const email = (user.email || '').toLowerCase();
  if (sess.isAdmin) {
    if (!sess.trusted) return { denied: NextResponse.json({ error: TWO_STEP_REQUIRED, code: 'mfa_required' }, { status: 401 }) };
    return { kind: 'admin', admin, userId: user.id, email };
  }
  if (isRepUser(user)) {
    const { data } = await admin.from('reps').select('id, name, active').eq('user_id', user.id).maybeSingle();
    if (!data || !data.active) return { denied: NextResponse.json({ error: 'Only active sales reps can see the catalogue.' }, { status: 403 }) };
    return { kind: 'rep', admin, rep: { id: data.id, name: data.name }, userId: user.id, email };
  }
  const { data } = await admin.from('customers').select(CUSTOMER_COLUMNS).eq('user_id', user.id).maybeSingle();
  if (!data) return { denied: NextResponse.json({ error: 'Only customers can use this.' }, { status: 403 }) };
  return { kind: 'customer', admin, customer: data as CurrentCustomer, userId: user.id, email };
}

export const today = () => businessToday(new Date());

export async function loadSettings(admin: SupabaseClient): Promise<Settings & { updated_at?: string; updated_by_email?: string | null }> {
  const { data } = await admin.from('catalog_settings').select(SETTINGS_COLUMNS).eq('id', 1).maybeSingle();
  return data ? (data as Settings & { updated_at: string; updated_by_email: string | null }) : { min_order_qty: 50, note_below_qty: 300 };
}

/** The standards customers may see, per family (only those backed by a Compliant claim of an active linked product).
 *  One round of queries: the claims and certificates are read through their product's family. */
export async function backedByFamily(admin: SupabaseClient, familyIds: string[], day = today()): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(familyIds.map((id) => [id, []]));
  if (!familyIds.length) return out;
  const [fs, prods, cl, ce] = await Promise.all([
    admin.from('family_standards').select('family_id, standard_id, standard:standards(designation, checked)').in('family_id', familyIds),
    admin.from('products').select('id, active, family_id').in('family_id', familyIds),
    admin.from('product_compliance').select('product_id, standard_id, product:products!inner(family_id)').in('product.family_id', familyIds),
    admin.from('certificates').select('product_id, standard_id, status, expires_on, document_type, product:products!inner(family_id)').in('product.family_id', familyIds),
  ]);
  const products = (prods.data ?? []) as Array<{ id: string; active: boolean; family_id: string }>;
  const claims = ((cl.data ?? []) as unknown as Array<{ product_id: string; standard_id: string }>).map((c) => ({ product_id: c.product_id, standard_id: c.standard_id }));
  const certs = ((ce.data ?? []) as unknown as CertFacts[]).map((c) => ({ product_id: c.product_id, standard_id: c.standard_id, status: c.status, expires_on: c.expires_on, document_type: c.document_type }));
  const rows = (fs.data ?? []) as unknown as Array<{ family_id: string; standard_id: string; standard: { designation: string; checked: boolean } | null }>;
  for (const id of familyIds) {
    const mine = rows.filter((r) => r.family_id === id && r.standard).map((r) => ({ standard_id: r.standard_id, designation: r.standard!.designation, checked: r.standard!.checked }));
    out.set(id, backedStandards(mine, products.filter((p) => p.family_id === id), claims, certs, day));
  }
  return out;
}

export type FamilyRow = { id: string; code: string; name: string; category: string; description: string | null; typical_options: OptionGroup[]; typical_sizes: string[]; typical_colours: string[]; sort: number };
export type FamilyView = {
  id: string; code: string; name: string; category: string; categoryLabel: string; description: string | null;
  typicalOptions: OptionGroup[]; typicalSizes: string[]; typicalColours: string[]; imageIds: string[]; standards: string[];
};
/** The customer-safe object: exactly these keys, nothing else. */
export function familyView(r: FamilyRow, labels: Map<string, string>, imageIds: string[], standards: string[]): FamilyView {
  return {
    id: r.id, code: r.code, name: r.name, category: r.category, categoryLabel: labels.get(r.category) ?? r.category,
    description: r.description ?? null,
    typicalOptions: (Array.isArray(r.typical_options) ? r.typical_options : []).map((g) => ({ label: String(g.label), choices: (g.choices ?? []).map(String) })),
    typicalSizes: [...(r.typical_sizes ?? [])], typicalColours: [...(r.typical_colours ?? [])], imageIds: [...imageIds], standards: [...standards],
  };
}

/** Published (visible and active) families, as customer-safe views. `ids` limits the list; q matches name or code.
 *  With `ids` everything is read in one round of queries; without, in two. */
export async function publishedFamilies(admin: SupabaseClient, opts: { q?: string; category?: string; ids?: string[] } = {}): Promise<FamilyView[]> {
  if (opts.ids && !opts.ids.length) return [];
  let q = admin.from('product_families').select(FAMILY_PUBLIC_COLUMNS).eq('visible_to_customers', true).eq('active', true).order('sort').order('name');
  if (opts.category) q = q.eq('category', opts.category);
  if (opts.ids) q = q.in('id', opts.ids);
  const imagesOf = (ids: string[]) => admin.from('family_images').select('id, family_id, sort').in('family_id', ids).order('sort').order('created_at');
  const [{ data }, cats, early, earlyStd] = await Promise.all([
    q, admin.from('garment_categories').select('key, label'),
    opts.ids ? imagesOf(opts.ids) : Promise.resolve(null), opts.ids ? backedByFamily(admin, opts.ids) : Promise.resolve(null),
  ]);
  const term = (opts.q ?? '').trim().toLowerCase();
  const rows = ((data ?? []) as unknown as FamilyRow[]).filter((r) => !term || r.name.toLowerCase().includes(term) || r.code.toLowerCase().includes(term));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [imgs, std] = early && earlyStd ? [early, earlyStd] : await Promise.all([imagesOf(ids), backedByFamily(admin, ids)]);
  const labels = new Map(((cats.data ?? []) as Array<{ key: string; label: string }>).map((c) => [c.key, c.label]));
  return rows.map((r) => familyView(r, labels, ((imgs.data ?? []) as Array<{ id: string; family_id: string }>).filter((i) => i.family_id === r.id).map((i) => i.id), std.get(r.id) ?? []));
}
export async function publishedFamily(admin: SupabaseClient, id: string): Promise<FamilyView | null> {
  return (await publishedFamilies(admin, { ids: [id] }))[0] ?? null;
}
