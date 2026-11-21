// Supplier and product records (2026-11-21): the shared start of every admin route: a two-step admin, the server's client,
// and the audit actor. Server only.
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { adminActor, type AuditActor } from '@/lib/audit';
import { sameValue } from '@/lib/catalog-fields';

export type Ctx = { admin: SupabaseClient; actor: AuditActor; who: { userId: string; email: string } };
export async function adminCtx(): Promise<Ctx | NextResponse> {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  return { admin: createAdminClient(), actor: adminActor(who), who };
}
export const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });
export const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const readJson = async (req: Request): Promise<Record<string, unknown> | null> => {
  const b = await req.json().catch(() => null);
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
};
/** before/after of the changed columns only. */
export function beforeAfter(before: Record<string, unknown>, values: Record<string, unknown>) {
  const b: Record<string, unknown> = {}, a: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) { if (!sameValue(before[k], v)) { b[k] = before[k] ?? null; a[k] = v ?? null; } }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}
