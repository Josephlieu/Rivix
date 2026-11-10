import { GEMINI_FALLBACK_MODEL, GEMINI_VISION_MODEL, scanSearchEnabled, askWithFallback, isQuotaError, isTimeoutError, isBusyError, callSignal, OutOfTimeError, scanNote } from '@/lib/gemini-model';
import { NextRequest, NextResponse } from 'next/server';
import { getReplicationActor, unauthorized, canAccess } from '@/lib/replication-access';
import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '@/lib/supabase-admin';
import { isValidReplicationId, REPLICATION_BUCKET } from '@/lib/replication-server';
import { resolveTemplate } from '@/lib/template-catalog';
import { getTemplateCatalog } from '@/lib/template-store';
import { applyTemplate, FLAGGABLE, SUGGESTABLE, type GivenValues } from '@/lib/garmentAiAnalysis';
import { buildGarmentPrompt } from '@/lib/garmentAiPrompt';
import { GARMENT_RESPONSE_SCHEMA } from '@/lib/garmentAiSchema';
import { garmentTypeLabel } from '@/lib/garment-types-data';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Time (task 11). The host stops this route after maxDuration seconds; every AI call has its own limit (gemini-model.ts),
// and all calls together stay inside SCAN_BUDGET_MS, so the admin always gets an answer before the host cuts the route off.
// Needs a Vercel plan/setting that allows 300 s (Fluid compute, on by default for new projects; see audit-docs/31-scan-check.md).
export const maxDuration = 300;
const SCAN_BUDGET_MS = 270_000;

/** The reply is JSON, but older models (or the old way of asking) may wrap it in text or a code fence: read it tolerantly. */
function parseJsonFromModel(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('No JSON object found in model response');
  }
}

