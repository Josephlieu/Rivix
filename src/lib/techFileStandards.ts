import type { PersistedGarmentAIAnalysis } from './garmentAiAnalysis';
import type { ReplicationSpec } from './replicationStorage';

// Standard wording a person can pull into a tech file. These are starting points, not compliance advice:
// the tech file marks the testing list "to be confirmed" until a person has checked it with the test lab.

type AnalysisLike = {
  fabricAnalysis?: { frRating?: string } | null;
  colorway?: { reflectiveTape?: string } | null;
};

const none = (v?: string) => !v || /^(none|n\/a|no|not applicable|-)$/i.test(v.trim());

/** Generic textile tests, plus hi-vis and flame-resistance tests when the garment looks like it needs them. */
export function suggestedTests(a: AnalysisLike, safetyRating = ''): string[] {
  const tests = [
    'Colourfastness to laundering: AATCC 61',
    'Colourfastness to light: AATCC 16.3',
    'Colourfastness to crocking: AATCC 8',
    'Dimensional change after laundering: AATCC 135',
    'Fabric weight: ASTM D3776',
    'Fabric tensile strength: ASTM D5034',
    'Fabric tear strength: ASTM D1424',
    'Seam strength: ASTM D1683',
  ];
  const hiVis = !none(a.colorway?.reflectiveTape) || /hi-?vis|z96|20471|reflective/i.test(safetyRating);
  const fr = !none(a.fabricAnalysis?.frRating) || /\bfr\b|flame|nfpa|2112|arc/i.test(safetyRating);
  if (hiVis) tests.push('High-visibility performance (fluorescent fabric and retroreflective tape): CSA Z96 / ISO 20471', 'Retroreflective tape after laundering: ISO 20471');
  if (fr) tests.push('Flame resistance: NFPA 2112 / CGSB 155.20 (as applicable)');
  return tests;
}

// English care phrase (lower case, no trailing full stop) -> French. Matching is "contains".
const FR_CARE: Array<[string, string]> = [
  ['machine wash cold', "Laver à la machine à l'eau froide"],
  ['machine wash warm', "Laver à la machine à l'eau tiède"],
  ['machine wash hot', "Laver à la machine à l'eau chaude"],
  ['do not bleach', "Ne pas utiliser d'eau de Javel"],
  ['non-chlorine bleach', "Utiliser seulement un agent de blanchiment sans chlore"],
  ['tumble dry low', 'Sécher à basse température'],
  ['tumble dry medium', 'Sécher à température moyenne'],
  ['do not tumble dry', 'Ne pas sécher à la machine'],
  ['line dry', 'Sécher sur la corde'],
  ['hang dry', "Sécher à l'air libre"],
  ['cool iron', 'Repasser à basse température'],
  ['iron low', 'Repasser à basse température'],
  ['do not iron', 'Ne pas repasser'],
  ['do not dry clean', 'Ne pas nettoyer à sec'],
  ['dry clean only', 'Nettoyage à sec seulement'],
  ['wash separately', 'Laver séparément'],
  ['wash inside out', "Laver à l'envers"],
  ['wash with like colours', 'Laver avec des couleurs semblables'],
  ['wash with like colors', 'Laver avec des couleurs semblables'],
  ['do not use fabric softener', "Ne pas utiliser d'assouplissant"],
  ['do not wring', 'Ne pas tordre'],
];

/** French lines for the English ones, in the same order. A phrase with no standard translation gives an empty line. */
export function suggestFrenchCare(english: string[]): { fr: string[]; missing: number } {
  const fr = english.map(line => {
    const key = line.toLowerCase().replace(/[.\s]+$/g, '').trim();
    return FR_CARE.find(([en]) => key.includes(en))?.[1] ?? '';
  });
  return { fr, missing: fr.filter((l, i) => !l && english[i].trim()).length };
}

// ---- Basic specification, drafted from the AI analysis -------------------------------------------------
const clean = (v?: string | null) => (v && !/^(none|n\/a|no|not applicable|unknown|-)$/i.test(v.trim()) ? v.trim() : '');
const uniq = (list: string[]) => [...new Set(list.map(x => x.trim()).filter(Boolean))];

/**
 * Fills the BLANK basic-specification fields from the AI analysis. Anything a person already typed is kept.
 * Returns the new specs and how many fields were filled. The values are drafts: the review step checks them.
 */
export function prefillSpecs(specs: ReplicationSpec, a: Partial<PersistedGarmentAIAnalysis> | null | undefined): { specs: ReplicationSpec; filled: number } {
  if (!a) return { specs, filled: 0 };
  const comps = a.components || [];
  const hardware = a.bom?.hardware || [];
  const ofType = (...types: string[]) => comps.filter(c => types.includes(c.type)).map(c => c.label);
  const hw = (re: RegExp) => hardware.filter(h => re.test(h));
  const seams = (a.construction || []).map(c => [c.seamType, c.stitchType && `(${c.stitchType})`].filter(Boolean).join(' '));

  const draft: Partial<Record<keyof ReplicationSpec, string>> = {
    // Only a real flame-resistance rating (not "Non-FR ...") goes into Safety compliance; hi-vis standards come from the customer or a person.
    safetyRating: /^non[- ]?fr/i.test(a.fabricAnalysis?.frRating || '') ? '' : clean(a.fabricAnalysis?.frRating),
    coreMaterial: clean(a.fabricAnalysis?.material),
    fabricWeight: clean(a.fabricAnalysis?.weight),
    zippers: uniq([...ofType('zipper'), ...hw(/zip/i)]).slice(0, 4).join('; '),
    buttonsSnaps: uniq([...ofType('snap', 'button'), ...hw(/snap|button|hook|velcro|loop/i)]).slice(0, 4).join('; '),
    reflectiveStriping: clean(a.colorway?.reflectiveTape) || uniq(ofType('reflective')).slice(0, 3).join('; '),
    pocketsCount: uniq(ofType('pocket')).slice(0, 5).join('; '),
    seamConstruction: uniq(seams).slice(0, 3).join('; '),
  };

  const next = { ...specs };
  let filled = 0;
  for (const [k, v] of Object.entries(draft) as Array<[keyof ReplicationSpec, string]>) {
    if (v && !String(next[k] ?? '').trim()) { (next as Record<string, unknown>)[k] = v; filled++; }
  }
  return { specs: next, filled };
}
