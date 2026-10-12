import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { cleanCriteria, DEFAULT_HIRING_FOR } from '@/lib/hiring-criteria';
import { getHiringSettingsServer } from '@/lib/hiring-settings-server';
import { DEFAULT_COMPANY_CONTEXT, DEFAULT_SCORING_GUIDE, MAX_CONTEXT_CHARS, MAX_GUIDE_CHARS } from '@/lib/hiring-prompts';

// What candidates are scored on, and who the resume reader is told we are hiring. Admin only.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json(await getHiringSettingsServer());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load the settings.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const parsed = cleanCriteria(body.criteria);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const hiringFor = String(body.hiringFor ?? '').trim().slice(0, 300) || DEFAULT_HIRING_FOR;

  // The background text: empty means "use the draft"; over the limit is refused (not silently cut).
  const companyContext = String(body.companyContext ?? '').trim();
  const scoringGuide = String(body.scoringGuide ?? '').trim();
  if (companyContext.length > MAX_CONTEXT_CHARS) return NextResponse.json({ error: `The background is too long (${companyContext.length} of ${MAX_CONTEXT_CHARS} characters).` }, { status: 400 });
  if (scoringGuide.length > MAX_GUIDE_CHARS) return NextResponse.json({ error: `The scoring guide is too long (${scoringGuide.length} of ${MAX_GUIDE_CHARS} characters).` }, { status: 400 });

  const admin = createAdminClient();
  const base = { id: 'default', criteria: parsed.criteria, hiring_for: hiringFor, updated_at: new Date().toISOString() };
  let contextNotSaved: string | undefined;
  let { error } = await admin
    .from('hiring_settings')
    .upsert({ ...base, company_context: companyContext || null, scoring_guide: scoringGuide || null }, { onConflict: 'id' });
  if (error && /company_context|scoring_guide|schema cache/i.test(error.message)) {
    // The two new columns are not in the database yet (SQL not run): still save everything else.
    contextNotSaved = 'The categories were saved, but the background and scoring guide could not be (run the latest dev-schema-hiring.sql in Supabase). The AI will use the built-in draft text for now.';
    ({ error } = await admin.from('hiring_settings').upsert(base, { onConflict: 'id' }));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    criteria: parsed.criteria,
    hiringFor,
    companyContext: contextNotSaved ? DEFAULT_COMPANY_CONTEXT : companyContext || DEFAULT_COMPANY_CONTEXT,
    scoringGuide: contextNotSaved ? DEFAULT_SCORING_GUIDE : scoringGuide || DEFAULT_SCORING_GUIDE,
    contextNotSaved,
  });
}

export const dynamic = 'force-dynamic';
