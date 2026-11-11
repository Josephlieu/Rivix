// Server-only helpers shared by the AI scan (/api/analyze-garment) and the type suggestion (/api/analyze-garment/detect):
// the request's photos from private storage, one Gemini call with a JSON answer format (main model, then the fallback), and
// error messages an admin can act on.
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_FALLBACK_MODEL, GEMINI_VISION_MODEL, askWithFallback, isQuotaError, isTimeoutError, isBusyError, noModelAnsweredMessage, callSignal, OutOfTimeError, scanNote } from '@/lib/gemini-model';
import { REPLICATION_BUCKET } from '@/lib/replication-server';

type ImagePart = { inlineData: { data: string; mimeType: string } };

/** The request's photos as base64 data URLs, in display order (at most `limit`). */
export async function loadRequestPhotos(admin: SupabaseClient, images: unknown, limit = 12): Promise<string[]> {
  const out: string[] = [];
  for (const path of (Array.isArray(images) ? images : []).filter((p): p is string => typeof p === 'string').slice(0, limit)) {
    const { data: blob } = await admin.storage.from(REPLICATION_BUCKET).download(path);
    if (!blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());
    out.push(`data:${blob.type || 'image/jpeg'};base64,${buf.toString('base64')}`);
  }
  return out;
}

/** Data URLs to Gemini image parts; null when one is not a base64 image. */
export function toImageParts(images: string[]): ImagePart[] | null {
  const parts: ImagePart[] = [];
  for (const s of images) {
    const m = s.match(/^data:(.*?);base64,([\s\S]+)$/);
    if (!m) return null;
    parts.push({ inlineData: { data: m[2], mimeType: m[1] } });
  }
  return parts;
}

/**
 * One question to Gemini with the photos and a strict JSON answer format. The best image model first, then the fallback.
 * If the model refuses the strict format together with Google Search (400), it is asked again the old way; the reply is read by
 * the same tolerant parser either way. Every call has a time limit inside the route's budget (`deadline`).
 */
export function geminiAsker(imageParts: ImagePart[], deadline: number, useSearch = false) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const isBadRequest = (e: unknown) => /INVALID_ARGUMENT|"code":\s*400/i.test(e instanceof Error ? e.message : String(e));
  const signal = () => { const sg = callSignal(deadline); if (!sg) throw new OutOfTimeError(); return sg; };
  const result = { note: '', model: '' };
  const ask = async (prompt: string, schema: Record<string, unknown>): Promise<string> => {
    const contents = [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }];
    const one = async (model: string, withSearch: boolean) => {
      const tools = withSearch ? { tools: [{ googleSearch: {} }] } : {};
      try {
        return await ai.models.generateContent({ model, contents, config: { ...tools, responseMimeType: 'application/json', responseJsonSchema: schema, abortSignal: signal() } });
      } catch (e) {
        if (!isBadRequest(e)) throw e;
        return ai.models.generateContent({ model, contents, config: { ...tools, abortSignal: signal() } });
      }
    };
    const models = Array.from(new Set([GEMINI_VISION_MODEL, GEMINI_FALLBACK_MODEL]));
    const { response, model, searchSkipped } = await askWithFallback(models, one, { search: useSearch });
    result.note = scanNote(models, model, searchSkipped);
    result.model = model;
    return response.text ?? '';
  };
  return { ask, result };
}

/** What went wrong, in words the admin can act on (the raw message goes in `details`). */
export function aiErrorResponse(error: unknown, task: string, fallback: string) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const friendly = noModelAnsweredMessage(error, task) ?? (isQuotaError(error)
    ? 'The AI service has reached its usage limit (Google Gemini quota). Wait a while and try again, or check the plan and billing of the Gemini key.'
    : isTimeoutError(error)
      ? 'The AI did not answer in time. Try again in a few minutes.'
      : isBusyError(error)
        ? 'The AI service is busy right now (Google reports high demand). This is usually temporary: try again in a few minutes.'
        : /API key|PERMISSION_DENIED|"code":40[13]/i.test(message)
          ? 'The Gemini API key was refused. Check GEMINI_API_KEY.'
          : /NOT_FOUND|"code":404/i.test(message)
            ? 'The AI model name was not found. Check GEMINI_VISION_MODEL and GEMINI_FALLBACK_MODEL.'
            : fallback);
  return NextResponse.json({ error: friendly, details: message.slice(0, 500) }, { status: isQuotaError(error) ? 429 : isTimeoutError(error) ? 504 : isBusyError(error) ? 503 : 500 });
}
