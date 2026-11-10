// The Gemini model used by the AI routes (resume reader, garment analyzer). Google retires older
// models for new keys (gemini-2.5-flash already is), so this lives in one place and can be changed
// without a code edit by setting GEMINI_MODEL in the environment.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// The model that reads garment photos (Replication Queue). Free tier by default (user's decision, 2026-10-31); set
// GEMINI_VISION_MODEL=gemini-4-argon (Google's best image reader, paid only) once the client turns on billing.
// If it is out of quota, busy or does not answer in time, the scan falls back to GEMINI_FALLBACK_MODEL and says so.
export const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-3.8-flash';

// The garment scan's fallback when the vision model is busy (task 11: gemini-3.8-flash answered "high demand"). A
// different model on purpose, so there is something else to try. Only the scan uses it; GEMINI_MODEL stays the main
// model of the hiring tools (resume reader, interview questions).
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';

// Google Search in the garment scan: OFF unless GEMINI_SCAN_SEARCH=1 (task 11). It was only used to check a brand and
// model printed on the garment; for a copy that adds nothing, it costs a separate quota, it is the likeliest cause of a
// 5-minute hang, and it is the only way web content could enter a scan.
export const scanSearchEnabled = () => process.env.GEMINI_SCAN_SEARCH === '1';

const errText = (e: unknown) => (e instanceof Error ? `${e.name} ${e.message} ${String((e as { cause?: { code?: string } }).cause?.code ?? '')}` : String(e));
export const isQuotaError = (e: unknown) => /RESOURCE_EXHAUSTED|"code":\s*429|quota/i.test(errText(e));
// The AI did not answer in time: our own time limit (TimeoutError / AbortError) or the connection giving up (headers timeout).
export const isTimeoutError = (e: unknown) => /TimeoutError|AbortError|aborted|timed out|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|DEADLINE_EXCEEDED|"code":\s*504/i.test(errText(e));
// Google is busy or overloaded for a moment ("high demand", 503 UNAVAILABLE): worth trying again later.
export const isBusyError = (e: unknown) => /UNAVAILABLE|high demand|overloaded|"code":\s*503/i.test(errText(e));
const isUnavailable = (e: unknown) => isTimeoutError(e) || isBusyError(e) || /NOT_FOUND|"code":\s*(404|500)/i.test(errText(e));

// Time limits for one AI request (task 11: a call once hung for 5 minutes with no answer). Every call gets at most
// AI_CALL_LIMIT_MS, and all calls of one request together stay inside the budget the route passes in, so the whole request
// always ends before the route's maxDuration.
export const AI_CALL_LIMIT_MS = 120_000;
export const AI_MIN_CALL_MS = 20_000; // not worth starting a call with less time than this left

/** An abort signal for the next call: the per-call limit, or what is left of the budget if that is less. Null = no time left. */
export function callSignal(deadline: number): AbortSignal | null {
  const left = deadline - Date.now() - 5_000; // keep a few seconds to answer the browser
  if (left < AI_MIN_CALL_MS) return null;
  return AbortSignal.timeout(Math.min(AI_CALL_LIMIT_MS, left));
}
export class OutOfTimeError extends Error { constructor() { super('timed out: no time left for another AI call'); this.name = 'TimeoutError'; } }

/**
 * Asks each model in turn, first with Google Search and then without it when search is out of quota or did not answer in
 * time. Moves on to the next model only when one is out of quota, busy, not found or timed out; any other error is thrown.
 * `searchSkipped` says why the answer came without search ('quota' or 'timeout'), or false.
 */
export async function askWithFallback<T>(models: string[], ask: (model: string, withSearch: boolean) => Promise<T>, opts: { search?: boolean } = {}) {
  const search = opts.search ?? true;
  for (const [i, model] of models.entries()) {
    try {
      if (!search) return { response: await ask(model, false), model, searchSkipped: false as const }; // search turned off: one call per model
      try {
        return { response: await ask(model, true), model, searchSkipped: false as const };
      } catch (e) {
        if (!isQuotaError(e) && !isTimeoutError(e)) throw e;
        return { response: await ask(model, false), model, searchSkipped: (isQuotaError(e) ? 'quota' : 'timeout') as 'quota' | 'timeout' };
      }
    } catch (e) {
      if (i === models.length - 1 || !(isQuotaError(e) || isUnavailable(e))) throw e;
    }
  }
  throw new Error('No AI model to ask');
}

/** The note shown to the admin above a scan result when it did not come from the first choice (empty = nothing to say). */
export function scanNote(models: string[], usedModel: string, searchSkipped: false | 'quota' | 'timeout'): string {
  return [
    usedModel !== models[0] ? `The main image model (${models[0]}) was not available (no quota or billing on the Gemini key, busy, or no answer in time), so this scan used ${usedModel} and may be less accurate.` : '',
    searchSkipped === 'quota' ? 'Google Search was out of quota, so this analysis uses the photos only (no retail product lookup).' : '',
    searchSkipped === 'timeout' ? 'The first try (with Google Search) did not answer in time, so this analysis was made again from the photos only (no retail product lookup).' : '',
  ].filter(Boolean).join(' ');
}
