// Loader hooks for tsx-resolve.mjs: compile .ts/.tsx with the project's TypeScript, resolve "@/..." to src/ and
// extension-less relative imports to .ts/.tsx. Tests only.
import ts from 'typescript';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = pathToFileURL(process.cwd() + '/').href;
const tryFile = (base) => {
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const u = new URL(base + ext);
    try { if (fs.statSync(fileURLToPath(u)).isFile()) return u.href; } catch { /* next */ }
  }
  return null;
};
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) { const hit = tryFile(new URL('src/' + specifier.slice(2), ROOT).href); if (hit) return { url: hit, shortCircuit: true }; }
  if (/^\.{1,2}\//.test(specifier) && context.parentURL?.startsWith('file:') && !context.parentURL.includes('/node_modules/')) {
    const hit = tryFile(new URL(specifier, context.parentURL).href);
    if (hit) return { url: hit, shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (/\.tsx?$/.test(url) && !url.includes('/node_modules/')) {
    const src = fs.readFileSync(fileURLToPath(url), 'utf8');
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: fileURLToPath(url) });
    return { format: 'module', source: out.outputText, shortCircuit: true };
  }
  return next(url, context);
}