export async function POST(req: NextRequest) {
  const deadline = Date.now() + SCAN_BUDGET_MS;
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  // Tech files are admin only (task 33): a rep cannot see the result, so a rep cannot start the scan either.
  if (actor.kind !== 'admin') return NextResponse.json({ error: 'The AI scan is run by RIVIX admin.' }, { status: 403 });

  try {
    const body = await req.json();
    let garmentKey: string | null = typeof body.garmentType === 'string' ? body.garmentType : null; // loose images: the admin may say what it is
    let customerNotes = '';
    const given: GivenValues = {}; // what the customer wrote on the request form
    let imageArray: string[] = body.images
      ? (body.images as string[])
      : body.image
        ? [body.image as string]
        : [];

    // Photos of a saved request are read from private storage (the browser only sends the request id).
    if (body.replicationId !== undefined) {
      if (!isValidReplicationId(body.replicationId)) {
        return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
      }
      const admin = createAdminClient();
      const { data: row } = await admin.from('replications').select('*').eq('id', body.replicationId).maybeSingle();
      if (!row || !canAccess(actor, row)) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
      garmentKey = row.garment_type ?? garmentKey;
      const sp = (row.specs && typeof row.specs === 'object' ? row.specs : {}) as Record<string, unknown>;
      const said = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string).trim().slice(0, 300) : '');
      customerNotes = said('specialInstructions');
      given['fabricAnalysis.material'] = said('coreMaterial');
      given['fabricAnalysis.weight'] = said('fabricWeight');
      given['washCare.instructions'] = said('careText');
      imageArray = [];
      for (const path of (Array.isArray(row.images) ? row.images : []) as string[]) {
        const { data: blob } = await admin.storage.from(REPLICATION_BUCKET).download(path);
        if (!blob) continue;
        const buf = Buffer.from(await blob.arrayBuffer());
        imageArray.push(`data:${blob.type || 'image/jpeg'};base64,${buf.toString('base64')}`);
      }
    }

    if (body.replicationId === undefined && actor.kind !== 'admin') {
      return NextResponse.json({ error: 'Only an admin can scan loose images.' }, { status: 403 });
    }

    if (imageArray.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
    for (const imageStr of imageArray) {
      const matches = imageStr.match(/^data:(.*?);base64,([\s\S]+)$/);
      if (!matches || matches.length !== 3) {
        const prefix = imageStr.substring(0, 100);
        return NextResponse.json(
          { error: `Invalid image format. Expected base64 data URL. Got: ${prefix}` },
          { status: 400 }
        );
      }
      imageParts.push({
        inlineData: {
          data: matches[2],
          mimeType: matches[1],
        },
      });
    }

    // The garment type's template: its checklist goes into the prompt, and the answer is merged back into it (measurement points come from the template).
    let savedFamily: string | null = null;
    if (garmentKey) {
      const { data: gt } = await createAdminClient().from('garment_types').select('template_family').eq('key', garmentKey).maybeSingle();
      savedFamily = (gt?.template_family as string | null) ?? null;
    }
    const template = resolveTemplate(garmentKey || 'jacket', savedFamily, await getTemplateCatalog());
    const typeName = garmentKey ? garmentTypeLabel(garmentKey) : 'unknown';
    const checklistText = template.checklist.map((i) => `- ${i.key}: ${i.label}${i.required ? ' (required)' : ''}`).join('\n');

    const useSearch = scanSearchEnabled();
    const prompt = buildGarmentPrompt({
      searchAvailable: useSearch,
      photoCount: imageArray.length,
      typeName,
      customerNotes,
      checklistText,
      flagList: Object.keys(FLAGGABLE).join(', '),
      suggestList: Array.from(SUGGESTABLE).join(', '),
    });

    // Strict answer format (a JSON schema) so the reply is always valid JSON. Google says Gemini 3 models can combine it with
    // Google Search, but that is a preview; if the model refuses the combination (400), ask again the old way. The reply is
    // read by the same tolerant parser either way.
    const isBadRequest = (e: unknown) => /INVALID_ARGUMENT|"code":\s*400/i.test(e instanceof Error ? e.message : String(e));
    // Every call gets a time limit (and none starts without enough of the budget left).
    const signal = () => { const sg = callSignal(deadline); if (!sg) throw new OutOfTimeError(); return sg; };
    const ask = async (model: string, withSearch: boolean) => {
      const contents = [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }];
      const tools = withSearch ? { tools: [{ googleSearch: {} }] } : {};
      try {
        return await ai.models.generateContent({ model, contents, config: { ...tools, responseMimeType: 'application/json', responseJsonSchema: GARMENT_RESPONSE_SCHEMA, abortSignal: signal() } });
      } catch (e) {
        if (!isBadRequest(e)) throw e;
        return ai.models.generateContent({ model, contents, config: { ...tools, abortSignal: signal() } });
      }
    };

    // The best image model first, then the standard one. Google Search (used to recognise known retail products) has its
    // own quota; when that is used up, the photos are still analysed without it rather than failing the whole scan.
    // Google Search is off unless GEMINI_SCAN_SEARCH=1 (task 11): then each model is asked once, from the photos only.
    const models = Array.from(new Set([GEMINI_VISION_MODEL, GEMINI_FALLBACK_MODEL]));
    const { response, model: usedModel, searchSkipped } = await askWithFallback(models, ask, { search: useSearch });
    const note = scanNote(models, usedModel, searchSkipped);

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
    }

    let analysisData;
    try {
      analysisData = parseJsonFromModel(responseText);
    } catch (parseErr) {
      const parseMessage = parseErr instanceof Error ? parseErr.message : 'Parse failed';
      console.error('Failed to parse Gemini JSON response:', parseMessage, responseText.slice(0, 500));
      return NextResponse.json(
        { error: 'Invalid JSON response from AI', details: parseMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      // The template versions this draft was made with are saved with it (task 26): a template change never alters it.
      analysis: analysisData && typeof analysisData === 'object' ? { ...applyTemplate(analysisData as Record<string, unknown>, template, given), template: { versions: template.versions, certification: template.certification } } : analysisData,
      ...(note ? { note } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error analyzing garment:', error);
    // Say what actually went wrong in words the admin can act on (the raw Google message goes in `details`).
    const friendly = isQuotaError(error)
      ? 'The AI service has reached its usage limit (Google Gemini quota). Wait a while and try again, or check the plan and billing of the Gemini key.'
      : isTimeoutError(error)
        ? 'The AI did not answer in time. Try again in a few minutes.'
        : isBusyError(error)
          ? 'The AI service is busy right now (Google reports high demand). This is usually temporary: try again in a few minutes.'
      : /API key|PERMISSION_DENIED|"code":40[13]/i.test(message)
        ? 'The Gemini API key was refused. Check GEMINI_API_KEY.'
        : /NOT_FOUND|"code":404/i.test(message)
          ? 'The AI model name was not found. Check GEMINI_VISION_MODEL and GEMINI_FALLBACK_MODEL.'
          : 'Failed to process garment analysis';
    return NextResponse.json({ error: friendly, details: message.slice(0, 500) }, { status: isQuotaError(error) ? 429 : isTimeoutError(error) ? 504 : isBusyError(error) ? 503 : 500 });
  }
}
