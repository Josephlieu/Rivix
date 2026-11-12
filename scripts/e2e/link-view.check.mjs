// Helper for link-import.test.mjs (run with the .tsx loader): renders the "From the website" view with hostile page text
// and prints the HTML as JSON, so the test can check that nothing from a page is ever rendered as markup.
// Run: node --no-warnings --import ./scripts/e2e/tsx-resolve.mjs scripts/e2e/link-view.check.mjs
import React from 'react';
const { renderToStaticMarkup } = await import('react-dom/server');
const V = (await import('../../src/app/admin/replication/WebFoundView.tsx')).default;
const found = {
  name: '<img src=x onerror=alert(1)>Parka', brand: 'Brand', sku: 'S1', description: '<script>alert("d")</script> Warm parka',
  materials: ['<b>100% nylon</b>'], weights: [], sizes: ['S', 'M'], colours: [], care: [], claims: ['<a href="javascript:alert(1)">CSA Z96 Class 2</a>'], details: [], structured: true,
};
const html = renderToStaticMarkup(React.createElement(V, { found, missing: ['<i>Labels</i>: not on the page'], missingFor: 'Jacket' }));
console.log(JSON.stringify({ html }));
