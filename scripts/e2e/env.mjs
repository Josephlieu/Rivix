// The ONLY place the e2e tests read their settings from (2026-11-19). The tests run against the TEST project only.
//
// - Supabase values come from `.env.testproject` (gitignored): TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY and
//   TEST_SUPABASE_SECRET_KEY, mapped to the names the app and the tests use (the legacy names point at the same new keys).
// - Everything else (Gemini, EMAIL_DRY_RUN, the site address) still comes from `.env.local`, but never a Supabase value.
// - Guard: the project must be on the allowlist below. Rivix Development is refused by name: it is (or will be) the live
//   database, and the tests create and delete data.
import fs from 'fs';

export const ALLOWED_TEST_PROJECTS = ['unccpzsmhatsjaoowtxs']; // RIVIX Portal, the test project
const DEVELOPMENT = 'ddpgrgfayfmpsjndvgvz'; // Rivix Development: never

const parse = (file) => (fs.existsSync(file)
  ? Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))
  : {});

/** The project ID in a Supabase URL (the first part of the host). */
export const projectRef = (url) => { try { return new URL(url).hostname.split('.')[0]; } catch { return ''; } };

/** Throws unless the URL is an allowed test project. */
export function assertTestProject(url) {
  const ref = projectRef(url);
  if (ref === DEVELOPMENT || String(url).includes(DEVELOPMENT)) {
    throw new Error(`Refusing to run: Rivix Development (${DEVELOPMENT}) is the live database. The e2e tests never run against it.`);
  }
  if (!ALLOWED_TEST_PROJECTS.includes(ref)) {
    throw new Error(`Refusing to run: the Supabase project "${ref || '(none)'}" is not an allowed test project (${ALLOWED_TEST_PROJECTS.join(', ')}).`);
  }
  return ref;
}

function load() {
  const test = parse('.env.testproject');
  if (!test.TEST_SUPABASE_URL) throw new Error('Refusing to run: .env.testproject with TEST_SUPABASE_URL is missing.');
  assertTestProject(test.TEST_SUPABASE_URL);
  const local = Object.fromEntries(Object.entries(parse('.env.local')).filter(([k]) => !/SUPABASE/.test(k)));
  return {
    ...local,
    NEXT_PUBLIC_SUPABASE_URL: test.TEST_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: test.TEST_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: test.TEST_SUPABASE_SECRET_KEY,
    // Older tests still read the legacy names: they get the same new keys (the test project has no legacy keys).
    NEXT_PUBLIC_SUPABASE_ANON_KEY: test.TEST_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: test.TEST_SUPABASE_SECRET_KEY,
  };
}

/** The settings every test uses (checked against the allowlist when this file loads). */
export const env = load();

/** The environment for the app server and the test processes: the mapped Supabase values win over `.env.local`. */
export const serverEnv = () => ({
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  // Empty, so the app's fallback to the legacy names can never pick up Development's values from .env.local.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  EMAIL_DRY_RUN: '1',
});

/** The fixed test logins (B3), from the gitignored logins file. Never print them. */
export function testLogins() {
  const file = 'audit-docs/test-project-logins.txt';
  if (!fs.existsSync(file)) return null;
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^(admin|rep|customer)\s+(\S+)\s+password\s+(\S+)(?:\s+totp_secret\s+(\S+))?/);
    if (m) out[m[1]] = { email: m[2], password: m[3], ...(m[4] ? { totpSecret: m[4] } : {}) };
  }
  return out;
}
