import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Gate all /admin routes — require PIN cookie
  if (pathname.startsWith('/admin')) {
    const pinCookie = request.cookies.get('rivix_admin_pin');

    if (!pinCookie || pinCookie.value !== process.env.ADMIN_PIN) {
      const verifyUrl = new URL('/admin-verify', request.url);
      verifyUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(verifyUrl);
    }

    return NextResponse.next();
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
  matcher: ['/admin/:path*', '/portal/:path*'],
};
