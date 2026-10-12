import { createAdminClient } from '@/lib/supabase-admin';
import { cleanCriteria, DEFAULT_CRITERIA, DEFAULT_HIRING_FOR, type Criterion } from '@/lib/hiring-criteria';
import { DEFAULT_COMPANY_CONTEXT, DEFAULT_SCORING_GUIDE } from '@/lib/hiring-prompts';

// Server-only: reads the saved scoring settings, falling back to the built-in sales-rep defaults
// when nothing has been saved yet. A missing table is reported, not hidden.
export async function getHiringSettingsServer(): Promise<{ criteria: Criterion[]; hiringFor: string; companyContext: string; scoringGuide: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('hiring_settings').select('*').eq('id', 'default').maybeSingle();
  if (error) {
    const missing = error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message);
    throw new Error(missing ? 'The hiring settings table has not been created yet. Run dev-schema-hiring.sql in Supabase.' : error.message);
  }
  const cleaned = data ? cleanCriteria(data.criteria) : null;
  return {
    criteria: cleaned && 'criteria' in cleaned ? cleaned.criteria : DEFAULT_CRITERIA,
    hiringFor: (data?.hiring_for as string) || DEFAULT_HIRING_FOR,
    // Empty or missing (column not created yet) falls back to the draft text.
    companyContext: ((data?.company_context as string) || '').trim() || DEFAULT_COMPANY_CONTEXT,
    scoringGuide: ((data?.scoring_guide as string) || '').trim() || DEFAULT_SCORING_GUIDE,
  };
}
