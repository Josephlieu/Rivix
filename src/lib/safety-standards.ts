// The safety standard pick list (orders and product specs). Anything else can be typed in ("Other"), for example an
// older edition such as CSA Z96-15; existing orders and specs keep whatever text they already have.
// Relative imports only: the e2e test loads this file directly.
export const SAFETY_STANDARDS = [
  'CSA Z96:22 Class 1',
  'CSA Z96:22 Class 2',
  'CSA Z96:22 Class 3',
  'ANSI/ISEA 107-2020 Type O Class 1',
  'ANSI/ISEA 107-2020 Type R Class 2',
  'ANSI/ISEA 107-2020 Type R Class 3',
  'EN ISO 20471 Class 1',
  'EN ISO 20471 Class 2',
  'EN ISO 20471 Class 3',
  'NFPA 2112 (flame resistant)',
  'Arc rated: ASTM F1506 (NFPA 70E / CSA Z462)',
  'CAN/CGSB-155.20 (flash fire)',
  'None',
] as const;

export const MAX_STANDARD_LEN = 200;
export const MAX_FABRIC_LEN = 300;

// A typed standard: matching a list item (any capitals, extra spaces) gives the list's exact spelling; anything else
// is kept as typed ("Other"). Empty = null.
export function normalizeStandard(v: unknown): string | null {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  return SAFETY_STANDARDS.find((x) => x.toLowerCase() === s.toLowerCase()) ?? s;
}

// Standard editions we know have been replaced. Typing one shows a small note under the field; it never blocks saving,
// and what was typed is kept (a customer may still ask for the older edition). Add more here; nowhere else.
export const REPLACED_EDITIONS: ReadonlyArray<{ match: RegExp; old: string; current: string }> = [
  { match: /\bZ96\s*[-\u2010-\u2013]\s*15(?!\d)/i, old: 'CSA Z96-15', current: 'CSA Z96:22' },
];

export function replacedEditionNote(v: unknown): string | null {
  const s = String(v ?? '');
  const hit = REPLACED_EDITIONS.find((e) => e.match.test(s));
  return hit ? `${hit.old} has been replaced by ${hit.current}. Keep it only if the customer asked for the older edition.` : null;
}
