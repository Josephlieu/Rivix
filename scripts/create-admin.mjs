// Create (or update) an admin account.
//   node scripts/create-admin.mjs <email> <password>                  (default: the project in .env.local; runbook use)
//   node scripts/create-admin.mjs --test-project <email> <password>   (the TEST project, through scripts/e2e/env.mjs, which
//                                                                      refuses anything but RIVIX Portal; Development never)
// Never commit real passwords. The password is never printed or logged.
// Audit log (2026-11-21): giving the admin role is recorded as role.grant with actor "system" (a script, not a signed-in
// person). If the audit_log table is not there (or the write fails), the admin is still made and a warning is printed.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

export const ROUTE = 'script: scripts/create-admin.mjs';

/** Where the script connects: .env.local by default, or the test project with --test-project. Never prints a value. */
export async function loadConfig(flags) {
  if (flags.includes('--test-project')) {
    const { env } = await import('./e2e/env.mjs'); // throws unless .env.testproject is the allowed test project
    return { source: 'test-project', url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.SUPABASE_SECRET_KEY };
  }
  const env = {};
  for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return { source: '.env.local', url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY };
}

/** Records the role change. Never throws: returns false (and prints a warning) when it could not be written. */
async function auditRoleGrant(supabase, { userId, email, oldRole }, warn) {
  try {
    const { error } = await supabase.from('audit_log').insert({
      actor_user_id: null, actor_role: 'system', actor_email: null, action: 'role.grant', record_table: 'auth.users', record_id: userId,
      before: { role: oldRole }, after: { role: 'admin', email }, route: ROUTE,
    });
    if (!error) return true;
    warn(`Warning: the admin was made, but it could not be written to the audit log (${error.code || 'error'}${/audit_log|schema cache|does not exist/i.test(error.message || '') ? ': the audit_log table is not there yet' : ''}).`);
  } catch {
    warn('Warning: the admin was made, but it could not be written to the audit log (the write failed).');
  }
  return false;
}

/**
 * Makes `email` an admin (creates the login, or updates an existing one). Returns { ok, created, userId, audited } or
 * { ok: false, error }. `log` and `warn` print (console by default).
 */
export async function createAdmin(supabase, email, password, { log = console.log, warn = console.error } = {}) {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) return { ok: false, error: `Failed to list users: ${listErr.message}` };
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password, app_metadata: { ...existing.app_metadata, role: 'admin' } });
    if (error) return { ok: false, error: `Failed to update user: ${error.message}` };
    log(`Updated existing user and made them an admin: ${email}`);
    const changed = existing.app_metadata?.role !== 'admin';
    const audited = changed ? await auditRoleGrant(supabase, { userId: existing.id, email, oldRole: existing.app_metadata?.role ?? null }, warn) : null;
    return { ok: true, created: false, userId: existing.id, audited };
  }
  const { data: made, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: 'admin' } });
  if (error) return { ok: false, error: `Failed to create user: ${error.message}` };
  log(`Created admin: ${email}`);
  const audited = await auditRoleGrant(supabase, { userId: made.user.id, email, oldRole: null }, warn);
  return { ok: true, created: true, userId: made.user.id, audited };
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((x) => x.startsWith('--'));
  const [email, password] = args.filter((x) => !x.startsWith('--'));
  const unknown = flags.filter((f) => f !== '--test-project');
  if (!email || !password || unknown.length) {
    console.error('Usage: node scripts/create-admin.mjs [--test-project] <email> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  let cfg;
  try { cfg = await loadConfig(flags); } catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); }
  if (cfg.source === 'test-project') console.log('Using the TEST project (scripts/e2e/env.mjs).');
  const supabase = createClient(cfg.url, cfg.key, { auth: { persistSession: false } });
  const r = await createAdmin(supabase, email, password);
  if (!r.ok) { console.error(r.error); process.exit(1); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
