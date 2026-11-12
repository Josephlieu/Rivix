import { createBrowserClient } from '@supabase/ssr';
import { supabasePublicKey } from './supabase-keys';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = supabasePublicKey(); // new publishable key, legacy anon as fallback

// Cookie-backed client for auth flows (login, sign-out), so the session
// is readable by middleware — the plain client in `supabase.ts` stores
// the session in localStorage only, which middleware can't see.
export const supabaseBrowser = createBrowserClient(supabaseUrl, supabasePublishableKey);
