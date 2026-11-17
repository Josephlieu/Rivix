// ONE-TIME helper (2026-11-18): saves what a JACKET looks like today, before the gloves / footwear / PPE display fixes, so
// template-display.test.mjs can prove the jacket output did not change (except the differences listed in that test).
// It refuses to run when the golden files exist: they are made once from the code before the change and never regenerated.
// Run: node --no-warnings --import ./scripts/e2e/tsx-resolve.mjs scripts/e2e/template-display.make-golden.mjs
import fs from 'fs';
import path from 'path';
import React from 'react';
import { jacketCases, renderAll } from './template-display.render.mjs';

const DIR = 'scripts/e2e/fixtures/template-display-golden';
if (fs.existsSync(DIR)) { console.error(`${DIR} exists: the golden files are never regenerated.`); process.exit(1); }

// The Client Spec Review panel lives inside the request page (it loads its data in effects, so it cannot be drawn on its own).
// Draw TODAY's markup: the panel's JSX copied verbatim from the current ReplicationDetail.tsx into a throwaway component.
const src = fs.readFileSync('src/app/admin/replication/ReplicationDetail.tsx', 'utf8').split('\n');
const start = src.findIndex((l) => l.includes('<div className="lg:col-span-5 space-y-6">'));
const indent = src[start].match(/^ */)[0];
const end = src.findIndex((l, i) => i > start && l === `${indent}</div>`);
if (start < 0 || end < 0) { console.error('panel not found'); process.exit(1); }
const tmpDir = 'scripts/e2e/.golden-tmp';
fs.mkdirSync(tmpDir, { recursive: true });
const harness = path.join(tmpDir, 'panel-today.tsx');
fs.writeFileSync(harness, [
  "import React from 'react';",
  "import { Cpu } from 'lucide-react';",
  '// eslint-disable-next-line @typescript-eslint/no-explicit-any',
  'export default function PanelToday({ selectedRep, isAdmin }: any) {',
  '  const activeHotspot = null as null | { title: string; description: string }; const setActiveHotspot = (_: unknown) => {}; const setActiveTab = (_: string) => {};',
  '  return (',
  ...src.slice(start, end + 1),
  '  );',
  '}',
  '',
].join('\n'));
const PanelToday = (await import(path.resolve(harness))).default;
const cases = jacketCases();
const out = await renderAll({ cases, panel: (rep) => React.createElement(PanelToday, { selectedRep: rep, isAdmin: true }) });
fs.rmSync(tmpDir, { recursive: true, force: true });

fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(path.join(DIR, 'cases.json'), JSON.stringify(cases, null, 1) + '\n');
for (const [name, text] of Object.entries(out)) fs.writeFileSync(path.join(DIR, `${name}.txt`), text);
fs.writeFileSync(path.join(DIR, 'README.md'), `Made once on 2026-11-18 from the code BEFORE the gloves / footwear / PPE display fixes, by\n\`template-display.make-golden.mjs\`. Never regenerate: template-display.test.mjs compares today's jacket output with these files.\n`);
console.log('golden files:', Object.keys(out).join(', '));
