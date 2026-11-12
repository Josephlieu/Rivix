// The Supabase PUBLIC key (safe in the browser). Supabase is retiring the legacy `anon` key ("by the end of 2026"), so
// the new publishable key (sb_publishable_…) is read first and the legacy name is only a fallback, kept until live has
// switched too (audit-docs/33-go-live.md, step 8). The names are written out in full on purpose: Next.js only builds a
// NEXT_PUBLIC_ value into the browser code when it appears literally as process.env.NEXT_PUBLIC_….
// Relative imports only: the e2e test loads this file directly.

export function pickPublicKey(publishable: string | undefined, legacyAnon: string | undefined): string {
  const key = (publishable || '').trim() || (legacyAnon || '').trim();
  // A secret key would give anyone full access if it reached the browser: refuse it outright.
  if (key.startsWith('sb_secret_')) throw new Error('A Supabase SECRET key is set as the public key. Use the publishable key (sb_publishable_…) there.');
  return key;
}

export function supabasePublicKey(): string {
  return pickPublicKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// Server only (the e2e test also uses it): the secret key (sb_secret_…) first, the legacy service_role key as fallback.
export function pickSecretKey(secret: string | undefined, legacyServiceRole: string | undefined): string {
  const key = (secret || '').trim() || (legacyServiceRole || '').trim();
  if (key.startsWith('sb_publishable_')) throw new Error('A Supabase PUBLISHABLE key is set as the secret key. Use the secret key (sb_secret_…) there.');
  return key;
}

/** Which kind of key is in use, by prefix only (never the key itself). */
export function keyKind(key: string): 'publishable' | 'secret' | 'legacy' | 'missing' | 'unknown' {
  if (!key) return 'missing';
  if (key.startsWith('sb_publishable_')) return 'publishable';
  if (key.startsWith('sb_secret_')) return 'secret';
  if (key.startsWith('eyJ')) return 'legacy';
  return 'unknown';
}
