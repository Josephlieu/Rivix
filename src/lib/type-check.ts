// Task 28, step 1: the product type must be confirmed by an admin before the AI fills in a tech file. The type picked on the
// new-request form is only a starting guess. The AI can suggest a type from the photos (only when an admin asks), with a
// confidence and a one-line reason; the admin uses it or picks another by hand.
// Stored in the request's specs as `typeCheck` (admin only). The server owns it: a normal save keeps the stored value,
// whatever the browser sends (replication-server.ts). Client-safe, relative imports only (the tests load this file directly).
import { DATA_RULE } from './garmentAiPrompt';
import { cleanCopied } from './garmentAiAnalysis';

export interface TypeSuggestion {
  typeKey: string | null; // null when the AI thinks it is nothing RIVIX makes ("none")
  categoryKey: string | null;
  confidence: number; // 0 to 100
  reason: string; // one line, shown as plain text
  alternatives: Array<{ typeKey: string; confidence: number }>;
  at: string;
  model?: string;
}
export interface TypeCheck {
  suggestion?: TypeSuggestion;
  confirmedType?: string;
  confirmedBy?: string;
  confirmedAt?: string;
}

type Row = Record<string, unknown>;
export const TYPE_CHECK_KEY = 'typeCheck';

export function typeCheckOf(specs: unknown): TypeCheck | null {
  const tc = specs && typeof specs === 'object' ? (specs as Row)[TYPE_CHECK_KEY] : null;
  return tc && typeof tc === 'object' && !Array.isArray(tc) ? (tc as TypeCheck) : null;
}

/**
 * Is the request's product type confirmed? Yes when an admin confirmed exactly the type the request has now. A request scanned
 * before task 28 (it has a draft and was never confirmed) counts as confirmed: its type was used then, and it keeps working.
 */
export function isTypeConfirmed(r: { garmentType: string | null | undefined; specs: unknown; aiAnalysis?: unknown }): boolean {
  const tc = typeCheckOf(r.specs);
  if (tc?.confirmedType) return tc.confirmedType === r.garmentType;
  return !!r.aiAnalysis;
}

// ---- the AI suggestion ---------------------------------------------------------------------------------------------------------
export interface DetectType { key: string; label: string; category: string }
export interface DetectCategory { key: string; label: string }
export const NONE = 'none';

export const detectSchema = (types: DetectType[]) => {
  const keys = { type: 'string', enum: [...types.map((t) => t.key), NONE] };
  return {
    type: 'object',
    properties: {
      typeKey: keys,
      confidence: { type: 'number' },
      reason: { type: 'string' },
      alternatives: { type: 'array', items: { type: 'object', properties: { typeKey: keys, confidence: { type: 'number' } }, required: ['typeKey', 'confidence'] } },
    },
    required: ['typeKey', 'confidence', 'reason', 'alternatives'],
  };
};

export function buildDetectPrompt(i: { types: DetectType[]; categories: DetectCategory[]; photoCount: number }): string {
  const list = i.categories
    .map((c) => `${c.label}:\n${i.types.filter((t) => t.category === c.key).map((t) => `- ${t.key}: ${t.label}`).join('\n')}`)
    .filter((block) => block.includes('\n- '))
    .join('\n\n');
  return `You help RIVIX, a Canadian supplier of workwear, protective clothing, gloves, footwear and PPE. Look at the ${i.photoCount} photo(s) of ONE product and say which product type in the list below it is. A person confirms your answer before anything else happens.

${DATA_RULE}

Rules:
- Judge by what the photos show (shape, parts, materials you can see). A brand, a logo or a printed claim does not decide the type.
- Ignore the person, mannequin, hand or foot, the background, and any other item in the photo.
- typeKey: exactly one key from the list. If the product is not in the list, or it is a hard hat, bump cap or other head protection (out of scope), answer "${NONE}".
- confidence: 0 to 100, how sure you are. Lower it for blurry, cropped or conflicting photos, or when two types fit.
- reason: ONE short line in plain words saying what you see that decides it (for example "Knit shell with a grey coating on the palm and fingers"). No standards, no ratings.
- alternatives: up to 2 other keys from the list that could also fit, with their confidence; [] if none.

Product types, by category:
${list}

Return ONE JSON object and nothing else:
{ "typeKey": "string", "confidence": number, "reason": "string", "alternatives": [ { "typeKey": "string", "confidence": number } ] }`;
}

const pct = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0; };

/** Reads the AI's answer. Only a real, active type is accepted; the category always comes from the type itself. */
export function readDetection(raw: unknown, types: DetectType[], model?: string): TypeSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Row;
  const key = typeof r.typeKey === 'string' ? r.typeKey.trim() : '';
  const hit = types.find((t) => t.key === key);
  if (!hit && key !== NONE) return null;
  const alternatives = (Array.isArray(r.alternatives) ? r.alternatives : [])
    .map((a) => (a && typeof a === 'object' ? (a as Row) : {}))
    .filter((a) => typeof a.typeKey === 'string' && a.typeKey !== key && types.some((t) => t.key === a.typeKey))
    .slice(0, 2)
    .map((a) => ({ typeKey: String(a.typeKey), confidence: pct(a.confidence) }));
  return {
    typeKey: hit ? hit.key : null,
    categoryKey: hit ? hit.category : null,
    confidence: pct(r.confidence),
    reason: cleanCopied(r.reason, 200).replace(/\s*\n\s*/g, ' '),
    alternatives,
    at: new Date().toISOString(),
    ...(model ? { model } : {}),
  };
}
