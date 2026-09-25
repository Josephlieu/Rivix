import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cookie-backed client for auth flows (login, sign-out), so the session
// is readable by middleware — the plain client in `supabase.ts` stores
// the session in localStorage only, which middleware can't see.
export const supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey);
