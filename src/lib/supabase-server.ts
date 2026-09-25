import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side client for Server Components (read-only cookie access —
// can't set cookies here, only in middleware/route handlers/actions).
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op: Server Components can't set cookies. The proxy already
          // refreshes the session on every /portal request, so this is safe.
        },
      },
    }
  );
}
