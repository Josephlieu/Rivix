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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

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
} else {
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
  });
  if (error) { console.error('Failed to create user:', error.message); process.exit(1); }
  console.log(`Created admin: ${email}`);
}
