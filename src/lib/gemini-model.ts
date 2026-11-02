// The Gemini model used by the AI routes (resume reader, garment analyzer). Google retires older
// models for new keys (gemini-2.5-flash already is), so this lives in one place and can be changed
// without a code edit by setting GEMINI_MODEL in the environment.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// The model that reads garment photos (Replication Queue). Free tier by default (user's decision, 2026-10-31); set
// GEMINI_VISION_MODEL=gemini-4-argon (Google's best image reader, paid only) once the client turns on billing.
// If it is out of quota or busy, the scan falls back to GEMINI_MODEL and says so.
export const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-3.8-flash';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const isQuotaError = (e: unknown) => /RESOURCE_EXHAUSTED|"code":\s*429|quota/i.test(errText(e));
const isUnavailable = (e: unknown) => /UNAVAILABLE|NOT_FOUND|"code":\s*(404|500|503)/i.test(errText(e));

/**
 * Asks each model in turn, first with Google Search and then without it when search is out of quota.
 * Moves on to the next model only when one is out of quota, busy or not found; any other error is thrown.
 */
export async function askWithFallback<T>(models: string[], ask: (model: string, withSearch: boolean) => Promise<T>) {
  for (const [i, model] of models.entries()) {
    try {
      try {
        return { response: await ask(model, true), model, searchSkipped: false };
      } catch (e) {
        if (!isQuotaError(e)) throw e;
        return { response: await ask(model, false), model, searchSkipped: true };
      }
    } catch (e) {
      if (i === models.length - 1 || !(isQuotaError(e) || isUnavailable(e))) throw e;
    }
  }
  throw new Error('No AI model to ask');
}
