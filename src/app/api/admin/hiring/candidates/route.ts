import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { rowToCandidate } from '@/lib/hiring-server';

// All candidates, newest first. Admin only: the table has no browser access at all.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const { data, error } = await admin.from('hiring_candidates').select('*').order('created_at', { ascending: false });
  if (error) {
    const missing = error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message);
    return NextResponse.json(
      { error: missing ? 'The hiring table has not been created yet. Run dev-schema-hiring.sql in Supabase.' : error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ candidates: (data || []).map(rowToCandidate) });
}
