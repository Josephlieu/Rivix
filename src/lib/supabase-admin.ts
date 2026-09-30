import { createClient } from '@supabase/supabase-js';

// Server-only. Uses the service role key, which bypasses row-level security.
// Only ever import this from API routes, and only AFTER requireAdmin() passes.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
