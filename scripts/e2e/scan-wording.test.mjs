// AI scan wording (2026-11-20): the checks draw the real screens and the PDF (.tsx), so they run under the .tsx loader:
// see scan-wording.check.mjs. Offline (no database, no server, no AI call).
// Run: node scripts/e2e/scan-wording.test.mjs
import { spawnSync } from 'child_process';
const r = spawnSync(process.execPath, ['--no-warnings', '--import', './scripts/e2e/tsx-resolve.mjs', 'scripts/e2e/scan-wording.check.mjs'], { encoding: 'utf8', timeout: 300_000, maxBuffer: 64 * 1024 * 1024 });
process.stdout.write(r.stdout || '');
if (r.status !== 0) console.log('FAIL scan-wording.check.mjs did not finish:', (r.stderr || '').slice(0, 800));
