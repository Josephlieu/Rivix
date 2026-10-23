import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side client for Server Components and route handlers. It saves a refreshed sign-in token where cookies can be
// set (route handlers, actions) and quietly skips it in Server Components.
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
        setAll(cookiesToSet) {
          // Route handlers (the /api routes) CAN set cookies: when the 1-hour sign-in token has expired and the library
          // refreshes it, the new token must reach the browser, otherwise the old refresh token is used up and the user
          // is logged out. Server Components cannot set cookies (this throws and is ignored): the proxy refreshes the
          // session on every page navigation there.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // a Server Component: nothing to do
          }
        },
      },
    }
  );
}

// Server client for ROUTE HANDLERS (the /api routes). Unlike Server Components, a route handler can set cookies, so when
// the sign-in token has expired and the library refreshes it, the new token is sent back to the browser. Without this the
// refreshed token is thrown away, the old refresh token is used up, and later requests fail with "Unauthorized" until the
// page is reloaded (the proxy only refreshes the session on page navigations, never on /api calls).
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // not in a context that can set cookies: the session still works for this request
          }
        },
      },
    }
  );
}
