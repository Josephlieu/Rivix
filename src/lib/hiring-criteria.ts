// What a candidate is scored on. The admin can edit this list on the Hiring page; the defaults
// below are the original five sales-rep categories. Shared by the page and the server (no secrets here).

export interface Criterion {
  id: string;          // stable key the scores are saved under (never changes when the label is renamed)
  label: string;       // shown to the admin
  description: string; // what to look for: also given to the AI that reads resumes
  weight: number;      // percent; all weights add up to 100
}

export const MAX_CRITERIA = 8;

export const DEFAULT_HIRING_FOR =
  'an Outbound Sales Representative for RIVIX, a Canadian apparel manufacturer (head office in Vancouver, BC) that supplies uniform, workwear and PPE programs to industrial, construction, oil, mining and energy teams. The role is remote and full-time, with the main focus on Alberta';

export const DEFAULT_CRITERIA: Criterion[] = [
  { id: 'existingRolodex', label: 'Existing Rolodex', description: 'Active procurement, operations and safety contacts at construction, industrial, oil and gas, mining or trades companies, especially in Alberta.', weight: 30 },
  { id: 'albertaProximity', label: 'Alberta / Western Canada Proximity', description: 'Lives in, or has strong working ties to, Alberta, so they can cover the Alberta market. The role is remote with the main focus on Alberta.', weight: 20 },
  { id: 'industryKnowledge', label: 'Industry Knowledge', description: 'Knows workwear, uniform or PPE programs and the industrial or safety buyers who purchase them (for example high-visibility and flame-resistant garments).', weight: 20 },
  { id: 'competitiveIntel', label: 'Competitive Intel', description: "Has worked for, or knows the playbook of, uniform and workwear suppliers such as UniFirst, Cintas, Aramark or Mark's.", weight: 15 },
  { id: 'salesMethodology', label: 'Sales Methodology', description: 'A structured, proven B2B outbound approach: daily cold and warm calls, booking meetings, qualifying deals, closing accounts and managing repeat orders.', weight: 15 },
];

/** A candidate's scores, saved by criterion id. A missing id means "not scored yet". */
export type Scorecard = Record<string, number>;

/**
 * Weighted score out of 10, counting only the categories that have a score (so a category added
 * later, which older candidates were never scored on, doesn't drag their total down).
 * Returns null when nothing has been scored.
 */
export function computeScore(scorecard: Scorecard | null | undefined, criteria: Criterion[]): number | null {
  let sum = 0;
  let weights = 0;
  for (const c of criteria) {
    const v = scorecard?.[c.id];
    if (typeof v === 'number' && Number.isFinite(v)) { sum += v * c.weight; weights += c.weight; }
  }
  return weights > 0 ? Math.round((sum / weights) * 10) / 10 : null;
}

export const TIER_1_MIN = 7.0;
export const TIER_2_MIN = 5.5;

/** How many of the current categories this candidate has a score for. */
export const scoredCount = (scorecard: Scorecard | null | undefined, criteria: Criterion[]) =>
  criteria.filter((c) => typeof scorecard?.[c.id] === 'number').length;

/** Checks a list of criteria. Returns an error message, or the cleaned list. */
export function cleanCriteria(input: unknown): { error: string } | { criteria: Criterion[] } {
  if (!Array.isArray(input) || input.length < 1) return { error: 'Add at least one category.' };
  if (input.length > MAX_CRITERIA) return { error: `Use at most ${MAX_CRITERIA} categories.` };

  const seen = new Set<string>();
  const out: Criterion[] = [];
  for (const raw of input) {
    const label = String(raw?.label ?? '').trim().slice(0, 60);
    if (!label) return { error: 'Every category needs a name.' };
    let id = String(raw?.id ?? '');
    if (!/^[A-Za-z0-9_]{1,40}$/.test(id) || seen.has(id)) {
      id = `c_${Math.random().toString(36).slice(2, 10)}`; // new category
    }
    seen.add(id);
    const weight = Number(raw?.weight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) return { error: `"${label}": the weight must be between 0 and 100.` };
    out.push({ id, label, description: String(raw?.description ?? '').trim().slice(0, 300), weight: Math.round(weight * 100) / 100 });
  }
  const total = out.reduce((n, c) => n + c.weight, 0);
  if (Math.abs(total - 100) > 0.01) return { error: `The weights must add up to 100% (they add up to ${Math.round(total * 100) / 100}%).` };
  return { criteria: out };
}
