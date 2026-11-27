// The translation review rules (2026-11-27). Pure; used by the i18n test and the launch gate (scripts/i18n-review-gate.mjs).
//   - Every translated key has a review entry: needs_review (AI drafts start here) or reviewed (by a named person, a date).
//   - Certification wording, privacy text, the NDA and the terms must be reviewed by a fluent speaker before launch.
//   - Each locale must hold every key of the namespaces its side shows (the others fall back to English on purpose).
//   - The same {placeholders} as the English text, and well-formed plural blocks.
import type { Locale } from './config';
import { DICTS, flatten } from './dictionaries';

export const PROTECTED_PREFIXES = ['certification.', 'privacy.', 'nda.', 'terms.'] as const;
export const isProtected = (key: string) => PROTECTED_PREFIXES.some((p) => key.startsWith(p));
/** Namespaces each locale must translate completely (en-US only overrides spellings; everything else falls back). */
export const REQUIRED_NAMESPACES: Partial<Record<Locale, string[]>> = {
  'fr-CA': ['common', 'switcher', 'staff', 'home', 'certification', 'login', 'forgot', 'reset', 'notFound'],
  'zh-CN': ['switcher'],
};
export type ReviewFile = { keys: Record<string, { status: 'needs_review' | 'reviewed'; by: string; date: string }> };

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)(?:,\s*plural)?/g)].map((m) => m[1]).sort().join(',');
export function checkLocale(locale: Locale, review: ReviewFile | null) {
  const source = flatten(DICTS['en-CA']), own = flatten(DICTS[locale]);
  const required = REQUIRED_NAMESPACES[locale] ?? [];
  const missing = Object.keys(source).filter((k) => required.some((n) => k.startsWith(`${n}.`)) && !(k in own));
  const unknown = Object.keys(own).filter((k) => !(k in source));
  const empty = Object.entries(own).filter(([, v]) => !v.trim()).map(([k]) => k);
  const placeholderMismatch = Object.keys(own).filter((k) => k in source && placeholders(own[k]) !== placeholders(source[k]));
  const noReview = review ? Object.keys(own).filter((k) => !review.keys[k]) : [];
  const protectedUnreviewed = review ? Object.keys(own).filter((k) => isProtected(k) && review.keys[k]?.status !== 'reviewed') : [];
  const needsReview = review ? Object.keys(own).filter((k) => review.keys[k]?.status !== 'reviewed') : [];
  const badReview = review ? Object.entries(review.keys).filter(([, r]) => r.status === 'reviewed' && (!r.by?.trim() || /AI draft/i.test(r.by) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date))).map(([k]) => k) : [];
  return { missing, unknown, empty, placeholderMismatch, noReview, protectedUnreviewed, needsReview, badReview };
}
