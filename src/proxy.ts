import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAdminUser, isRepUser } from '@/lib/admin-auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Gate all /admin routes — require a real login that has the admin role.
  // Every admin has their own email + password; all admins have equal access.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!isAdminUser(user)) {
      const loginUrl = new URL('/admin-login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // Rep area — only sales reps (and admins) may enter.
  if (pathname === '/rep' || pathname.startsWith('/rep/')) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!isRepUser(user) && !isAdminUser(user)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // Uniform Replication is Sales Rep/Admin-only per the 2026-09-25 decision —
  // customers get zero access, not even a read-only view. The nav link is
  // already hidden, but that alone doesn't stop someone hitting the URL
  // directly, so block it here regardless of login state.
  if (pathname.startsWith('/portal/replication')) {
    return NextResponse.redirect(new URL('/portal', request.url));
  }

  // Gate all /portal routes — require a real, logged-in Supabase session
  if (pathname.startsWith('/portal')) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // getUser() (not getSession()) actually revalidates the token with Supabase,
    // rather than trusting whatever's in the cookie.
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/portal/:path*', '/rep/:path*'],
};
