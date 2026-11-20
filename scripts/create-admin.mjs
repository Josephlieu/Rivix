// Create (or update) an admin account.
//   node scripts/create-admin.mjs <email> <password>
// Uses the service role key from .env.local, so it runs against whichever
// Supabase project that file points at. Never commit real passwords.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const env = {};
for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, (env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY));

// Audit log (2026-11-21): giving the admin role is recorded (actor "system": a script, not a signed-in person). Never the
// password. If the audit_log table is not there yet, the admin is still made and this prints a warning.
async function auditRoleGrant(userId, oldRole) {
  const { error } = await supabase.from('audit_log').insert({
    actor_user_id: null, actor_role: 'system', actor_email: null, action: 'role.grant', record_table: 'auth.users', record_id: userId,
    before: { role: oldRole }, after: { role: 'admin', email }, route: 'script: scripts/create-admin.mjs',
  });
  if (error) console.error(`Warning: the admin was made, but it could not be written to the audit log (${error.code || 'error'}).`);
}

const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listErr) { console.error('Failed to list users:', listErr.message); process.exit(1); }
const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    app_metadata: { ...existing.app_metadata, role: 'admin' },
  });
  if (error) { console.error('Failed to update user:', error.message); process.exit(1); }
  console.log(`Updated existing user and made them an admin: ${email}`);
  if (existing.app_metadata?.role !== 'admin') await auditRoleGrant(existing.id, existing.app_metadata?.role ?? null);
} else {
  const { data: made, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
  });
  if (error) { console.error('Failed to create user:', error.message); process.exit(1); }
  console.log(`Created admin: ${email}`);
  await auditRoleGrant(made.user.id, null);
}
