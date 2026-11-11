// Saves a template's flat drawing (its views, numbered callouts, notes, and the list of measurement points) as a standalone .svg.
// Run: node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/export-drawing.mjs jacket <out.svg>
import fs from 'fs';
const DR = await import('../src/lib/drawings.ts');
const C = await import('../src/lib/template-catalog.ts');
const [family = 'jacket', out = `${family}-drawing.svg`] = process.argv.slice(2);
const def = DR.currentDrawing(family);
const t = C.BUILT_IN_TEMPLATES.find((x) => x.kind === 'family' && x.key === family);
if (!def || !t) { console.error(`no drawing for "${family}"`); process.exit(1); }
const points = t.body.points.map((p) => ({ code: p.code, name: p.name, definition: p.howToMeasure }));
fs.writeFileSync(out, DR.drawingSheetSvg(def, points));
console.log(`wrote ${out} (${def.label}, drawing v${def.version}, ${points.length} points)`);
