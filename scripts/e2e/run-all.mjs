// Runs every *.test.mjs in this folder and prints a summary.
//   npm run test:e2e
// Requires the dev server (`npm run dev`, port 10001) and .env.local pointing at the DEV Supabase project.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const DEV_REF = 'ddpgrgfayfmpsjndvgvz'; // the dev Supabase project — these tests create and delete data

const env = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
if (!env.includes(DEV_REF) && !process.env.E2E_FORCE) {
  console.error('Refusing to run: .env.local does not point at the dev Supabase project. (Set E2E_FORCE=1 to override.)');
  process.exit(2);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
let pass = 0, fail = 0;
const failed = [];
for (const f of files) {
  // The loader lets tests import the app's TypeScript source directly (relative imports without extensions).
  const r = spawnSync('node', ['--experimental-strip-types', '--no-warnings', '--import', path.join(dir, 'ts-resolve.mjs'), path.join(dir, f)], { encoding: 'utf8', timeout: 5 * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const p = (out.match(/^PASS/gm) || []).length;
  // A test that was killed (5-minute limit or a signal), could not start, or exited non-zero is a failure. Node gives
  // no exit code (status null) when the time limit kills it, so that must be checked on its own: a stall fails, it is
  // never counted as a pass.
  const timedOut = r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM';
  const crashed = !timedOut && (r.status !== 0 || r.signal || r.error);
  const bad = (out.match(/^FAIL|^ERROR/gm) || []).length + (timedOut || crashed ? 1 : 0);
  pass += p; fail += bad;
  const note = timedOut ? ', TIMED OUT after 5 min (cleanup did not run; check DEV for leftover zz- data)' : crashed ? `, stopped (${r.signal || r.error?.message || `exit ${r.status}`})` : '';
  console.log(`${bad ? '✗' : '✓'} ${f}  (${p} passed${bad ? `, ${bad} FAILED` : ''}${note})`);
  if (bad) { failed.push(f); console.log(out.split('\n').filter((l) => /^FAIL|^ERROR/.test(l)).join('\n')); }
}
console.log(`\n${pass} checks passed, ${fail} failed across ${files.length} files.`);
process.exit(fail ? 1 : 0);
