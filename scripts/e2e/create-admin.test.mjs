// scripts/create-admin.mjs (2026-11-21, audit log follow-up). On the TEST project only (--test-project, through env.mjs):
//   - the real script, run as the runbook runs it, creates a zz admin, and exactly one role.grant row appears with actor
//     "system" (no user id), the script's route, before role null, after role admin, and no password anywhere;
//   - run again for the same admin: no second row; a rep made admin: one row with before role "rep";
//   - with no audit_log table (simulated: the table answers "not found"), or a write that throws, the admin is still made and
//     a warning is printed, no crash;
//   - without the flag the script reads .env.local (the runbook default); with it, the test project.
// The zz logins are deleted at the end; the audit rows stay (nobody can delete them).
import { env } from './env.mjs'; // the test project only (guarded), never Development
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { projectRef } from './env.mjs';
import { createAdmin, loadConfig, ROUTE } from '../create-admin.mjs';

const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const t = Date.now();
const pw = `Zz-Cad-${crypto.randomBytes(9).toString('base64url')}`;
const made = [];
const findUser = async (email) => (await a.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.find((u) => u.email === email);
const grants = async (userId) => (await a.from('audit_log').select('*').eq('action', 'role.grant').eq('record_id', userId).order('id')).data ?? [];
const run = (...args) => spawnSync(process.execPath, ['scripts/create-admin.mjs', ...args], { encoding: 'utf8', timeout: 60_000 });

try {
  // --- where it connects
  const def = await loadConfig([]), tp = await loadConfig(['--test-project']);
  ok('without a flag the script reads .env.local (the runbook default)', def.source === '.env.local');
  ok('with --test-project it uses the test project (RIVIX Portal), through env.mjs', tp.source === 'test-project' && projectRef(tp.url) === 'unccpzsmhatsjaoowtxs');
  let r = run('--test-project', '--prod', 'x@example.com', pw);
  ok('an unknown flag is refused before anything connects', r.status === 1 && /Usage/.test(r.stderr));

  // --- 1. the real script creates a zz admin: exactly one role.grant row, actor system
  const e1 = `zz-cad-a-${t}@yopmail.com`;
  r = run('--test-project', e1, pw);
  const u1 = await findUser(e1); if (u1) made.push(u1.id);
  ok('the script (--test-project) creates the admin', r.status === 0 && /Created admin/.test(r.stdout) && u1?.app_metadata?.role === 'admin', (r.stderr || '').slice(0, 200));
  ok('  it says it is using the test project, and never prints the password', /TEST project/.test(r.stdout) && !(r.stdout + r.stderr).includes(pw));
  let g = await grants(u1?.id ?? 'none');
  ok('exactly one role.grant row, actor "system" with no user id, the script\'s route, role null → admin', g.length === 1 && g[0].actor_role === 'system' && g[0].actor_user_id === null
    && g[0].route === ROUTE && g[0].record_table === 'auth.users' && g[0].before?.role === null && g[0].after?.role === 'admin' && g[0].after?.email === e1, JSON.stringify(g.map((x) => [x.actor_role, x.route, x.before, x.after])));
  ok('  the row holds no password', g.length === 1 && !JSON.stringify(g[0]).includes(pw));
  r = run('--test-project', e1, pw + 'x');
  g = await grants(u1?.id ?? 'none');
  ok('run again for the same admin: updated, no second row', r.status === 0 && /Updated existing user/.test(r.stdout) && g.length === 1);

  // --- a rep made admin: one row, before role "rep"
  const e2 = `zz-cad-r-${t}@yopmail.com`;
  const u2 = (await a.auth.admin.createUser({ email: e2, password: pw, email_confirm: true, app_metadata: { role: 'rep' } })).data.user; made.push(u2.id);
  r = run('--test-project', e2, pw);
  g = await grants(u2.id);
  ok('a rep made admin: exactly one role.grant row, role rep → admin', r.status === 0 && g.length === 1 && g[0].before?.role === 'rep' && g[0].after?.role === 'admin' && g[0].actor_role === 'system');

  // --- 2. no audit_log table: the admin is still made, with a warning, no crash
  const noTable = new Proxy(a, { get: (o, k) => (k === 'from' ? (tbl) => (tbl === 'audit_log'
    ? { insert: async () => ({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.audit_log' in the schema cache" } }) } : o.from(tbl)) : o[k]) });
  const e3 = `zz-cad-n-${t}@yopmail.com`; const warned = [];
  let res = await createAdmin(noTable, e3, pw, { log: () => {}, warn: (m) => warned.push(m) });
  const u3 = await findUser(e3); if (u3) made.push(u3.id);
  ok('no audit_log table: the admin is still created', res.ok === true && res.created === true && res.audited === false && u3?.app_metadata?.role === 'admin');
  ok('  and a warning is printed (no crash), naming the missing table, without the password', warned.length === 1 && /could not be written to the audit log/.test(warned[0]) && /table is not there yet/.test(warned[0]) && !warned[0].includes(pw), warned.join(' | '));
  ok('  no row was written for it', (await grants(u3?.id ?? 'none')).length === 0);
  const throws = new Proxy(a, { get: (o, k) => (k === 'from' ? (tbl) => (tbl === 'audit_log' ? { insert: async () => { throw new Error('network down'); } } : o.from(tbl)) : o[k]) });
  const e4 = `zz-cad-x-${t}@yopmail.com`; warned.length = 0;
  res = await createAdmin(throws, e4, pw, { log: () => {}, warn: (m) => warned.push(m) });
  const u4 = await findUser(e4); if (u4) made.push(u4.id);
  ok('a log write that throws: the admin is still created, with a warning', res.ok === true && u4?.app_metadata?.role === 'admin' && warned.length === 1 && /could not be written/.test(warned[0]));
} catch (e) {
  ok('the create-admin test ran to the end', false, e instanceof Error ? e.message : String(e));
} finally {
  for (const id of made) await a.auth.admin.deleteUser(id);
  const left = (await a.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.filter((u) => (u.email || '').startsWith('zz-cad-')).length;
  ok('cleaned up: no zz-cad login left (the audit rows stay, by design)', left === 0, `${left} left`);
}
