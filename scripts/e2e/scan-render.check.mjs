// Helper for replication-scan-render.test.mjs (run with the .tsx loader): draws the REAL Review tab and the REAL AI analysis
// tab (AnalysisTabView) for each case in a JSON file, the way the page does, and prints one result per case as JSON. Also checks
// the section error boundary's fallback. No network call is made (server rendering runs no effects).
// Run: node --no-warnings --import ./scripts/e2e/tsx-resolve.mjs scripts/e2e/scan-render.check.mjs <cases.json>
import fs from 'fs';
import React from 'react';

// The browser Supabase client is created when its module loads: give it the public values (never a secret).
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const { renderToStaticMarkup } = await import('react-dom/server');
const ReviewTab = (await import('../../src/app/admin/replication/ReviewTab.tsx')).default;
const View = await import('../../src/app/admin/replication/AnalysisTabView.tsx');
const { normalizeAnalysis } = await import('../../src/lib/analysis-shape.ts');
const B = await import('../../src/components/SectionErrorBoundary.tsx');

const cases = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const noop = () => {};
const box = (html, name) => { const m = html.match(new RegExp(`>${name}</span><textarea[^>]*>([^<]*)</textarea>`)); return m ? m[1] : null; };
const results = [];
for (const c of cases) {
  const rep = { id: c.id || 'zz-case', requestCode: 'RQ-ZZ', clientName: 'ZZ', productName: 'ZZ', garmentType: c.garmentType, status: 'received', submissionDate: '2026-11-17', images: [], specs: c.specs || {}, messages: [], aiAnalysis: c.analysis };
  const out = { name: c.name };
  try {
    const html = renderToStaticMarkup(React.createElement(ReviewTab, { rep, onSave: async () => true }));
    out.review = 'ok';
    out.reviewNotFilledIn = html.includes('placeholder="Not filled in"');
    out.boxes = { hardware: box(html, 'Hardware'), thread: box(html, 'Thread'), labels: box(html, 'Labels') };
    out.unsaved = html.includes('Unsaved changes');
    out.confirmedBy = (html.match(/Confirmed<\/b> by /g) || []).length; // rows showing a person's stamp
    out.unconfirmedButtons = (html.match(/Confirmed, it is correct/g) || []).length;
  } catch (e) { out.review = 'CRASH: ' + (e instanceof Error ? e.message : String(e)); }
  try {
    // Exactly what the page passes in: the saved scan through the clean-up, then the page's mapping for display.
    const getAIAnalysis = () => View.analysisResultFromSaved(normalizeAnalysis(rep.aiAnalysis) ?? {});
    // The page's request comes from the API, which sends the analysis already cleaned (replication-server.ts).
    const html = renderToStaticMarkup(React.createElement(View.default, {
      selectedRep: { ...rep, aiAnalysis: normalizeAnalysis(rep.aiAnalysis) }, getAIAnalysis, isAdmin: true, building: false, handleDownload: noop, handleStartAIAnalysis: noop,
      setActiveTab: noop, setError: noop, setReplications: noop, setSelectedRep: noop,
    }));
    out.analysis = 'ok';
    out.analysisChars = html.length;
  } catch (e) { out.analysis = 'CRASH: ' + (e instanceof Error ? e.message : String(e)); }
  results.push(out);
}

// The boundary: a thrown error turns into the fallback; a new request resets it. (Server rendering cannot trigger a boundary,
// so its two steps are checked directly.)
const Boundary = B.default;
const failed = Boundary.getDerivedStateFromError(new Error('x'));
const inst = new Boundary({ section: 'AI analysis', requestCode: 'RQ-ZZ', resetKey: 'a', children: null });
inst.state = { failed: true, resetKey: 'a' };
const fallback = renderToStaticMarkup(inst.render());
const reset = Boundary.getDerivedStateFromProps({ section: 'x', resetKey: 'b', children: null }, { failed: true, resetKey: 'a' });
const same = Boundary.getDerivedStateFromProps({ section: 'x', resetKey: 'a', children: null }, { failed: true, resetKey: 'a' });
const okChild = renderToStaticMarkup(React.createElement(Boundary, { section: 'x', resetKey: 'a' }, React.createElement('p', null, 'child shown')));
const viaRenderSection = renderToStaticMarkup(React.createElement(B.RenderSection, { render: () => React.createElement('p', null, 'drawn by RenderSection') }));
console.log(JSON.stringify({
  results,
  boundary: {
    errorTurnsIntoFallback: failed?.failed === true,
    fallbackText: fallback.includes(B.SECTION_ERROR_TEXT.replace(/'/g, '&#x27;')) && fallback.includes('Try again') && fallback.includes('AI analysis') && fallback.includes('role="alert"'),
    fallbackShowsNoData: !fallback.includes('RQ-ZZ'),
    resetsForAnotherRequest: reset?.failed === false && reset?.resetKey === 'b',
    staysForSameRequest: same === null,
    childrenShownWhenFine: okChild.includes('child shown'),
    renderSectionDraws: viaRenderSection.includes('drawn by RenderSection'),
  },
}));
