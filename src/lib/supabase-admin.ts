import { createClient } from '@supabase/supabase-js';
import { pickSecretKey } from './supabase-keys';

// Server-only. The secret key bypasses row-level security. Only ever import this from API routes, and only AFTER the
// route's own checks (requireAdmin() and the like) pass.
// The new secret key (sb_secret_…) is read first; the legacy service_role key is the fallback until live has switched
// (audit-docs/33-go-live.md, step 8).
export function supabaseSecretKey(): string {
  return pickSecretKey(process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseSecretKey(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
