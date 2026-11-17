// Gloves, footwear and PPE show their own template; clothing unchanged against the golden files; one template lookup
// (2026-11-18). The checks draw the real screens (.tsx), so they run under the .tsx loader: see template-display.check.mjs.
// Run: node scripts/e2e/template-display.test.mjs   (DEV only; reads the template tables, writes nothing)
import { spawnSync } from 'child_process';
const r = spawnSync(process.execPath, ['--no-warnings', '--import', './scripts/e2e/tsx-resolve.mjs', 'scripts/e2e/template-display.check.mjs'], { encoding: 'utf8', timeout: 300_000, maxBuffer: 64 * 1024 * 1024 });
process.stdout.write(r.stdout || '');
if (r.status !== 0) console.log('FAIL template-display.check.mjs did not finish:', (r.stderr || '').slice(0, 800));
