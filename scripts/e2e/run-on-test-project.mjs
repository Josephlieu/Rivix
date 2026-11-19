// Builds the app against the TEST project, serves it on port 10001, runs the whole e2e suite, and stops the server.
//   node scripts/e2e/run-on-test-project.mjs            (add --skip-build to reuse the last test-project build)
// The Supabase values come from .env.testproject through env.mjs (allowlist: RIVIX Portal only; Rivix Development refused).
// They are passed in the environment, so they win over .env.local, and the public ones are built into the browser code.
// The legacy key names are set empty so the app's fallback can never pick up Development's values from .env.local.
// EMAIL_DRY_RUN=1: no email is ever sent. On macOS the Mac is kept awake while it runs (caffeinate).
// Note: the .next folder it builds talks to the test project; rebuild before using `npm start` for anything else.
import { spawn, spawnSync } from 'child_process';
import net from 'net';
import { env, serverEnv, assertTestProject } from './env.mjs';

const PORT = 10001;
assertTestProject(env.NEXT_PUBLIC_SUPABASE_URL);
const runEnv = { ...process.env, ...serverEnv() };
const skipBuild = process.argv.includes('--skip-build');

const portBusy = () => new Promise((resolve) => { const s = net.connect(PORT, '127.0.0.1'); s.once('connect', () => { s.destroy(); resolve(true); }); s.once('error', () => resolve(false)); });
if (await portBusy()) { console.error(`Refusing: something is already listening on port ${PORT}. Stop it first (it may be a server built for another project).`); process.exit(2); }

let awake = null;
if (process.platform === 'darwin') awake = spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' });

if (!skipBuild) {
  console.log('Building against the test project…');
  const b = spawnSync('npx', ['next', 'build'], { env: runEnv, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (b.status !== 0) { console.error((b.stdout || '').split('\n').slice(-25).join('\n'), (b.stderr || '').slice(-2000)); process.exit(1); }
  console.log('Build done.');
}

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env: runEnv, stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already stopped */ } };
process.on('exit', stop);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stop(); process.exit(130); });

let up = false;
for (let i = 0; i < 90 && !up; i++) { await new Promise((r) => setTimeout(r, 1000)); try { up = (await fetch(`http://localhost:${PORT}/login`)).status === 200; } catch { /* not yet */ } }
if (!up) { console.error('The server did not start.'); stop(); process.exit(1); }
console.log(`Server up on ${PORT} (test project). Running the suite…`);

const r = spawnSync('node', ['scripts/e2e/run-all.mjs'], { env: runEnv, stdio: 'inherit' });
stop();
awake?.kill();
process.exit(r.status ?? 1);
