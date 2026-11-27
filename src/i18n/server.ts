// The locale on the server (2026-11-27). Server components and route handlers only.
// Order (approved): the signed-in person's SAVED choice > the rivix_locale cookie (the switcher; set from the saved choice
// at every sign-in) > the visitor's approximate LOCATION (starting language only, never stored or logged) > the browser's
// language, if this side offers it > CA·EN. The page's side then maps it to what that side shows (config.ts).
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { DEFAULT_LOCALE, LOCALE_COOKIE, SIDE_LOCALES, effectiveLocale, fromAcceptLanguage, geoFrom, isLocale, locationLocale, type Locale, type Side } from './config';
import { tFor } from './dictionaries';

/** The signed-in person's saved choice, or null. Only looked up when a sign-in cookie exists; once per request. */
const savedLocale = cache(async (): Promise<Locale | null> => {
  const jar = await cookies();
  if (!jar.getAll().some((c) => /^sb-.*-auth-token/.test(c.name))) return null;
  try {
    const { data } = await (await createSupabaseServerClient()).auth.getClaims();
    const sub = (data?.claims as { sub?: string } | undefined)?.sub;
    if (!sub) return null;
    const { data: row } = await createAdminClient().from('user_preferences').select('locale').eq('user_id', sub).maybeSingle();
    return isLocale(row?.locale) ? row.locale : null;
  } catch {
    return null;
  }
});

/** What this person has (or would have) chosen, for a page of this side. */
export async function selectedLocale(side: Side = 'customer'): Promise<Locale> {
  const saved = await savedLocale();
  if (saved) return saved;
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const h = await headers();
  const fromPlace = locationLocale(geoFrom((n) => h.get(n), process.env), side); // used here only; never kept
  if (fromPlace) return fromPlace;
  return fromAcceptLanguage(h.get('accept-language'), SIDE_LOCALES[side]) ?? DEFAULT_LOCALE;
}
export async function getT(side: Side) {
  const selected = await selectedLocale(side);
  const locale = effectiveLocale(selected, side);
  return { selected, locale, t: tFor(locale) };
}
