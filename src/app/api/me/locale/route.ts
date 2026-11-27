import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, effectiveLocale, isLocale, type Locale, type Side } from '@/i18n/config';
import { selectedLocale } from '@/i18n/server';

// The language switcher (2026-11-27). Anyone may call it, signed in or not; the user always comes from the session.
//   POST { locale }: sets the cookie (before login that is the only memory); signed in, it is also saved for this login,
//                    so it follows them to other devices and their emails.
//   GET:             after sign-in. A saved choice wins and is put in the cookie; with no saved choice yet, the cookie's
//                    (chosen before login) is saved. Returns { locale } (null when there is none).
//                    ?side=customer|staff|supplier also returns `opens`: the language a page of that side would open in
//                    for this request (saved choice > cookie > location > browser > CA·EN). Computed, never stored; the
//                    location is never saved (only the cookie, which only the switcher sets, is ever saved).
const setCookie = (res: NextResponse, locale: Locale) =>
  res.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production' });
const userId = async () => (await (await createSupabaseServerClient()).auth.getUser()).data.user?.id ?? null;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const locale = body && typeof body === 'object' ? (body as { locale?: unknown }).locale : undefined;
  if (!isLocale(locale)) return NextResponse.json({ error: 'Unknown language.' }, { status: 400 });
  const uid = await userId();
  if (uid) {
    const { error } = await createAdminClient().from('user_preferences').upsert({ user_id: uid, locale }, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: 'Could not save the language.' }, { status: 500 });
  }
  const res = NextResponse.json({ locale, saved: Boolean(uid) });
  setCookie(res, locale);
  return res;
}

const SIDES: Side[] = ['customer', 'staff', 'supplier'];
const opensFor = async (req: NextRequest) => {
  const side = req.nextUrl.searchParams.get('side') as Side | null;
  return side && SIDES.includes(side) ? { opens: effectiveLocale(await selectedLocale(side), side) } : {};
};

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  const uid = await userId();
  if (!uid) return NextResponse.json({ locale: isLocale(cookie) ? cookie : null, saved: false, ...(await opensFor(req)) });
  const admin = createAdminClient();
  const { data } = await admin.from('user_preferences').select('locale').eq('user_id', uid).maybeSingle();
  let locale: Locale | null = isLocale(data?.locale) ? data.locale : null;
  if (!locale && isLocale(cookie)) {
    await admin.from('user_preferences').upsert({ user_id: uid, locale: cookie }, { onConflict: 'user_id' });
    locale = cookie;
  }
  const res = NextResponse.json({ locale, saved: Boolean(locale), ...(await opensFor(req)) });
  if (locale) setCookie(res, locale);
  return res;
}
