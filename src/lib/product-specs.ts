import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_DOC_BYTES } from '@/lib/documents';
import { MAX_FABRIC_LEN, normalizeStandard } from '@/lib/safety-standards';

// Product specifications: admin-managed, one customer each. Files live in the private 'product-specs' bucket at
// "<customer_id>/<uuid>-<safe name>"; customers open their own through a signed link.
export const SPEC_BUCKET = 'product-specs';
export const SPEC_COLUMNS = 'id, customer_id, product_name, fabric, safety_standard, description, file_url, file_label, created_at';

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// Checks the editable text fields of a spec. `partial` = only the keys present in the body (an edit).
export function checkSpecFields(body: Record<string, unknown>, partial: boolean): { ok: true; values: Record<string, string | null> } | { ok: false; error: string } {
  const out: Record<string, string | null> = {};
  if (!partial || 'product_name' in body) {
    const name = clean(body.product_name, 200);
    if (!name) return { ok: false, error: 'Enter a product name.' };
    out.product_name = name;
  }
  if (!partial || 'fabric' in body) {
    const f = String(body.fabric ?? '').trim();
    if (f.length > MAX_FABRIC_LEN) return { ok: false, error: `Fabric can be at most ${MAX_FABRIC_LEN} characters.` };
    out.fabric = f || null;
  }
  if (!partial || 'safety_standard' in body) {
    const s = normalizeStandard(body.safety_standard);
    if (s && s.length > 200) return { ok: false, error: 'Safety standard can be at most 200 characters.' };
    out.safety_standard = s;
  }
  if (!partial || 'description' in body) out.description = clean(body.description, 2000) || null;
  if (!partial || 'file_label' in body) out.file_label = clean(body.file_label, 100) || null;
  return { ok: true, values: out };
}

// Confirms an uploaded spec file is inside THIS customer's folder and really arrived. Removes it when too big.
export async function checkUploadedSpecFile(admin: SupabaseClient, customerId: string, path: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const prefix = `${customerId}/`;
  const name = path.slice(prefix.length);
  if (!path.startsWith(prefix) || path.includes('..') || !name || name.includes('/')) return { ok: false, error: 'Invalid file path.' };
  const { data: found } = await admin.storage.from(SPEC_BUCKET).list(customerId, { search: name, limit: 5 });
  const obj = found?.find((f) => f.name === name);
  if (!obj) return { ok: false, error: 'The upload did not finish. Please try again.' };
  const size = Number((obj.metadata as { size?: number } | null)?.size ?? 0);
  if (size > MAX_DOC_BYTES) {
    await admin.storage.from(SPEC_BUCKET).remove([path]);
    return { ok: false, error: 'Files must be 20 MB or smaller.' };
  }
  return { ok: true };
}

// The specs used as product suggestions in the New Order form. repId given: ONLY specs whose customer is assigned to
// that rep (filtered here, on the server; the browser never gets anyone else's).
export async function specSuggestions(admin: SupabaseClient, repId?: string) {
  let q = admin.from('product_specs').select('customer_id, product_name, fabric, safety_standard, customers!inner(rep_id)').order('product_name');
  if (repId) q = q.eq('customers.rep_id', repId);
  const { data } = await q;
  return (data || []).map((s) => ({ customer_id: s.customer_id as string, product_name: s.product_name as string, fabric: (s.fabric as string | null) ?? null, safety_standard: (s.safety_standard as string | null) ?? null }));
}
export type SpecSuggestion = Awaited<ReturnType<typeof specSuggestions>>[number];
