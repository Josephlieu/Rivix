// Supabase key switch (audit-docs/33-go-live.md, step 8): the app reads the new publishable and secret keys first and the
// legacy anon / service_role keys only as a fallback. Offline checks of the key helpers, the source and the commit guard;
// then, on DEV, which key kind is in use (by prefix only, never a value), RLS through the public key, the server through the
// secret key, and the browser bundle of the production build. Run from the project root: node scripts/e2e/supabase-keys.test.mjs
// E2E_REQUIRE_NEW_KEYS=1 makes it fail while either slot is still on a legacy key.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';

const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const throws = (f) => { try { f(); return false; } catch { return true; } };
const K = await import('../../src/lib/supabase-keys.ts');

// ---- 1) The helpers (offline). Fake keys are built at run time and are not real keys.
const pub = 'sb_publishable_' + 'x'.repeat(20), sec = 'sb_secret_' + 'y'.repeat(20), jwt = 'eyJ' + 'z'.repeat(30);
ok('public key: the new publishable key wins over the legacy anon key', K.pickPublicKey(pub, jwt) === pub);
ok('public key: falls back to the legacy anon key when the new one is not set', K.pickPublicKey(undefined, jwt) === jwt && K.pickPublicKey('  ', jwt) === jwt);
ok('public key: a secret key is refused (it must never reach the browser)', throws(() => K.pickPublicKey(sec, jwt)) && throws(() => K.pickPublicKey('', sec)));
ok('secret key: the new secret key wins over the legacy service_role key', K.pickSecretKey(sec, jwt) === sec);
ok('secret key: falls back to the legacy service_role key', K.pickSecretKey(undefined, jwt) === jwt);
ok('secret key: a publishable key is refused', throws(() => K.pickSecretKey(pub, jwt)));
ok('key kind by prefix only', K.keyKind(pub) === 'publishable' && K.keyKind(sec) === 'secret' && K.keyKind(jwt) === 'legacy' && K.keyKind('') === 'missing');

