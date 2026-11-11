// The Gemini model used by the hiring tools (resume reader, interview questions). Google retires older
// models for new keys (gemini-2.5-flash already is), so this lives in one place and can be changed
// without a code edit by setting GEMINI_MODEL in the environment. Default gemini-3-flash-preview (2026-11-12):
// gemini-3.8-flash did not answer a one-word call in 45 s, so every call waited for the time limit before the fallback.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

// The model that reads garment photos (Replication Queue). Default gemini-3-flash-preview (2026-11-12: a real scan of a
// hi-vis vest answered in 21 s; gemini-3.8-flash never answered). Set GEMINI_VISION_MODEL to change it without a code edit.
// If it is out of quota, busy or does not answer in time, the scan falls back to GEMINI_FALLBACK_MODEL and says so.
export const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-3-flash-preview';

// The fallback when the first model is busy, out of quota, retired or too slow (task 11: gemini-3.8-flash, the old
// default, answered "high demand" for days, then not at all). Used by the garment scan AND the hiring tools (resume reader, interview questions). A different model on
// purpose, so there is something else to try. gemini-3.1-flash-lite was chosen after a real image call answered (2026-11-11);
// gemini-2.5-flash, the first choice, is retired by Google for new keys. Only choose a model that answers a real call.
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';

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
export function callSignal(deadline: number, perCallMs: number = AI_CALL_LIMIT_MS): AbortSignal | null {
  const left = deadline - Date.now() - 5_000; // keep a few seconds to answer the browser
  if (left < AI_MIN_CALL_MS) return null;
  return AbortSignal.timeout(Math.min(perCallMs, left));
}
export class OutOfTimeError extends Error { constructor() { super('timed out: no time left for another AI call'); this.name = 'TimeoutError'; } }

/**
 * Asks each model in turn, first with Google Search and then without it when search is out of quota or did not answer in
 * time. Moves on to the next model only when one is out of quota, busy, not found or timed out; any other error is thrown.
 * `searchSkipped` says why the answer came without search ('quota' or 'timeout'), or false.
 */
export async function askWithFallback<T>(models: string[], ask: (model: string, withSearch: boolean) => Promise<T>, opts: { search?: boolean } = {}) {
  const search = opts.search ?? true;
  const attempts: ModelAttempt[] = []; // what happened to each model, for a clear message when none of them answered
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
      attempts.push({ model, outcome: attemptOutcome(e) });
      if (i === models.length - 1 || !(isQuotaError(e) || isUnavailable(e))) throw Object.assign(e instanceof Error ? e : new Error(String(e)), { attempts });
    }
  }
  throw new Error('No AI model to ask');
}

// ---- telling the admin what went wrong when no model answered (task 11: "model name not found" hid a timeout) --------------
export type AttemptOutcome = 'timeout' | 'busy' | 'quota' | 'retired' | 'not-found' | 'key' | 'error';
export interface ModelAttempt { model: string; outcome: AttemptOutcome }
export const attemptOutcome = (e: unknown): AttemptOutcome => {
  const t = errText(e);
  if (isQuotaError(e)) return 'quota';
  if (isTimeoutError(e)) return 'timeout';
  if (isBusyError(e)) return 'busy';
  if (/no longer available/i.test(t)) return 'retired';
  if (/NOT_FOUND|"code":\s*404/i.test(t)) return 'not-found';
  if (/API key|PERMISSION_DENIED|"code":\s*40[13]/i.test(t)) return 'key';
  return 'error';
};
const OUTCOME_TEXT: Record<AttemptOutcome, string> = {
  timeout: 'did not answer in time',
  busy: 'is busy (Google reports high demand)',
  quota: 'is out of quota on this key',
  retired: 'is no longer available to this key (retired by Google)',
  'not-found': 'was not found (check the model name)',
  key: 'refused the API key',
  error: 'gave an error',
};

/** One plain message for the admin listing what happened to each model, or null when there is nothing model-specific to say. */
export function noModelAnsweredMessage(e: unknown, task = 'do the scan'): string | null {
  const attempts = (e as { attempts?: ModelAttempt[] } | null)?.attempts;
  if (!attempts?.length) return null;
  const what = attempts.map((x) => `${x.model} ${OUTCOME_TEXT[x.outcome]}`).join('; ');
  const fix = attempts.some((x) => x.outcome === 'retired' || x.outcome === 'not-found')
    ? ' Set the model settings (GEMINI_VISION_MODEL, GEMINI_MODEL or GEMINI_FALLBACK_MODEL) to a model that runs.'
    : attempts.some((x) => x.outcome === 'key') ? ' Check GEMINI_API_KEY.' : ' Try again in a few minutes.';
  return `The AI could not ${task}: ${what}.${fix}`;
}

/** The note shown to the admin above a scan result when it did not come from the first choice (empty = nothing to say). */
export function scanNote(models: string[], usedModel: string, searchSkipped: false | 'quota' | 'timeout'): string {
  return [
    usedModel !== models[0] ? `The main image model (${models[0]}) was not available (no quota or billing on the Gemini key, busy, or no answer in time), so this scan used ${usedModel} and may be less accurate.` : '',
    searchSkipped === 'quota' ? 'Google Search was out of quota, so this analysis uses the photos only (no retail product lookup).' : '',
    searchSkipped === 'timeout' ? 'The first try (with Google Search) did not answer in time, so this analysis was made again from the photos only (no retail product lookup).' : '',
  ].filter(Boolean).join(' ');
}

// ---- the hiring tools (resume reader, interview questions) -----------------------------------------------------------------
// Same fallback as the scan: GEMINI_MODEL first, then GEMINI_FALLBACK_MODEL, no Google Search, every call time-limited.
// Their routes allow 120 s (maxDuration): each call gets at most 55 s, all inside a 110 s budget, so both models can be tried.
export const HIRING_BUDGET_MS = 110_000;
export const HIRING_CALL_LIMIT_MS = 55_000;
export const hiringModels = () => Array.from(new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL]));

/** Asks the hiring models in turn (busy, quota, retired, not found or too slow: the next one). `call` gets the model and a time limit. */
export async function askHiringModels<T>(call: (model: string, signal: AbortSignal) => Promise<T>, deadline: number, models: string[] = hiringModels()) {
  return askWithFallback(models, (model) => {
    const signal = callSignal(deadline, HIRING_CALL_LIMIT_MS);
    if (!signal) throw new OutOfTimeError();
    return call(model, signal);
  }, { search: false });
}

/** The note for the admin when the answer came from the fallback model (empty = the first model answered). */
export const hiringNote = (models: string[], usedModel: string) =>
  usedModel !== models[0] ? `The main AI model (${models[0]}) was not available, so ${usedModel} was used and the result may be less detailed.` : '';
