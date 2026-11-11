import { scanSearchEnabled } from '@/lib/gemini-model';
import { NextRequest, NextResponse } from 'next/server';
import { getReplicationActor, unauthorized, canAccess } from '@/lib/replication-access';
import { createAdminClient } from '@/lib/supabase-admin';
import { isValidReplicationId } from '@/lib/replication-server';
import { resolveTemplateChecked, TemplateUnavailableError } from '@/lib/template-catalog';
import { getTemplateCatalog } from '@/lib/template-store';
import { type GivenValues } from '@/lib/garmentAiAnalysis';
import { garmentTypeLabel } from '@/lib/garment-types-data';
import { isTypeConfirmed } from '@/lib/type-check';
import { runTemplateScan, EmptyAnswerError } from '@/lib/scan-template';
import { loadRequestPhotos, toImageParts, geminiAsker, aiErrorResponse } from '@/lib/scan-server';
import { allowedGarmentKeys } from '@/lib/garment-types';

// Time (task 11). The host stops this route after maxDuration seconds; every AI call has its own limit (gemini-model.ts),
// and all calls together stay inside SCAN_BUDGET_MS, so the admin always gets an answer before the host cuts the route off.
// Needs a Vercel plan/setting that allows 300 s (Fluid compute, on by default for new projects; see audit-docs/31-scan-check.md).
export const maxDuration = 300;
const SCAN_BUDGET_MS = 270_000;

// The AI scan (task 28, step 2): built from the template of the request's CONFIRMED product type. Nothing is filled in until an
// admin has confirmed the type (step 1, /api/analyze-garment/detect and /api/replications/[id]/type); this is checked here,
// before any photo is read or any AI call is made.
export async function POST(req: NextRequest) {
  const deadline = Date.now() + SCAN_BUDGET_MS;
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  // Tech files are admin only (task 33): a rep cannot see the result, so a rep cannot start the scan either.
  if (actor.kind !== 'admin') return NextResponse.json({ error: 'The AI scan is run by RIVIX admin.' }, { status: 403 });

  try {
    const body = await req.json();
    const admin = createAdminClient();
    let garmentKey: string | null = null;
    let customerNotes = '';
    const given: GivenValues = {}; // what the customer wrote on the request form
    let imageArray: string[] = [];

    if (body.replicationId !== undefined) {
      // Photos of a saved request are read from private storage (the browser only sends the request id).
      if (!isValidReplicationId(body.replicationId)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
      const { data: row } = await admin.from('replications').select('*').eq('id', body.replicationId).maybeSingle();
      if (!row || !canAccess(actor, row)) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
      if (!isTypeConfirmed({ garmentType: row.garment_type, specs: row.specs, aiAnalysis: row.ai_analysis })) {
        return NextResponse.json({ error: 'Confirm the product type first (Product type, on the AI scan tab). The type on the request form is only a starting guess.', code: 'type-not-confirmed' }, { status: 409 });
      }
      garmentKey = row.garment_type;
      const sp = (row.specs && typeof row.specs === 'object' ? row.specs : {}) as Record<string, unknown>;
      const said = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string).trim().slice(0, 300) : '');
      customerNotes = said('specialInstructions');
      given['fabricAnalysis.material'] = said('coreMaterial');
      given['fabricAnalysis.weight'] = said('fabricWeight');
      given['washCare.instructions'] = said('careText');
      imageArray = await loadRequestPhotos(admin, row.images);
    } else {
      // Loose photos (admin only): the admin must say what the product is; that choice is the confirmation.
      const sent = typeof body.garmentType === 'string' ? body.garmentType : '';
      if (!sent || !(await allowedGarmentKeys(admin)).includes(sent)) {
        return NextResponse.json({ error: 'Say what the product is (garmentType) when scanning loose photos.', code: 'type-not-confirmed' }, { status: 409 });
      }
      garmentKey = sent;
      imageArray = Array.isArray(body.images) ? (body.images as string[]) : body.image ? [body.image as string] : [];
    }

    if (imageArray.length === 0) return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    const imageParts = toImageParts(imageArray);
    if (!imageParts) return NextResponse.json({ error: 'Invalid image format. Expected base64 data URL.' }, { status: 400 });

    // The confirmed type's template: its fields, points and notes build the instructions and the answer format.
    // Task 31: never quietly a different template. If the templates (or this type's settings) cannot be read and the type
    // needs more than the built-in templates, stop with a clear message.
    const { data: gt, error: gtErr } = await admin.from('garment_types').select('template_family, template_modules').eq('key', garmentKey).maybeSingle();
    let template;
    try {
      if (gtErr) throw new TemplateUnavailableError();
      template = resolveTemplateChecked(garmentKey!, (gt?.template_family as string | null) ?? null, await getTemplateCatalog(), null, gt ? { family: gt.template_family ?? null, modules: gt.template_modules ?? null } : null);
    } catch (e) {
      if (e instanceof TemplateUnavailableError) return NextResponse.json({ error: e.message, code: 'template-unavailable' }, { status: 503 });
      throw e;
    }
    const useSearch = scanSearchEnabled();
    const gemini = geminiAsker(imageParts, deadline, useSearch);
    let result;
    try {
      result = await runTemplateScan({
        template, typeKey: garmentKey!, typeName: garmentTypeLabel(garmentKey), photoCount: imageArray.length, customerNotes,
        searchAvailable: useSearch, given, ask: gemini.ask,
      });
    } catch (e) {
      if (e instanceof EmptyAnswerError) return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
      if (e instanceof SyntaxError || (e instanceof Error && /No JSON object/.test(e.message))) {
        console.error('Failed to parse Gemini JSON response:', e.message);
        return NextResponse.json({ error: 'Invalid JSON response from AI', details: e.message }, { status: 500 });
      }
      throw e;
    }
    // The template this draft was made with (type, kind, versions) is saved with it: a template change never alters it.
    return NextResponse.json({ status: 'success', analysis: result.analysis, ...(gemini.result.note ? { note: gemini.result.note } : {}) });
  } catch (error: unknown) {
    console.error('Error analyzing garment:', error);
    return aiErrorResponse(error, 'do the scan', 'Failed to process garment analysis');
  }
}