// ---- 2) The source: every key read goes through the two helpers.
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const src = walk('src').filter((f) => /\.(ts|tsx)$/.test(f));
const reads = (name) => src.filter((f) => fs.readFileSync(f, 'utf8').includes(`process.env.${name}`)).map((f) => path.relative('src', f));
ok('only supabase-keys.ts reads the public key names', JSON.stringify(reads('NEXT_PUBLIC_SUPABASE_ANON_KEY')) === '["lib/supabase-keys.ts"]' && JSON.stringify(reads('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) === '["lib/supabase-keys.ts"]', JSON.stringify(reads('NEXT_PUBLIC_SUPABASE_ANON_KEY')));
ok('only supabase-admin.ts reads the secret key names', JSON.stringify(reads('SUPABASE_SERVICE_ROLE_KEY')) === '["lib/supabase-admin.ts"]' && JSON.stringify(reads('SUPABASE_SECRET_KEY')) === '["lib/supabase-admin.ts"]', JSON.stringify(reads('SUPABASE_SERVICE_ROLE_KEY')));
ok('no NEXT_PUBLIC_ name for a secret key anywhere in src', !src.some((f) => /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE)/.test(fs.readFileSync(f, 'utf8'))));
const clientFiles = src.filter((f) => /^\s*['"]use client['"]/.test(fs.readFileSync(f, 'utf8')));
ok('no browser ("use client") file imports the server-only admin client', clientFiles.length > 0 && !clientFiles.some((f) => /supabase-admin/.test(fs.readFileSync(f, 'utf8'))));

// ---- 3) The commit guard catches the new keys (in a throwaway git repo; nothing here is a real key).
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
  const guard = path.resolve('scripts/guard.mjs');
  const run = () => spawnSync('node', [guard], { cwd: dir, encoding: 'utf8' });
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'a.ts'), `const k = '${sec}';\n`);
    fs.writeFileSync(path.join(dir, 'b.ts'), `const k = '${pub}';\n`);
    fs.writeFileSync(path.join(dir, 'c.ts'), `const v = process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY;\n`);
    fs.writeFileSync(path.join(dir, 'd.txt'), `SUPABASE_SECRET_KEY=${'q'.repeat(24)}\n`);
    fs.writeFileSync(path.join(dir, 'ok.ts'), `const k = process.env.SUPABASE_SECRET_KEY;\n`);
    execFileSync('git', ['add', '.'], { cwd: dir });
    const r = run(), out = r.stdout + r.stderr;
    ok('guard refuses a secret key in a file', r.status === 1 && /a\.ts: Supabase secret key/.test(out));
    ok('guard refuses a publishable key in a file', /b\.ts: Supabase publishable key/.test(out));
    ok('guard refuses a secret key named NEXT_PUBLIC_', /c\.ts: secret Supabase key named NEXT_PUBLIC_/.test(out));
    ok('guard refuses SUPABASE_SECRET_KEY= with a value', /d\.txt: key assigned in a file/.test(out));
    ok('guard allows reading the key from the environment', !/ok\.ts/.test(out));
    for (const f of ['a.ts', 'b.ts', 'c.ts', 'd.txt']) fs.rmSync(path.join(dir, f));
    execFileSync('git', ['add', '-A'], { cwd: dir });
    const r2 = run(); ok('guard passes once the keys are gone', r2.status === 0, (r2.stdout + r2.stderr).trim().split('\n').pop());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- 4) DEV: which keys are in use, and do they work. (Never prints a key.)
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const PK = K.pickPublicKey(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const SK = K.pickSecretKey(env.SUPABASE_SECRET_KEY, env.SUPABASE_SERVICE_ROLE_KEY);
console.log(`INFO public key in use: ${K.keyKind(PK)}; secret key in use: ${K.keyKind(SK)}; legacy keys still in .env.local: anon ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'yes' : 'no'}, service_role ${env.SUPABASE_SERVICE_ROLE_KEY ? 'yes' : 'no'}`);
if (process.env.E2E_REQUIRE_NEW_KEYS === '1') {
  ok('new keys required: the public slot uses the publishable key', K.keyKind(PK) === 'publishable', K.keyKind(PK));
  ok('new keys required: the secret slot uses the secret key', K.keyKind(SK) === 'secret', K.keyKind(SK));
}
ok('the public key is a public kind (publishable or legacy anon)', ['publishable', 'legacy'].includes(K.keyKind(PK)), K.keyKind(PK));
ok('the secret key is a secret kind (secret or legacy service_role)', ['secret', 'legacy'].includes(K.keyKind(SK)), K.keyKind(SK));

const anon = createClient(U, PK, { auth: { persistSession: false } });
const admin = createClient(U, SK, { auth: { persistSession: false } });
const TABLES = 'account_change_requests catalog_changes catalogs customers document_requests documents garment_categories garment_types hiring_candidates hiring_settings link_reads notifications order_events order_items order_requests orders product_specs rep_activity rep_invites rep_signup_attempts replication_customer_approvals replication_downloads replication_messages replication_revisions replications reps template_versions templates'.split(' ');
const open = [], writable = [];
for (const t of TABLES) {
  const r = await anon.from(t).select('*').limit(1);
  if (!r.error && r.data.length) open.push(t);
  const w = await anon.from(t).insert({}).select();
  if (!w.error) writable.push(t);
}
ok(`public key, no login: none of the ${TABLES.length} tables gives a row`, open.length === 0, open.join(', '));
ok('public key, no login: every insert is refused', writable.length === 0, writable.join(', '));
const { data: buckets, error: be } = await admin.storage.listBuckets();
ok('secret key: the server lists the storage buckets, all private', !be && buckets.length >= 6 && buckets.every((b) => !b.public), be?.message || '');
const { count, error: ce } = await admin.from('garment_types').select('key', { count: 'exact', head: true });
ok('secret key: the server reads past RLS (garment types counted)', !ce && count > 0, ce?.message || '');

// A throwaway customer signs in through the public key and sees only their own row.
const pw = 'Tmp-pass-9876!', t = Date.now();
const { data: cu } = await admin.auth.admin.createUser({ email: `zz-keys-${t}@yopmail.com`, password: pw, email_confirm: true });
const ok1 = !!cu?.user; ok('secret key: the server creates a login (auth admin)', ok1);
let cid = null;
try {
  if (ok1) {
    const { data: c } = await admin.from('customers').insert({ user_id: cu.user.id, company_name: 'ZZ Keys', contact_email: cu.user.email, customer_code: '' }).select('id').single();
    cid = c?.id;
    const s = createClient(U, PK, { auth: { persistSession: false } });
    const { error: se } = await s.auth.signInWithPassword({ email: cu.user.email, password: pw });
    ok('public key: a customer signs in', !se, se?.message || '');
    const { data: mine } = await s.from('customers').select('id');
    ok('public key, signed in: the customer sees only their own customer row', mine?.length === 1 && mine[0].id === cid, String(mine?.length));
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 50 });
    ok('secret key: the server lists logins', (list?.users?.length ?? 0) > 0);
  }
} finally {
  if (cid) await admin.from('customers').delete().eq('id', cid);
  if (cu?.user) await admin.auth.admin.deleteUser(cu.user.id);
}

// ---- 5) The production build's browser code: never a secret key; on new keys, the publishable key and not the legacy one.
const staticDir = '.next/static';
if (fs.existsSync(staticDir)) {
  const js = walk(staticDir).filter((f) => f.endsWith('.js'));
  const has = (v) => !!v && js.some((f) => fs.readFileSync(f, 'utf8').includes(v));
  ok('browser code: no sb_secret_ key anywhere', !js.some((f) => /sb_secret_[A-Za-z0-9_-]{8,}/.test(fs.readFileSync(f, 'utf8'))));
  ok('browser code: neither secret key value (new or legacy) is in it', !has(env.SUPABASE_SECRET_KEY) && !has(env.SUPABASE_SERVICE_ROLE_KEY));
  if (process.env.E2E_REQUIRE_NEW_KEYS === '1') {
    ok('browser code was built with the publishable key', has(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
    ok('browser code no longer carries the legacy anon key', !has(env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  }
} else console.log('INFO no production build (.next/static): browser code checks skipped');
