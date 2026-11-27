// Translation launch gate (2026-11-27). Run before launch (runbook) and whenever translations change:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/i18n-review-gate.mjs
// Fails (exit 1) when: a translated key has no review entry; a protected key (certification., privacy., nda., terms.) is
// not "reviewed" by a named fluent speaker; a key the side shows is missing; or placeholders differ from the English.
// Other AI-drafted text may ship marked "needs review" (it is counted, not blocking).
import fs from 'fs';
const R = await import('../src/i18n/review.ts');
const C = await import('../src/i18n/config.ts');
let failed = false;
for (const locale of C.LOCALES.filter((l) => l !== 'en-CA')) {
  const file = `src/i18n/messages/${locale}.review.json`;
  const review = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (!review && locale !== 'en-US') { console.log(`✗ ${locale}: no review file (${file})`); failed = true; continue; }
  const r = R.checkLocale(locale, review);
  const blocking = [['missing', r.missing], ['placeholders differ', r.placeholderMismatch], ['empty', r.empty], ['no review entry', r.noReview], ['protected, not reviewed by a fluent speaker', r.protectedUnreviewed], ['marked reviewed without a person or date', r.badReview], ['not in the English source', r.unknown]].filter(([, l]) => l.length);
  if (blocking.length) failed = true;
  console.log(`${blocking.length ? '✗' : '✓'} ${locale}: ${r.needsReview.length} key(s) still "needs review" (allowed unless protected)`);
  for (const [what, list] of blocking) console.log(`    ${what}: ${list.slice(0, 12).join(', ')}${list.length > 12 ? ` … (${list.length})` : ''}`);
}
console.log(failed ? '\nTranslation gate: NOT ready for launch.' : '\nTranslation gate: ready.');
process.exit(failed ? 1 : 0);
