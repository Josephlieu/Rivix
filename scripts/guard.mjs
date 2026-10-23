// Repo guard: blocks secrets and known malware signs from being committed or pushed.
// Run by .githooks/pre-commit, .githooks/pre-push and the CI "security" workflow.
// Usage: node scripts/guard.mjs [--staged]   (default: every file git tracks)
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';

const staged = process.argv.includes('--staged');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const files = (staged ? git('diff', '--cached', '--name-only', '--diff-filter=ACMR') : git('ls-files'))
  .split('\n').filter(Boolean);

const problems = [];
const add = (file, why) => problems.push(`  ${file}: ${why}`);

// Files that must never be tracked.
const FORBIDDEN_PATH = [
  [/(^|\/)\.env(\.[^/]*)?$/, 'environment file (keys); only .env.example is allowed'],
  [/(^|\/)\.vscode\/(tasks|launch)\.json$/, 'hidden VS Code task (a known malware route)'],
  [/\.(pem|p12|pfx|key)$/i, 'private key or certificate file'],
  [/\.(exe|dll|bat|cmd|scr|jar)$/i, 'executable file'],
];
// Text that looks like a real secret or like malware.
const SECRET = [
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/sk_(live|test)_[0-9A-Za-z]{20,}/, 'Stripe secret key'],
  [/re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/, 'Resend API key'],
  [/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/, 'private key'],
  [/(SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY|RESEND_API_KEY)\s*=\s*['"]?[A-Za-z0-9._-]{20,}/, 'key assigned in a file'],
  [/eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/, 'JWT (Supabase keys look like this)'],
];
const MALWARE = [
  [/eval\s*\(\s*atob\s*\(/, 'eval(atob(...)) obfuscation'],
  [/new Function\s*\(\s*atob/, 'new Function(atob(...)) obfuscation'],
  [/child_process[\s\S]{0,200}(curl|wget)\s+https?:/, 'downloads and runs a remote file'],
  [/(curl|wget)[^\n|]*\|\s*(sh|bash)\b/, 'pipes a download into a shell'],
];
// This script and the tests quote these patterns on purpose.
const SKIP_CONTENT = /^(scripts\/guard\.mjs|scripts\/e2e\/)/;

for (const f of files) {
  for (const [re, why] of FORBIDDEN_PATH) {
    if (re.test(f) && !/\.env\.example$/.test(f)) add(f, why);
  }
  if (SKIP_CONTENT.test(f) || !existsSync(f)) continue;
  const st = statSync(f);
  if (!st.isFile() || st.size > 2_000_000 || /\.(png|jpe?g|webp|gif|ico|pdf|woff2?|ttf|lock)$/i.test(f) || f === 'package-lock.json') continue;
  const text = readFileSync(f, 'utf8');
  for (const [re, why] of [...SECRET, ...MALWARE]) if (re.test(text)) add(f, why);
}

// Package files: no packages from git or URLs, no install scripts of the project itself.
if (existsSync('package.json')) {
  const p = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const sect of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [n, v] of Object.entries(p[sect] || {})) {
      if (/^(git|github:|https?:|file:|\.|\/)/.test(v)) add('package.json', `${n} comes from ${v} instead of the npm registry`);
    }
  }
  for (const s of ['preinstall', 'install', 'postinstall']) {
    if (p.scripts?.[s]) add('package.json', `has a "${s}" script: it would run on every install`);
  }
}
if (existsSync('package-lock.json')) {
  const bad = (readFileSync('package-lock.json', 'utf8').match(/"resolved": "[^"]*"/g) || [])
    .filter(r => !r.includes('registry.npmjs.org'));
  if (bad.length) add('package-lock.json', `${bad.length} package(s) not from registry.npmjs.org, e.g. ${bad[0]}`);
}

// Changes to files that control what runs on this machine or in CI: show them, so a person reads them.
if (staged) {
  const sens = files.filter(f => /^(package(-lock)?\.json|\.npmrc|\.githooks\/|\.github\/|scripts\/|next\.config|postcss\.config|tailwind\.config|eslint\.config)/.test(f));
  if (sens.length) console.log('guard NOTICE: this commit changes sensitive files. Read each diff and be sure YOU made every change:\n' + sens.map(f => '  ' + f).join('\n'));
}

if (problems.length) {
  console.error(`guard: FOUND ${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`guard: ${files.length} file(s) checked, nothing found.`);
