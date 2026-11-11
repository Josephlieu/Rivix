// Helper for drawings.test.mjs (run with the .tsx loader): builds the real tech file PDF for a few cases, walks its element tree
// for the drawing, the placeholder and the "No." column, renders each to a PDF, and prints the results as JSON.
// Run: node --no-warnings --import ./scripts/e2e/tsx-resolve.mjs scripts/e2e/pdf-drawing.check.mjs
const P = await import('../../src/lib/TechPackPDF.tsx');
const DR = await import('../../src/lib/drawings.ts');
const C = await import('../../src/lib/template-catalog.ts');
const A = await import('../../src/lib/garmentAiAnalysis.ts');
const { renderToBuffer } = await import('@react-pdf/renderer');

const kidsText = (el) => [].concat(el?.props?.children ?? []).map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x) : '')).join('');
const walk = (el, found) => {
  if (Array.isArray(el)) { el.forEach((x) => walk(x, found)); return found; }
  if (!el || typeof el !== 'object' || !el.props) return found;
  if (el.type?.name === 'PdfDrawing') found.drawing = true;
  const cols = Array.isArray(el.props.cols) ? el.props.cols.map((c) => c.h) : [];
  if (cols.includes('POM') && cols.includes('Tol. ±')) { found.pomTable = true; found.sizes = cols.slice(cols.indexOf('Description') + 1, cols.indexOf('Tol. ±')); if (cols[0] === 'No.') found.no = true; } // the measurement table
  if (kidsText(el).startsWith('Size columns: ')) found.sizeNote = kidsText(el);
  if (el.type?.name === 'PdfDrawing') found.drawings = (found.drawings ?? 0) + 1;
  const kids = [].concat(el.props.children ?? []).join('');
  if (kids.includes(DR.NO_DRAWING_TEXT)) found.placeholder = true;
  if (kids.includes(DR.GENERAL_TEXT)) found.general = true;
  walk(el.props.children, found);
  return found;
};
const make = (typeKey, analysisExtra = {}) => {
  const t = C.resolveTemplate(typeKey, null, C.BUILT_IN_CATALOG);
  const rep = { id: 'x', requestCode: 'RQ-9999', clientName: 'ZZ', productName: 'Test', garmentType: typeKey, submissionDate: '2026-11-11', images: [], specs: {}, messages: [],
    aiAnalysis: { analyzedAt: '', components: [{ type: 'pocket', label: 'Chest pocket <b>bold</b>', location: "front, wearer's left chest" }], measurements: A.templateMeasurements(t), checklist: A.checklistFor(t), construction: [], labelPlacements: [], stitchReference: [], ...analysisExtra } };
  return P.buildTechFileData(rep, [], undefined, { family: { key: t.family.key }, parts: t.parts.map((p) => ({ key: p.key, label: p.label, points: p.points.map((x) => ({ code: x.code, name: x.name })) })) });
};
const cases = {
  draftJacket: make('parka'),
  oldApprovedJacket: make('jacket', { review: { status: 'approved', revision: 2, approvedAt: '2026-11-01T00:00:00Z' } }),
  approvedV1Jacket: make('jacket', { review: { status: 'approved', revision: 3 }, drawing: { key: 'jacket', version: 1 } }),
  draftGlove: make('cut-resistant-gloves'),
  draftRainSuit: make('rain-suit'),
  draftBranded: make('branded-apparel'),
  // Task 30: glove and footwear size columns (edited labels, and a size system with a width for footwear).
  draftGloveSizes: make('cut-resistant-gloves', { sizeRun: { system: 'glove', labels: ['6', '7', '8', '9', '10'] } }),
  draftBootSizes: make('safety-boots', { sizeRun: { system: 'shoe', labels: ['8', '9', '10', '11', '12'], width: 'EE', sizeSystem: 'EU' } }),
};
const out = {};
for (const [name, d] of Object.entries(cases)) {
  const found = walk(P.TechPackPDF({ d }), {});
  const buf = await renderToBuffer(P.TechPackPDF({ d }));
  out[name] = { drawing: !!found.drawing, drawings: found.drawings ?? 0, no: !!found.no, placeholder: !!found.placeholder, general: !!found.general, table: !!found.pomTable, sizes: found.sizes ?? [], sizeNote: found.sizeNote ?? '', bytes: buf.length, pdf: buf.subarray(0, 5).toString() === '%PDF-' };
}
// The Review tab itself, rendered to HTML (effects do not run, so it uses the built-in templates): the drawing section,
// the number of drawings, and the "No." column.
const { renderToStaticMarkup } = await import('react-dom/server');
const React = await import('react');
const RT = (await import('../../src/app/admin/replication/ReviewTab.tsx')).default;
const screen = {};
const fresh = (k) => make(k, { measurements: [] }); // a glove / boot draft with no size run yet: the Review tab adds the defaults
for (const [name, d] of Object.entries({ draftJacket: cases.draftJacket, draftRainSuit: cases.draftRainSuit, oldApprovedJacket: cases.oldApprovedJacket, draftBranded: cases.draftBranded, approvedV1Jacket: cases.approvedV1Jacket, gloveDefaults: fresh('cut-resistant-gloves'), bootDefaults: fresh('safety-boots') })) {
  const rep = { id: 'x', requestCode: 'RQ-9999', clientName: 'ZZ', productName: 'Test', garmentType: d.garmentType, submissionDate: '2026-11-11', images: [], specs: {}, messages: [], aiAnalysis: d.analysis };
  const html = renderToStaticMarkup(React.createElement(RT, { rep, onSave: async () => true }));
  const heads = [...html.matchAll(/aria-label="Size column \d" [^>]*value="([^"]*)"|value="([^"]*)"[^>]*aria-label="Size column \d"/g)].map((m) => m[1] ?? m[2]);
  screen[name] = { section: html.includes('Technical drawing'), svgs: (html.match(/<svg[^>]*role="img"/g) || []).length, no: />No\.<\/th>/.test(html), general: html.includes('no standard drawing'), escaped: !html.includes('<b>bold</b>'),
    locked: /<fieldset[^>]*disabled/.test(html), startDraft: (html.match(/Start a new draft \(Rev (?:<!-- -->)?(\d+)(?:<!-- -->)?\)/) || [])[1] ?? null, sizeHeads: heads, sizeSystem: /value="US men(&#x27;|')s"/.test(html), width: /<option value="D" selected/.test(html) || /value="D"[^>]*selected/.test(html) };
}
out.screen = screen;
console.log(JSON.stringify(out));
